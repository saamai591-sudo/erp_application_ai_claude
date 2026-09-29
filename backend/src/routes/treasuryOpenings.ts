import { Router } from "express";
import { prisma } from "../lib/prisma";
import { withoutFiscalPeriodScope } from "../lib/requestContext";
import { assertRecordNotStale } from "../utils/concurrency";
import { findChequeUses } from "../utils/chequeUsage";
import { can } from "../authz/guard";
import { assertDateWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { findFormPrefix } from "../authz/registry";
import { openingHasSystemGeneratedContent } from "../services/treasuryYearCloseService";

const FORM = findFormPrefix("treasury-openings");

// =========================================================================
// ماژول «خزانه‌داری» > افتتاحیه دریافت و پرداخت — Documents/افتتاحیه دریافت و پرداخت و بستن سال.md
//
// به‌ازای هر دوره مالی یک فرم افتتاحیه با چهار تب: چک‌های دریافتی و چک‌های پرداختی (خودِ ChequeItemهایی با
// isOpening=true در همان دوره؛ ردیف‌های ساخته‌شده توسط «بستن سال» parentChequeId به چک سال قبل دارند)، حساب‌های بانکی و
// صندوق‌ها (مانده‌ی اول دوره به ارز حساب/صندوق و به ارز پایه). هم برای استقرار اولیه (ورود دستی) و هم برای انتقال پایان سال
// (ایجاد خودکار توسط routes/treasuryYearClose.ts) استفاده می‌شود و می‌تواند مرحله‌به‌مرحله تکمیل شود.
//
// ذخیره (PUT) کل چهار تب را هم‌زمان جایگزین می‌کند؛ مگر چک‌های «قفل»: چکی که سندی (حتی پیش‌نویس) به آن ارجاع می‌دهد یا
// بعد از افتتاحیه گردش داشته (step ≠ ۱) دیگر از این فرم قابل تغییر/حذف نیست.
//
// ردیف‌هایی که «بستن سال دریافت و پرداخت» خودکار می‌سازد (ردیف حساب بانکی/صندوق با isSystemGenerated، و چک‌های منتقل‌شده با
// parentChequeId) توسط سیستم ساخته شده‌اند و کاربر نمی‌تواند آن‌ها را ویرایش یا حذف کند؛ فقط ردیف‌های دستی (استقرار اولیه) قابل
// ویرایش‌اند. تنها راه حذفشان «بازگشایی» همان بخش در «عملیات پایان دوره‌ی» دوره‌ی قبل است (services/treasuryYearCloseService.ts#reopenSection)؛
// حذف کل افتتاحیه (DELETE) برای افتتاحیه‌ای که رکورد خودکار دارد یا بستنِ دوره‌ی قبل آن را ساخته رد می‌شود.
// =========================================================================

const router = Router();

const RECEIVABLE_STATUSES = ["IN_HAND", "IN_COLLECTION", "BOUNCED"];
const PAYABLE_STATUSES = ["ISSUED"];

interface BankLineIn { bankAccountId: number; balance: number; baseBalance?: number }
interface CashLineIn { cashBoxId: number; currencyId: number; balance: number; baseBalance?: number }
interface ChequeIn {
  id?: number;
  number: string;
  typeId: number; // نوع چک دریافتی/پرداختی
  receiptTypeId?: number | null; // نوع دریافت (فقط چک دریافتی)
  paymentTypeId?: number | null; // نوع پرداخت (فقط چک پرداختی)
  bankBranchId?: number | null;
  bankAccountId?: number | null; // فقط چک پرداختی
  dueDate: string;
  amount: number;
  partyId: number;
  status: string;
  description?: string | null;
}
interface OpeningBody {
  date: string;
  fiscalPeriodId?: number;
  bankAccountLines?: BankLineIn[];
  cashBoxLines?: CashLineIn[];
  receivableCheques?: ChequeIn[];
  payableCheques?: ChequeIn[];
  updatedAt?: string;
}

function partyDisplay(p: any): string {
  if (!p) return "";
  return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}

async function getBaseCurrency() {
  const c = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!c) throw new Error("ارز پایه تعریف نشده است");
  return c;
}

