import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { assertRecordNotStale } from "../utils/concurrency";
import { assertDateWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { toBaseCurrencyAmount } from "../utils/currencyConversion";
import { toEnglishDigits } from "../utils/digits";
import { registerTreasuryAccountingRoutes } from "../services/treasuryDocAccountingActions";
import { accountingApproveGuarantee, setGuaranteeUnapproved, getGuaranteeAccountingView, saveGuaranteeAccountingDetails, issueGuaranteeJournalEntry, revertGuaranteeJournalEntry } from "../services/guaranteeJournalEntryService";
import { documentHasEvents } from "../services/guaranteeOperationService";

const JE_LOCK_MESSAGE = "برای این سند، سند حسابداری صادر شده است؛ ابتدا سند حسابداری را حذف کنید";
const ACC_LOCK_MESSAGE = "این سند تایید حسابداری شده است؛ ابتدا «لغو تایید حسابداری» را بزنید";

// «دریافت تضمین» و «پرداخت تضمین» (مدیریت خزانه › تضامین): یک پیاده‌سازی برای هر دو جهت (createGuaranteeRouter).
// سند: شماره (هر دوره مالی و هر جهت جدا، آخرین + ۱)، تاریخ (داخل دوره مالی)، طرف‌حساب، نوع مبنا (بدون مبنا / سفارش خرید — فقط دریافت)،
// صندوق (فقط دریافت) و شرح؛ ابزارها: چک، سفته، ضمانت‌نامه. فعلاً سند حسابداری و چرخه‌ی عمر (وصول/استرداد) ندارد؛ فقط ثبت است.

type Direction = "RECEIPT" | "PAYMENT";

const EPS = 1e-9;
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

async function currentPeriodOf(date: Date) {
  const fp = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
  if (!fp) throw new Error("تاریخ در هیچ دوره مالی تعریف‌شده‌ای نیست");
  return fp;
}

function instrumentShape(i: any) {
  return {
    id: i.id,
    type: i.type,
    number: i.number,
    guaranteeTypeId: i.guaranteeTypeId,
    dueDate: i.dueDate,
    series: i.series ?? "",
    amount: Number(i.amount),
    currencyId: i.currencyId,
    fxRate: Number(i.fxRate),
    baseAmount: Number(i.baseAmount),
    bankBranchId: i.bankBranchId,
    bankAccountId: i.bankAccountId,
    bankPartyId: i.bankPartyId,
    branchCode: i.branchCode ?? "",
    branchName: i.branchName ?? "",
    description: i.description ?? "",
  };
}

const INCLUDE = {
  party: { select: { id: true, detailCode: true, detailTitle: true } },
  journalEntry: { select: { id: true, referenceNumber: true } },
  accountingLines: { select: { id: true } },
  cashBox: { select: { id: true, title: true } },
  purchaseOrder: { select: { id: true, number: true } },
  instruments: { orderBy: { rowOrder: "asc" as const } },
};

function docShape(d: any) {
  return {
    id: d.id,
    number: d.number,
    date: d.date,
    partyId: d.partyId,
    partyCode: d.party?.detailCode ?? "",
    partyTitle: d.party?.detailTitle ?? "",
    basis: d.basis,
    purchaseOrderId: d.purchaseOrderId,
    purchaseOrderNumber: d.purchaseOrder?.number ?? null,
    cashBoxId: d.cashBoxId,
    cashBoxTitle: d.cashBox?.title ?? "",
    description: d.description ?? "",
    accountingStatus: d.accountingStatus,
    accountingLineCount: d.accountingLines?.length ?? 0,
    journalEntryId: d.journalEntryId ?? null,
    journalEntryReferenceNumber: d.journalEntry?.referenceNumber ?? null,
    isOpening: d.openingId != null,
    updatedAt: d.updatedAt,
    instrumentCount: d.instruments?.length ?? 0,
    totalBaseAmount: (d.instruments ?? []).reduce((s: number, i: any) => s + Number(i.baseAmount), 0),
    instruments: (d.instruments ?? []).map(instrumentShape),
  };
}

const OPENING_LOCK_MESSAGE = "این سند از «عملیات اول دوره» (افتتاحیه) ساخته شده است؛ ویرایش و حذف آن فقط از همان فرم ممکن است و تایید حسابداری و سند ندارد";
async function assertNotOpening(documentId: number) {
  const d = await prisma.guaranteeDocument.findUnique({ where: { id: documentId }, select: { openingId: true } });
  if (d?.openingId != null) throw new Error(OPENING_LOCK_MESSAGE);
}

async function assertNoOperations(documentId: number) {
  if (await documentHasEvents(documentId)) throw new Error("برای ابزارهای این سند تمدید یا عملیات (تقلیل/افزایش/ابطال) ثبت شده است؛ ابتدا آن اسناد را حذف کنید");
}

/** اعتبارسنجی و ساخت داده‌ی ابزارهای تضمین (چک/سفته/ضمانت‌نامه)؛ مشترک بین فرم دریافت/پرداخت تضمین و افتتاحیه (services/guaranteeOpeningService.ts) */
export async function cleanGuaranteeInstruments(lines: any[], direction: Direction, description: string | null) {
  const isReceipt = direction === "RECEIPT";
  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) throw new Error("ارز پایه تعریف نشده است");
  const currencyCache = new Map<number, any>([[baseCurrency.id, baseCurrency]]);
  const instruments: any[] = [];
  const seen = new Set<string>();

  for (let idx = 0; idx < lines.length; idx++) {
    const l = lines[idx];
    const row = `ردیف ${idx + 1}`;
    const type = l?.type;
    if (type !== "CHEQUE" && type !== "PROMISSORY" && type !== "LETTER") throw new Error(`${row}: نوع ابزار نامعتبر است`);
    const label = type === "CHEQUE" ? "چک" : type === "PROMISSORY" ? "سفته" : "ضمانت‌نامه";
    const number = toEnglishDigits(text(l.number));
    if (!number) throw new Error(`${row} (${label}): شماره الزامی است`);
    const key = `${type}:${number}`;
    if (seen.has(key)) throw new Error(`${row} (${label}): شماره «${number}» در همین سند تکراری است`);
    seen.add(key);

    const guaranteeTypeId = Number(l.guaranteeTypeId);
    const gt = guaranteeTypeId ? await prisma.guaranteeType.findUnique({ where: { id: guaranteeTypeId } }) : null;
    if (!gt) throw new Error(`${row} (${label}): نوع تضمین الزامی است`);
    if (gt.direction !== direction) throw new Error(`${row} (${label}): نوع تضمین «${gt.title}» از نوع ${isReceipt ? "پرداخت" : "دریافت"} است`);

    const amount = Number(l.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error(`${row} (${label}): مبلغ باید بزرگتر از صفر باشد`);
    if (Math.abs(amount * 100 - Math.round(amount * 100)) > EPS * 100) throw new Error(`${row} (${label}): مبلغ بیش از دو رقم اعشار دارد`);

    let dueDate: Date | null = null;
    if (l.dueDate) {
      dueDate = new Date(l.dueDate);
      if (Number.isNaN(dueDate.getTime())) throw new Error(`${row} (${label}): تاریخ سررسید نامعتبر است`);
    }

    let currencyId = baseCurrency.id;
    let fxRate = 1;
    let bankBranchId: number | null = null;
    let bankAccountId: number | null = null;
    let bankPartyId: number | null = null;
    let branchCode: string | null = null;
    let branchName: string | null = null;
    let series: string | null = null;

    if (type === "CHEQUE") {
      if (isReceipt) {
        bankBranchId = Number(l.bankBranchId) || null;
        if (bankBranchId && !(await prisma.bankBranch.findUnique({ where: { id: bankBranchId }, select: { id: true } }))) throw new Error(`${row} (${label}): شعبه‌ی بانک یافت نشد`);
      } else {
        bankAccountId = Number(l.bankAccountId) || null;
        if (!bankAccountId || !(await prisma.bankAccount.findUnique({ where: { id: bankAccountId }, select: { id: true } }))) throw new Error(`${row} (${label}): حساب بانکی الزامی است`);
      }
    } else if (type === "PROMISSORY") {
      series = text(l.series) || null;
    } else {
      // ضمانت‌نامه: ارز و نرخ ارز
      currencyId = Number(l.currencyId) || baseCurrency.id;
      if (!currencyCache.has(currencyId)) {
        const c = await prisma.currency.findUnique({ where: { id: currencyId } });
        if (!c) throw new Error(`${row} (${label}): ارز یافت نشد`);
        currencyCache.set(currencyId, c);
      }
      if (currencyId !== baseCurrency.id) {
        fxRate = Number(l.fxRate);
        if (!Number.isFinite(fxRate) || fxRate <= 0) throw new Error(`${row} (${label}): نرخ ارز باید بزرگتر از صفر باشد`);
      }
      if (isReceipt) {
        bankPartyId = Number(l.bankPartyId) || null;
        const bank = bankPartyId ? await prisma.party.findUnique({ where: { id: bankPartyId }, select: { legalType: true } }) : null;
        if (!bank || bank.legalType !== "BANK") throw new Error(`${row} (${label}): بانک/موسسه‌ی مالی را از بین طرف‌حساب‌های حقوقیِ نوع بانک انتخاب کنید`);
        branchCode = text(l.branchCode);
        branchName = text(l.branchName);
        if (!branchCode) throw new Error(`${row} (${label}): کد شعبه الزامی است`);
        if (!branchName) throw new Error(`${row} (${label}): شعبه الزامی است`);
      } else {
        bankAccountId = Number(l.bankAccountId) || null;
        if (!bankAccountId || !(await prisma.bankAccount.findUnique({ where: { id: bankAccountId }, select: { id: true } }))) throw new Error(`${row} (${label}): حساب بانکی الزامی است`);
      }
    }

    const currency = currencyCache.get(currencyId);
    const baseAmount = toBaseCurrencyAmount(amount, fxRate, currency, baseCurrency);
    instruments.push({
      rowOrder: idx,
      type,
      number,
      guaranteeTypeId,
      dueDate,
      series,
      amount,
      currencyId,
      fxRate,
      baseAmount,
      bankBranchId,
      bankAccountId,
      bankPartyId,
      branchCode,
      branchName,
      description: text(l.description) || description,
    });
  }
  return instruments;
}

export function createGuaranteeRouter(direction: Direction, formKey: string) {
  const FORM = findFormPrefix(formKey);
  const router = Router();
  const isReceipt = direction === "RECEIPT";

  async function clean(body: any, existing?: { fiscalPeriodId: number }) {
    if (!body?.date) throw new Error("تاریخ الزامی است");
    const date = new Date(body.date);
    if (Number.isNaN(date.getTime())) throw new Error("تاریخ نامعتبر است");
    await assertDateWithinCurrentFiscalPeriod(date);
    const fp = await currentPeriodOf(date);
    if (existing && existing.fiscalPeriodId !== fp.id) throw new Error("تاریخ سند باید در همان دوره مالی ثبت‌شده‌ی سند بماند");

    const partyId = Number(body.partyId);
    const party = partyId ? await prisma.party.findUnique({ where: { id: partyId }, select: { id: true, isActive: true } }) : null;
    if (!party) throw new Error("طرف‌حساب الزامی است");

    let basis: "NO_BASIS" | "PURCHASE_ORDER" = "NO_BASIS";
    let purchaseOrderId: number | null = null;
    if (isReceipt && body.basis === "PURCHASE_ORDER") {
      basis = "PURCHASE_ORDER";
      purchaseOrderId = Number(body.purchaseOrderId) || null;
      if (!purchaseOrderId) throw new Error("سفارش خرید مبنا را انتخاب کنید");
      const po = await prisma.purchaseOrder.findUnique({ where: { id: purchaseOrderId }, include: { supplier: { select: { partyId: true } } } });
      if (!po) throw new Error("سفارش خرید یافت نشد");
      if (po.supplier.partyId !== partyId) throw new Error("طرف‌حساب سفارش خرید با طرف‌حساب سند یکی نیست");
      if (po.date.getTime() > date.getTime()) throw new Error("تاریخ سفارش خرید نمی‌تواند بعد از تاریخ سند باشد");
    }

    let cashBoxId: number | null = null;
    if (isReceipt) {
      cashBoxId = Number(body.cashBoxId) || null;
      if (!cashBoxId || !(await prisma.cashBox.findUnique({ where: { id: cashBoxId }, select: { id: true } }))) throw new Error("صندوق الزامی است");
    }

    const description = text(body.description) || null;
    const lines: any[] = Array.isArray(body.instruments) ? body.instruments : [];
    if (lines.length === 0) throw new Error("حداقل یک ابزار تضمین (چک، سفته یا ضمانت‌نامه) لازم است");

    const instruments = await cleanGuaranteeInstruments(lines, direction, description);
    return { date, fiscalPeriodId: fp.id, partyId, basis, purchaseOrderId, cashBoxId, description, instruments };
  }

  router.get("/", async (_req, res) => {
    const rows = await prisma.guaranteeDocument.findMany({ where: { direction }, include: INCLUDE, orderBy: { number: "desc" } });
    res.json(rows.map((d) => ({ ...docShape(d), instruments: undefined })));
  });

  // سفارش‌های خریدِ یک طرف‌حساب (تأمین‌کننده) برای انتخاب مبنا
  router.get("/pickable-purchase-orders", async (req, res) => {
    const partyId = Number(req.query.partyId);
    if (!partyId) return res.json([]);
    const rows = await prisma.purchaseOrder.findMany({
      where: { supplier: { partyId } },
      select: { id: true, number: true, date: true, description: true },
      orderBy: { number: "desc" },
    });
    res.json(rows);
  });

  router.get("/:id", async (req, res) => {
    const d = await prisma.guaranteeDocument.findFirst({ where: { id: Number(req.params.id), direction }, include: INCLUDE });
    if (!d) return res.status(404).json({ error: "سند یافت نشد" });
    res.json(docShape(d));
  });

  router.post("/", can(`${FORM}.create`), async (req, res) => {
    try {
      const { instruments, ...head } = await clean(req.body);
      const created = await prisma.$transaction(async (tx) => {
        // شماره: آخرین + ۱ در همین دوره مالی و همین جهت؛ قفل مشورتی (هر جهت یک کلید)، دو ثبت هم‌زمان را پشت سر هم می‌گذارد
        if (isReceipt) await tx.$executeRaw`SELECT pg_advisory_xact_lock(7100100)`;
        else await tx.$executeRaw`SELECT pg_advisory_xact_lock(7100101)`;
        const last = await tx.guaranteeDocument.findFirst({ where: { direction, fiscalPeriodId: head.fiscalPeriodId }, orderBy: { number: "desc" }, select: { number: true } });
        return tx.guaranteeDocument.create({
          data: { direction, number: (last?.number ?? 0) + 1, ...head, instruments: { create: instruments } },
          include: INCLUDE,
        });
      });
      res.status(201).json(docShape(created));
    } catch (e: any) {
      res.status(400).json({ error: e?.message || "خطا در ثبت سند" });
    }
  });

  router.put("/:id", can(`${FORM}.edit`), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const ex = await prisma.guaranteeDocument.findFirst({ where: { id, direction } });
      if (!ex) return res.status(404).json({ error: "سند یافت نشد" });
      if (ex.openingId != null) throw new Error(OPENING_LOCK_MESSAGE);
      if (ex.journalEntryId) throw new Error(JE_LOCK_MESSAGE);
      if (ex.accountingStatus === "APPROVED") throw new Error(ACC_LOCK_MESSAGE);
      assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "سند تضمین");
      await assertNoOperations(id);
      const { instruments, ...head } = await clean(req.body, ex);
      const updated = await prisma.$transaction(async (tx) => {
        await tx.guaranteeInstrument.deleteMany({ where: { documentId: id } });
        // شماره و جهت هرگز تغییر نمی‌کنند
        return tx.guaranteeDocument.update({ where: { id }, data: { ...head, instruments: { create: instruments } }, include: INCLUDE });
      });
      res.json(docShape(updated));
    } catch (e: any) {
      res.status(400).json({ error: e?.message || "خطا در ویرایش سند" });
    }
  });

  router.delete("/:id", can(`${FORM}.delete`), async (req, res) => {
    try {
      const id = Number(req.params.id);
      const ex = await prisma.guaranteeDocument.findFirst({ where: { id, direction }, select: { id: true, openingId: true, journalEntryId: true, accountingStatus: true } });
      if (!ex) return res.status(404).json({ error: "سند یافت نشد" });
      if (ex.openingId != null) throw new Error(OPENING_LOCK_MESSAGE);
      if (ex.journalEntryId) throw new Error(JE_LOCK_MESSAGE);
      if (ex.accountingStatus === "APPROVED") throw new Error(ACC_LOCK_MESSAGE);
      await assertNoOperations(id);
      await prisma.guaranteeDocument.delete({ where: { id } });
      res.status(204).send();
    } catch (e: any) {
      res.status(400).json({ error: e?.message || "خطا در حذف سند" });
    }
  });

  // ---------- تایید حسابداری و سند حسابداری: همان مسیرهای مشترکِ دریافت/پرداخت (services/treasuryDocAccountingActions.ts) ----------
  registerTreasuryAccountingRoutes(router, {
    basePath: "",
    form: FORM,
    adapter: {
      label: "سند تضمین",
      jeLockMessage: JE_LOCK_MESSAGE,
      requireEffective: false,
      load: (id) => prisma.guaranteeDocument.findFirst({ where: { id, direction }, select: { accountingStatus: true, journalEntryId: true } }),
      approve: async (id, userId) => {
        await assertNotOpening(id);
        return accountingApproveGuarantee(id, userId);
      },
      setUnapproved: (id) => setGuaranteeUnapproved(id),
      view: (id) => getGuaranteeAccountingView(id),
      saveDetails: (id, rows) => saveGuaranteeAccountingDetails(id, rows),
      countLines: (id) => prisma.guaranteeAccountingLine.count({ where: { documentId: id } }),
      deleteLines: async (id) => {
        await assertNotOpening(id);
        await prisma.guaranteeAccountingLine.deleteMany({ where: { documentId: id } });
      },
      issue: async (id) => {
        await assertNotOpening(id);
        return issueGuaranteeJournalEntry(id) as any;
      },
      revert: async (id) => {
        // تا وقتی از ابزارهای این سند استرداد ثبت شده، سند حسابداری اصلی قابل حذف نیست (سند استرداد معکوسِ آن است)
        const returned = await prisma.guaranteeReturnLine.count({ where: { instrument: { documentId: id } } });
        if (returned > 0) throw new Error("از ابزارهای این سند استرداد ثبت شده است؛ ابتدا اسناد استرداد (و سند حسابداری آن‌ها) را حذف کنید");
        await assertNoOperations(id);
        await revertGuaranteeJournalEntry(id);
      },
    },
  });

  return router;
}