async function loadOpeningCheques(fiscalPeriodId: number) {
  // fiscalPeriodId صراحتاً در where است، پس فیلتر خودکار دوره‌ی مالی دخالتی ندارد
  return prisma.chequeItem.findMany({
    where: { fiscalPeriodId, isOpening: true },
    include: { party: true, bankBranch: true, receivableChequeType: true, payableChequeType: true, openingReceiptType: true, openingPaymentType: true, ownerBankAccount: true },
    orderBy: { id: "asc" },
  });
}

async function isChequeLocked(c: any): Promise<boolean> {
  if (c.step !== 1) return true;
  return (await findChequeUses(prisma, c.id, {})).length > 0;
}

/** افتتاحیه‌ای که «عملیات پایان دوره»ی سال قبل ساخته (بستنِ ثبت‌شده یا رکورد خودکار دارد) با «حذف» پاک نمی‌شود؛ فقط با «بازگشایی» در سال قبل. */
async function isOpeningDeletionBlocked(opening: { id: number; fiscalPeriodId: number }): Promise<boolean> {
  const thisPeriod = await prisma.fiscalPeriod.findUnique({ where: { id: opening.fiscalPeriodId } });
  const prev = thisPeriod ? await prisma.fiscalPeriod.findFirst({ where: { toDate: { lt: thisPeriod.fromDate } }, orderBy: { toDate: "desc" } }) : null;
  const prevCloses = prev ? await withoutFiscalPeriodScope(() => prisma.treasuryYearClose.count({ where: { fiscalPeriodId: prev.id } })) : 0;
  return prevCloses > 0 || (await openingHasSystemGeneratedContent(opening.fiscalPeriodId, opening.id));
}

async function serializeOpening(o: any) {
  const cheques = await loadOpeningCheques(o.fiscalPeriodId);
  const locks = await Promise.all(cheques.map((c: any) => isChequeLocked(c)));
  const mapCheque = (c: any, i: number) => ({
    id: c.id,
    number: c.number,
    typeId: c.direction === "RECEIVABLE" ? c.receivableChequeTypeId : c.payableChequeTypeId,
    typeTitle: c.direction === "RECEIVABLE" ? c.receivableChequeType?.title : c.payableChequeType?.title,
    receiptTypeId: c.openingReceiptTypeId,
    paymentTypeId: c.openingPaymentTypeId,
    receiptTypeTitle: c.openingReceiptType?.title,
    paymentTypeTitle: c.openingPaymentType?.title,
    bankBranchId: c.bankBranchId,
    bankBranchTitle: c.bankBranch?.title,
    bankAccountId: c.ownerBankAccountId,
    bankAccountNumber: c.ownerBankAccount?.accountNumber,
    dueDate: c.dueDate,
    amount: Number(c.amount),
    partyId: c.partyId,
    partyDisplay: partyDisplay(c.party),
    status: c.status,
    description: c.description,
    parentChequeId: c.parentChequeId,
    // چک منتقل‌شده توسط «بستن سال» (به چک سال قبل ارجاع دارد): همیشه فقط‌خواندنی
    transferred: c.parentChequeId != null,
    locked: locks[i] || c.parentChequeId != null,
  });
  const all = cheques.map((c: any, i: number) => ({ c, i }));
  return {
    id: o.id,
    date: o.date,
    fiscalPeriodId: o.fiscalPeriodId,
    fiscalPeriodTitle: o.fiscalPeriod.title,
    updatedAt: o.updatedAt,
    // false = افتتاحیه توسط عملیات پایان دوره‌ی سال قبل ساخته شده؛ دکمه‌ی حذف نمایش داده نمی‌شود (فقط «بازگشایی» در سال قبل)
    deletable: !(await isOpeningDeletionBlocked(o)),
    bankAccountLines: o.bankAccountLines.map((l: any) => ({
      bankAccountId: l.bankAccountId,
      bankAccountNumber: l.bankAccount.accountNumber,
      currencyId: l.currencyId,
      currencyTitle: l.currency.title,
      balance: Number(l.balance),
      baseBalance: Number(l.baseBalance),
      systemGenerated: l.isSystemGenerated,
    })),
    cashBoxLines: o.cashBoxLines.map((l: any) => ({
      cashBoxId: l.cashBoxId,
      cashBoxTitle: l.cashBox.title,
      currencyId: l.currencyId,
      currencyTitle: l.currency.title,
      balance: Number(l.balance),
      baseBalance: Number(l.baseBalance),
      systemGenerated: l.isSystemGenerated,
    })),
    receivableCheques: all.filter(({ c }: any) => c.direction === "RECEIVABLE").map(({ c, i }: any) => mapCheque(c, i)),
    payableCheques: all.filter(({ c }: any) => c.direction === "PAYABLE").map(({ c, i }: any) => mapCheque(c, i)),
  };
}

const DETAIL_INCLUDE = {
  fiscalPeriod: true,
  bankAccountLines: { include: { bankAccount: true, currency: true }, orderBy: { rowOrder: "asc" } },
  cashBoxLines: { include: { cashBox: true, currency: true }, orderBy: { rowOrder: "asc" } },
} as const;

router.get("/treasury-openings", can(`${FORM}.view`), async (_req, res) => {
  const items = await prisma.treasuryOpening.findMany({ include: { fiscalPeriod: true, bankAccountLines: true, cashBoxLines: true }, orderBy: { id: "desc" } });
  const result = [];
  for (const o of items as any[]) {
    const cheques = await loadOpeningCheques(o.fiscalPeriodId);
    result.push({
      id: o.id,
      date: o.date,
      fiscalPeriodTitle: o.fiscalPeriod.title,
      receivableChequeCount: cheques.filter((c: any) => c.direction === "RECEIVABLE").length,
      payableChequeCount: cheques.filter((c: any) => c.direction === "PAYABLE").length,
      bankAccountCount: o.bankAccountLines.length,
      cashBoxCount: o.cashBoxLines.length,
    });
  }
  res.json(result);
});

router.get("/treasury-openings/:id", can(`${FORM}.view`), async (req, res) => {
  const o = await prisma.treasuryOpening.findUnique({ where: { id: Number(req.params.id) }, include: DETAIL_INCLUDE });
  if (!o) return res.status(404).json({ error: "افتتاحیه یافت نشد" });
  res.json(await serializeOpening(o));
});

// ---------------------------------------------------------------------------
// اعتبارسنجی و ساخت داده‌ی ذخیره‌شدنی ردیف‌ها
// ---------------------------------------------------------------------------

async function cleanBankLines(lines: BankLineIn[] | undefined, baseCurrencyId: number) {
  const out: { bankAccountId: number; currencyId: number; balance: number; baseBalance: number }[] = [];
  const seen = new Set<number>();
  for (const [idx, l] of (lines || []).entries()) {
    if (!l.bankAccountId) throw new Error(`حساب‌های بانکی — ردیف ${idx + 1}: انتخاب حساب بانکی الزامی است`);
    if (seen.has(l.bankAccountId)) throw new Error(`حساب‌های بانکی — ردیف ${idx + 1}: یک حساب بانکی نمی‌تواند دو بار ثبت شود`);
    seen.add(l.bankAccountId);
    // eslint-disable-next-line no-await-in-loop
    const acc = await prisma.bankAccount.findUnique({ where: { id: l.bankAccountId } });
    if (!acc) throw new Error(`حساب‌های بانکی — ردیف ${idx + 1}: حساب بانکی یافت نشد`);
    const currencyId = acc.currencyId ?? baseCurrencyId;
    const balance = Number(l.balance);
    if (Number.isNaN(balance)) throw new Error(`حساب‌های بانکی — ردیف ${idx + 1}: مانده نامعتبر است`);
    // ارز از خودِ حساب بانکی می‌آید؛ برای ارز پایه، مانده‌ی ارز پایه همان مانده است و برای ارز غیرپایه هر دو مبلغ ثبت می‌شود
    const baseBalance = currencyId === baseCurrencyId ? balance : Number(l.baseBalance);
    if (Number.isNaN(baseBalance)) throw new Error(`حساب‌های بانکی — ردیف ${idx + 1}: مانده به ارز پایه الزامی است`);
    out.push({ bankAccountId: l.bankAccountId, currencyId, balance, baseBalance });
  }
  return out;
}

async function cleanCashLines(lines: CashLineIn[] | undefined, baseCurrencyId: number) {
  const out: { cashBoxId: number; currencyId: number; balance: number; baseBalance: number }[] = [];
  const seen = new Set<string>();
  for (const [idx, l] of (lines || []).entries()) {
    if (!l.cashBoxId) throw new Error(`صندوق‌ها — ردیف ${idx + 1}: انتخاب صندوق الزامی است`);
    if (!l.currencyId) throw new Error(`صندوق‌ها — ردیف ${idx + 1}: انتخاب ارز الزامی است`);
    const key = `${l.cashBoxId}:${l.currencyId}`;
    if (seen.has(key)) throw new Error(`صندوق‌ها — ردیف ${idx + 1}: برای یک صندوق و ارز بیش از یک ردیف ثبت شده است`);
    seen.add(key);
    // eslint-disable-next-line no-await-in-loop
    const [box, cur] = await Promise.all([prisma.cashBox.findUnique({ where: { id: l.cashBoxId } }), prisma.currency.findUnique({ where: { id: l.currencyId } })]);
    if (!box) throw new Error(`صندوق‌ها — ردیف ${idx + 1}: صندوق یافت نشد`);
    if (!cur) throw new Error(`صندوق‌ها — ردیف ${idx + 1}: ارز یافت نشد`);
    const balance = Number(l.balance);
    if (Number.isNaN(balance)) throw new Error(`صندوق‌ها — ردیف ${idx + 1}: مانده نامعتبر است`);
    const baseBalance = l.currencyId === baseCurrencyId ? balance : Number(l.baseBalance);
    if (Number.isNaN(baseBalance)) throw new Error(`صندوق‌ها — ردیف ${idx + 1}: مانده به ارز پایه الزامی است`);
    out.push({ cashBoxId: l.cashBoxId, currencyId: l.currencyId, balance, baseBalance });
  }
  return out;
}

// unchangedAccountId: حساب فعلیِ خودِ چک (ردیف موجود) — اگر تغییر نکرده، شرط «دارای دسته چک» دوباره کنترل نمی‌شود (چک‌های منتقل‌شده‌ی قدیمی)
async function cleanCheque(l: ChequeIn, idx: number, direction: "RECEIVABLE" | "PAYABLE", tab: string, unchangedAccountId?: number | null) {
  const label = `${tab} — ردیف ${idx + 1}`;
  if (!l.number || !String(l.number).trim()) throw new Error(`${label}: شماره چک الزامی است`);
  if (!l.typeId) throw new Error(`${label}: نوع چک الزامی است`);
  if (!l.dueDate) throw new Error(`${label}: تاریخ سررسید الزامی است`);
  const amount = Number(l.amount);
  if (!(amount > 0)) throw new Error(`${label}: مبلغ باید عددی مثبت باشد`);
  if (!l.partyId) throw new Error(`${label}: طرف حساب الزامی است`);
  const allowed = direction === "RECEIVABLE" ? RECEIVABLE_STATUSES : PAYABLE_STATUSES;
  if (!allowed.includes(l.status)) throw new Error(`${label}: وضعیت چک نامعتبر است`);
  if (!(await prisma.party.findUnique({ where: { id: l.partyId } }))) throw new Error(`${label}: طرف حساب یافت نشد`);
  if (direction === "RECEIVABLE") {
    if (!(await prisma.receivableChequeType.findUnique({ where: { id: l.typeId } }))) throw new Error(`${label}: نوع چک دریافتی یافت نشد`);
    if (l.bankBranchId && !(await prisma.bankBranch.findUnique({ where: { id: l.bankBranchId } }))) throw new Error(`${label}: شعبه بانک یافت نشد`);
  } else {
    if (!l.bankAccountId) throw new Error(`${label}: حساب بانکی الزامی است`);
    const acc = await prisma.bankAccount.findUnique({ where: { id: l.bankAccountId }, include: { accountType: true } });
    if (!acc) throw new Error(`${label}: حساب بانکی یافت نشد`);
    if (!acc.accountType.hasChequeBook && l.bankAccountId !== unchangedAccountId) throw new Error(`${label}: چک پرداختی فقط از حساب بانکیِ نوعِ «دارای دسته چک» قابل ثبت است`);
    if (!(await prisma.payableChequeType.findUnique({ where: { id: l.typeId } }))) throw new Error(`${label}: نوع چک پرداختی یافت نشد`);
  }
  return amount;
}

function chequeData(l: ChequeIn, direction: "RECEIVABLE" | "PAYABLE", amount: number, baseCurrencyId: number) {
  return {
    number: String(l.number).trim(),
    dueDate: new Date(l.dueDate),
    amount,
    currencyId: baseCurrencyId, // چک همیشه با ارز پایه است
    partyId: l.partyId,
    status: l.status as any,
    description: l.description || null,
    bankBranchId: l.bankBranchId || null,
    ownerBankAccountId: direction === "PAYABLE" ? l.bankAccountId || null : null,
    receivableChequeTypeId: direction === "RECEIVABLE" ? l.typeId : null,
    payableChequeTypeId: direction === "PAYABLE" ? l.typeId : null,
    openingReceiptTypeId: direction === "RECEIVABLE" ? l.receiptTypeId || null : null,
    openingPaymentTypeId: direction === "PAYABLE" ? l.paymentTypeId || null : null,
  };
}

/** آیا ردیف ارسالی با چک منتقل‌شده‌ی ذخیره‌شده فرق دارد؟ (چک منتقل‌شده‌ی بستن سال نباید هیچ فیلدی‌اش عوض شود) */
function transferredChequeChanged(ex: any, data: ReturnType<typeof chequeData>): boolean {
  return (
    ex.number !== data.number ||
    new Date(ex.dueDate).toISOString().slice(0, 10) !== data.dueDate.toISOString().slice(0, 10) ||
    Math.abs(Number(ex.amount) - Number(data.amount)) > 0.001 ||
    ex.partyId !== data.partyId ||
    ex.status !== data.status ||
    (ex.description || null) !== data.description ||
    (ex.bankBranchId || null) !== data.bankBranchId ||
    (ex.ownerBankAccountId || null) !== data.ownerBankAccountId ||
    (ex.receivableChequeTypeId || null) !== data.receivableChequeTypeId ||
    (ex.payableChequeTypeId || null) !== data.payableChequeTypeId ||
    (ex.openingReceiptTypeId || null) !== data.openingReceiptTypeId ||
    (ex.openingPaymentTypeId || null) !== data.openingPaymentTypeId
  );
}

const TRANSFERRED_MESSAGE = "این چک توسط «بستن سال» به این دوره منتقل شده است و قابل ویرایش یا حذف نیست";

/** چک‌های یک جهت را با ردیف‌های ارسالی هم‌گام می‌کند (افزودن/ویرایش/حذف)، به‌جز چک‌های قفل که دست‌نخورده می‌مانند.
 *  چک منتقل‌شده‌ی بستن سال هرگز از این فرم ویرایش/حذف نمی‌شود (فقط با «بازگشایی» در عملیات پایان دوره‌ی سال قبل). */
async function syncCheques(tx: any, fiscalPeriodId: number, direction: "RECEIVABLE" | "PAYABLE", rows: ChequeIn[], baseCurrencyId: number, tab: string) {
  const existing = await tx.chequeItem.findMany({ where: { fiscalPeriodId, isOpening: true, direction } });
  const byId = new Map<number, any>(existing.map((c: any) => [c.id, c]));
  const seen = new Set<number>();
  for (const [idx, l] of rows.entries()) {
    // eslint-disable-next-line no-await-in-loop
    const amount = await cleanCheque(l, idx, direction, tab, l.id ? byId.get(l.id)?.ownerBankAccountId : null);
    const data = chequeData(l, direction, amount, baseCurrencyId);
    if (l.id) {
      const ex = byId.get(l.id);
      if (!ex) throw new Error(`${tab} — ردیف ${idx + 1}: چک یافت نشد`);
      seen.add(l.id);
      if (ex.parentChequeId != null) {
        if (transferredChequeChanged(ex, data)) throw new Error(`${tab} — ردیف ${idx + 1}: ${TRANSFERRED_MESSAGE}`);
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      if (await isChequeLocked(ex)) {
        const changed = ex.number !== data.number || Math.abs(Number(ex.amount) - amount) > 0.001 || ex.status !== data.status || ex.partyId !== data.partyId;
        if (changed) throw new Error(`${tab} — ردیف ${idx + 1}: این چک در سند دیگری استفاده شده یا گردش داشته و قابل ویرایش نیست`);
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      await tx.chequeItem.update({ where: { id: l.id }, data });
    } else {
      // eslint-disable-next-line no-await-in-loop
      await tx.chequeItem.create({ data: { ...data, direction, fiscalPeriodId, isOpening: true, step: 1 } });
    }
  }
  for (const ex of existing) {
    if (seen.has(ex.id)) continue;
    if (ex.parentChequeId != null) throw new Error(`${tab}: چک شماره ${ex.number} — ${TRANSFERRED_MESSAGE}`);
    // eslint-disable-next-line no-await-in-loop
    if (await isChequeLocked(ex)) throw new Error(`${tab}: چک شماره ${ex.number} در سند دیگری استفاده شده یا گردش داشته و قابل حذف نیست`);
    // eslint-disable-next-line no-await-in-loop
    await tx.chequeItem.delete({ where: { id: ex.id } });
  }
}

/** ردیف‌های حساب بانکی: ردیف‌های ساخته‌شده توسط بستن سال دست‌نخورده می‌مانند (ویرایش/حذفشان خطا می‌دهد)؛ بقیه جایگزین می‌شوند. */
async function syncBankLines(tx: any, openingId: number, incoming: { bankAccountId: number; currencyId: number; balance: number; baseBalance: number }[]) {
  const existing = await tx.treasuryOpeningBankAccount.findMany({ where: { openingId, isSystemGenerated: true }, include: { bankAccount: true } });
  const byAccount = new Map<number, (typeof incoming)[number]>(incoming.map((l) => [l.bankAccountId, l]));
  for (const e of existing) {
    const l = byAccount.get(e.bankAccountId);
    const label = `حساب‌های بانکی — حساب ${e.bankAccount.accountNumber}`;
    if (!l) throw new Error(`${label}: این ردیف توسط «بستن سال» ساخته شده است و قابل حذف نیست`);
    if (l.currencyId !== e.currencyId || Math.abs(l.balance - Number(e.balance)) > 0.005 || Math.abs(l.baseBalance - Number(e.baseBalance)) > 0.005) {
      throw new Error(`${label}: این ردیف توسط «بستن سال» ساخته شده است و قابل ویرایش نیست`);
    }
  }
  const systemIds = new Set<number>(existing.map((e: any) => e.bankAccountId));
  await tx.treasuryOpeningBankAccount.deleteMany({ where: { openingId, isSystemGenerated: false } });
  for (const [i, l] of incoming.entries()) {
    if (systemIds.has(l.bankAccountId)) await tx.treasuryOpeningBankAccount.update({ where: { openingId_bankAccountId: { openingId, bankAccountId: l.bankAccountId } }, data: { rowOrder: i } });
    else await tx.treasuryOpeningBankAccount.create({ data: { ...l, openingId, rowOrder: i } });
  }
}

/** ردیف‌های صندوق: همان قاعده‌ی syncBankLines (کلید ردیف = صندوق + ارز). */
async function syncCashLines(tx: any, openingId: number, incoming: { cashBoxId: number; currencyId: number; balance: number; baseBalance: number }[]) {
  const existing = await tx.treasuryOpeningCashBox.findMany({ where: { openingId, isSystemGenerated: true }, include: { cashBox: true } });
  const keyOf = (cashBoxId: number, currencyId: number) => `${cashBoxId}:${currencyId}`;
  const byKey = new Map<string, (typeof incoming)[number]>(incoming.map((l) => [keyOf(l.cashBoxId, l.currencyId), l]));
  for (const e of existing) {
    const l = byKey.get(keyOf(e.cashBoxId, e.currencyId));
    const label = `صندوق‌ها — صندوق ${e.cashBox.title}`;
    if (!l) throw new Error(`${label}: این ردیف توسط «بستن سال» ساخته شده است و قابل حذف نیست`);
    if (Math.abs(l.balance - Number(e.balance)) > 0.005 || Math.abs(l.baseBalance - Number(e.baseBalance)) > 0.005) {
      throw new Error(`${label}: این ردیف توسط «بستن سال» ساخته شده است و قابل ویرایش نیست`);
    }
  }
  const systemKeys = new Set<string>(existing.map((e: any) => keyOf(e.cashBoxId, e.currencyId)));
  await tx.treasuryOpeningCashBox.deleteMany({ where: { openingId, isSystemGenerated: false } });
  for (const [i, l] of incoming.entries()) {
    if (systemKeys.has(keyOf(l.cashBoxId, l.currencyId))) {
      await tx.treasuryOpeningCashBox.update({ where: { openingId_cashBoxId_currencyId: { openingId, cashBoxId: l.cashBoxId, currencyId: l.currencyId } }, data: { rowOrder: i } });
    } else {
      await tx.treasuryOpeningCashBox.create({ data: { ...l, openingId, rowOrder: i } });
    }
  }
}

async function resolvePeriod(body: OpeningBody) {
  if (!body.date) throw new Error("تاریخ افتتاحیه الزامی است");
  const date = new Date(body.date);
  const period = body.fiscalPeriodId
    ? await prisma.fiscalPeriod.findUnique({ where: { id: body.fiscalPeriodId } })
    : await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
  if (!period) throw new Error("دوره مالی این تاریخ تعریف نشده است");
  if (date < period.fromDate || date > period.toDate) throw new Error("تاریخ افتتاحیه باید در بازه‌ی دوره مالی باشد");
  await assertDateWithinCurrentFiscalPeriod(date);
  return { date, period };
}

router.post("/treasury-openings", can(`${FORM}.create`), async (req, res) => {
  const body = req.body as OpeningBody;
  try {
    const { date, period } = await resolvePeriod(body);
    if (await withoutFiscalPeriodScope(() => prisma.treasuryOpening.findUnique({ where: { fiscalPeriodId: period.id } }))) {
      throw new Error("برای این دوره مالی قبلاً افتتاحیه ثبت شده است؛ همان را ویرایش کنید");
    }
    const base = await getBaseCurrency();
    const bankLines = await cleanBankLines(body.bankAccountLines, base.id);
    const cashLines = await cleanCashLines(body.cashBoxLines, base.id);

    const id = await prisma.$transaction(async (tx: any) => {
      const o = await tx.treasuryOpening.create({ data: { fiscalPeriodId: period.id, date } });
      for (const [i, l] of bankLines.entries()) await tx.treasuryOpeningBankAccount.create({ data: { ...l, openingId: o.id, rowOrder: i } });
      for (const [i, l] of cashLines.entries()) await tx.treasuryOpeningCashBox.create({ data: { ...l, openingId: o.id, rowOrder: i } });
      await syncCheques(tx, period.id, "RECEIVABLE", body.receivableCheques || [], base.id, "چک‌های دریافتی");
      await syncCheques(tx, period.id, "PAYABLE", body.payableCheques || [], base.id, "چک‌های پرداختی");
      return o.id;
    });
    res.status(201).json({ id });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.put("/treasury-openings/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as OpeningBody;
  const existing = await prisma.treasuryOpening.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "افتتاحیه یافت نشد" });
  try {
    assertRecordNotStale(existing.updatedAt, body.updatedAt, "این افتتاحیه");
    if (!body.date) throw new Error("تاریخ افتتاحیه الزامی است");
    const period = await prisma.fiscalPeriod.findUnique({ where: { id: existing.fiscalPeriodId } });
    const date = new Date(body.date);
    if (!period || date < period.fromDate || date > period.toDate) throw new Error("تاریخ افتتاحیه باید در بازه‌ی دوره مالی باشد");
    const base = await getBaseCurrency();
    const bankLines = await cleanBankLines(body.bankAccountLines, base.id);
    const cashLines = await cleanCashLines(body.cashBoxLines, base.id);

    await prisma.$transaction(async (tx: any) => {
      await syncBankLines(tx, id, bankLines);
      await syncCashLines(tx, id, cashLines);
      await syncCheques(tx, existing.fiscalPeriodId, "RECEIVABLE", body.receivableCheques || [], base.id, "چک‌های دریافتی");
      await syncCheques(tx, existing.fiscalPeriodId, "PAYABLE", body.payableCheques || [], base.id, "چک‌های پرداختی");
      await tx.treasuryOpening.update({ where: { id }, data: { date } });
    });
    res.json({ id });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.delete("/treasury-openings/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.treasuryOpening.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "افتتاحیه یافت نشد" });
  try {
    // رکوردهای خودکارِ «عملیات پایان دوره» فقط با «بازگشایی» همان بخش در دوره‌ی قبل حذف می‌شوند، نه با حذف افتتاحیه
    if (await isOpeningDeletionBlocked(existing)) {
      return res.status(400).json({ error: "این افتتاحیه (یا بخشی از آن) توسط «عملیات پایان دوره»ی سال قبل ایجاد شده و قابل حذف نیست؛ برای حذف آن‌ها بخش مربوطه را در «عملیات پایان دوره»ی سال قبل «بازگشایی» کنید" });
    }
    await prisma.$transaction(async (tx: any) => {
      await syncCheques(tx, existing.fiscalPeriodId, "RECEIVABLE", [], (await getBaseCurrency()).id, "چک‌های دریافتی");
      await syncCheques(tx, existing.fiscalPeriodId, "PAYABLE", [], (await getBaseCurrency()).id, "چک‌های پرداختی");
      await tx.treasuryOpening.delete({ where: { id } });
    });
    res.status(204).send();
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در حذف" });
  }
});

export default router;
