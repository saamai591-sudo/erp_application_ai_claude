import { Router } from "express";
import { prisma } from "../lib/prisma";
import { resolveDocumentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { assertRecordNotStale } from "../utils/concurrency";
import { roundToCurrencyDecimals, fromBaseCurrencyAmount } from "../utils/currencyConversion";
import { EffectiveSettings } from "../services/goodsAccountingSettingService";
import { issueJournalEntry, IssueLineInput } from "../services/journalEntryService";
import { resolveDetailTypeId, resolveAccountDetailFields } from "../utils/detailValues";
import { findIssuingDocType } from "../services/documentTypeService";
import { formatJalaliDateForMessage } from "../utils/jalaliDate";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { getBaseCurrency } from "../services/baseCurrencyService";
import { partyTitle } from "../utils/partyTitle";

const FORM = findFormPrefix("purchase-returns");

// =========================================================================
// ماژول «زنجیره تامین» > عملیات > برگشت خرید
//
// سند مالیِ برگشت از فاکتور خرید. فقط بر مبنای ردیف‌های سند انبار «برگشت به تامین‌کننده» (SUPPLIER_RETURN، routes/supplierReturns.ts که دست‌نخورده می‌ماند)
// که خودشان به ردیف رسید انبارِ فاکتورشده برمی‌گردند (برگشت ← رسید ← فاکتور خرید). هر ردیفِ برگشت از خرید فقط در یک «برگشت خرید» می‌آید.
// مبلغ هیچ‌وقت دستی نیست: از ردیف فاکتور خریدِ همان رسید و با همان فرمول فاکتور فروش («مانده ÷ مانده × مقدار»: مبلغ اول، بعد فی با ۱۰ رقم) محاسبه و قفل می‌شود؛
// آخرین برگشتِ یک ردیف فاکتور دقیقاً باقی‌مانده را می‌گیرد. ارز، نرخ ارز و نوع خرید از همان فاکتور می‌آید؛ همه‌ی ردیف‌های یک برگشت خرید از یک فاکتور خریدند.
// وضعیتِ تایید ندارد (مثل فاکتور برگشت فروش): سند حسابداری مستقیماً از وضعیت «ثبت» صادر می‌شود.
// سند: بدهکار «پرداختنی خرید»، بستانکار «کنترل برگشت» (نوع حساب RETURN_CONTROL؛ حساب بدهکارِ سند انبارِ «برگشت به تامین‌کننده» باید همین حساب باشد) و «ارزش‌افزوده خرید».
// موجودی کالا فقط با سند انبار کم می‌شود؛ مابه‌التفاوتِ حساب «کنترل برگشت» را کاربر با سند دستی می‌بندد.
// =========================================================================

const router = Router();

const n = (v: any) => Number(v ?? 0);

interface ComputedLine {
  sourceInventoryLineId: number;
  purchaseInvoiceLineId: number;
  goodsItemId: number;
  unitId: number;
  goodsItemCode: string;
  goodsItemTitle: string;
  unitTitle: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  discount: number;
  baseAmount: number;
  baseDiscount: number;
  vatAmount: number;
  returnDocNumber: number;
  returnDocDate: Date;
}

/**
 * مبلغ ردیف‌های برگشت خرید از فاکتور خرید. ورودی = شناسه‌ی ردیف‌های سند «برگشت به تامین‌کننده» به ترتیب. تنها محل فرمول.
 * خروجی: ردیف‌های محاسبه‌شده + فاکتور مبنا (همه از یک فاکتور) — در صورت هر مشکل Error با پیام فارسی.
 */
async function computeLines(sourceIds: number[], excludeReturnId?: number) {
  if (!Array.isArray(sourceIds) || sourceIds.length === 0) throw new Error("برگشت خرید باید حداقل یک ردیف داشته باشد");
  if (new Set(sourceIds).size !== sourceIds.length) throw new Error("یک ردیف برگشت از خرید را فقط یک‌بار می‌توان انتخاب کرد");

  const baseCurrency = await getBaseCurrency();

  const srcs = await prisma.inventoryDocumentLine.findMany({
    where: { id: { in: sourceIds }, document: { documentType: "SUPPLIER_RETURN" } },
    include: {
      document: true,
      goodsItem: true,
      unit: true,
      purchaseReturnLine: true,
      sourceWarehouseReceiptLine: { include: { purchaseInvoiceLine: { include: { purchaseInvoice: { include: { currency: true, party: true } } } } } },
    },
  });
  const byId = new Map(srcs.map((s) => [s.id, s]));

  let invoice: any = null;
  const used = new Map<number, { qty: number; amount: number; discount: number; baseAmount: number; baseDiscount: number; vat: number }>();
  const out: ComputedLine[] = [];

  for (const [idx, id] of sourceIds.entries()) {
    const label = `ردیف ${idx + 1}`;
    const src = byId.get(id);
    if (!src) throw new Error(`${label}: ردیف سند «برگشت به تامین‌کننده» یافت نشد`);
    if (src.purchaseReturnLine && src.purchaseReturnLine.purchaseReturnId !== excludeReturnId) throw new Error(`${label}: این ردیف برگشت از خرید قبلاً در یک برگشت خرید آمده است`);
    const invLine = src.sourceWarehouseReceiptLine?.purchaseInvoiceLine;
    if (!invLine) throw new Error(`${label}: رسید انبارِ این ردیف هنوز در هیچ فاکتور خریدی نیامده است؛ ابتدا فاکتور خرید رسید را ثبت کنید`);
    const inv = invLine.purchaseInvoice;
    if (inv.status !== "APPROVED") throw new Error(`${label}: فاکتور خرید ${inv.number} (مبنای این رسید) هنوز تایید نشده است`);
    if (invoice && invoice.id !== inv.id) throw new Error(`${label}: همه‌ی ردیف‌های یک برگشت خرید باید از یک فاکتور خرید باشند (فاکتور ${inv.number} با فاکتور ${invoice.number} فرق دارد)`);
    invoice = inv;

    // تجمیع قبلی این ردیف فاکتور: برگشت‌های دیگر (غیر از همین سند در حال ویرایش) + ردیف‌های قبلیِ همین درخواست
    if (!used.has(invLine.id)) {
      const agg = await prisma.purchaseReturnLine.aggregate({
        where: { purchaseInvoiceLineId: invLine.id, ...(excludeReturnId ? { purchaseReturnId: { not: excludeReturnId } } : {}) },
        _sum: { quantity: true, amount: true, discount: true, baseAmount: true, baseDiscount: true, vatAmount: true },
      });
      used.set(invLine.id, { qty: n(agg._sum.quantity), amount: n(agg._sum.amount), discount: n(agg._sum.discount), baseAmount: n(agg._sum.baseAmount), baseDiscount: n(agg._sum.baseDiscount), vat: n(agg._sum.vatAmount) });
    }
    const u = used.get(invLine.id)!;
    const remQty = n(invLine.quantity) - u.qty;
    const qty = n(src.quantity);
    if (!(qty > 0)) throw new Error(`${label}: مقدار نامعتبر است`);
    if (qty > remQty + 1e-9) throw new Error(`${label}: مقدار برگشتی (${qty}) از باقیمانده‌ی قابل برگشتِ ردیف فاکتور خرید (${remQty}) بیشتر است`);

    const dp = inv.currency.decimalPlaces;
    const bdp = baseCurrency.decimalPlaces;
    const last = Math.abs(qty - remQty) < 1e-9; // آخرین برگشت: دقیقاً باقی‌مانده (بدون خطای گرد کردن)
    const share = (total: number, usedSum: number, decimals: number) => (last ? roundToCurrencyDecimals(total - usedSum, decimals) : roundToCurrencyDecimals(((total - usedSum) / remQty) * qty, decimals));
    const amount = share(n(invLine.amount), u.amount, dp);
    const discount = share(n(invLine.discount), u.discount, dp);
    const baseAmount = share(n(invLine.baseAmount), u.baseAmount, bdp);
    const baseDiscount = share(n(invLine.baseDiscount), u.baseDiscount, bdp);
    const vatAmount = share(n(invLine.vatAmount), u.vat, bdp);
    const unitPrice = roundToCurrencyDecimals(amount / qty, 10);
    u.qty += qty;
    u.amount += amount;
    u.discount += discount;
    u.baseAmount += baseAmount;
    u.baseDiscount += baseDiscount;
    u.vat += vatAmount;

    out.push({
      sourceInventoryLineId: src.id,
      purchaseInvoiceLineId: invLine.id,
      goodsItemId: src.goodsItemId,
      unitId: src.unitId,
      goodsItemCode: src.goodsItem.fullCode,
      goodsItemTitle: src.goodsItem.title,
      unitTitle: src.unit.title,
      quantity: qty,
      unitPrice,
      amount,
      discount,
      baseAmount,
      baseDiscount,
      vatAmount,
      returnDocNumber: src.document.number,
      returnDocDate: src.document.date,
    });
  }
  return { lines: out, invoice: invoice! };
}

function assertDateAfterBases(date: Date, lines: ComputedLine[], invoice: any) {
  if (invoice.date > date) throw new Error(`تاریخ برگشت خرید نمی‌تواند قبل از تاریخ فاکتور خرید مبنا (${formatJalaliDateForMessage(invoice.date)}) باشد`);
  const late = lines.find((l) => l.returnDocDate > date);
  if (late) throw new Error(`تاریخ برگشت خرید نمی‌تواند قبل از تاریخ سند «برگشت به تامین‌کننده» شماره ${late.returnDocNumber} (${formatJalaliDateForMessage(late.returnDocDate)}) باشد`);
}

const lineShape = (l: ComputedLine) => ({
  sourceInventoryLineId: l.sourceInventoryLineId,
  purchaseInvoiceLineId: l.purchaseInvoiceLineId,
  goodsItemCode: l.goodsItemCode,
  goodsItemTitle: l.goodsItemTitle,
  unitTitle: l.unitTitle,
  quantity: l.quantity,
  unitPrice: l.unitPrice,
  amount: l.amount,
  discount: l.discount,
  vatAmount: l.vatAmount,
  returnDocNumber: l.returnDocNumber,
});

// ردیف‌های قابل‌انتخاب: ردیف‌های «برگشت به تامین‌کننده»ی همین طرف مقابل که هنوز در برگشت خریدی نیامده‌اند و رسیدشان فاکتورِ تاییدشده دارد
router.get("/purchase-returns/pickable-lines", can(`${FORM}.view`), async (req, res) => {
  const partyId = req.query.partyId ? Number(req.query.partyId) : null;
  const excludeReturnId = req.query.excludeReturnId ? Number(req.query.excludeReturnId) : null;
  const formDate = req.query.date ? new Date(req.query.date as string) : null;
  if (!partyId || !formDate || isNaN(formDate.getTime())) return res.json([]);
  const party = await prisma.party.findUnique({ where: { id: partyId } });
  if (!party) return res.json([]);
  const lines = await prisma.inventoryDocumentLine.findMany({
    where: {
      document: { documentType: "SUPPLIER_RETURN", detailCode: party.detailCode, date: { lte: formDate } },
      sourceWarehouseReceiptLine: { purchaseInvoiceLine: { purchaseInvoice: { status: "APPROVED" } } },
      OR: [{ purchaseReturnLine: null }, ...(excludeReturnId ? [{ purchaseReturnLine: { purchaseReturnId: excludeReturnId } }] : [])],
    },
    include: {
      document: true,
      goodsItem: true,
      unit: true,
      sourceWarehouseReceiptLine: { include: { purchaseInvoiceLine: { include: { purchaseInvoice: { select: { id: true, number: true } } } } } },
    },
    orderBy: [{ document: { date: "asc" } }, { documentId: "asc" }, { rowOrder: "asc" }],
    take: 2000,
  });
  res.json(
    lines.map((l) => ({
      id: l.id,
      number: l.document.number,
      date: l.document.date,
      goodsItemCode: l.goodsItem.fullCode,
      goodsItemTitle: l.goodsItem.title,
      unitTitle: l.unit.title,
      quantity: n(l.quantity),
      remaining: n(l.quantity),
      invoiceId: l.sourceWarehouseReceiptLine?.purchaseInvoiceLine?.purchaseInvoice.id ?? null,
      invoiceNumber: l.sourceWarehouseReceiptLine?.purchaseInvoiceLine?.purchaseInvoice.number ?? null,
    }))
  );
});

// پیش‌نمایشِ مبلغ‌ها برای فرم (فقط‌خواندنی؛ همان تابع ذخیره)
router.post("/purchase-returns/preview", can(`${FORM}.view`), async (req, res) => {
  try {
    const c = await computeLines((req.body?.sourceInventoryLineIds as number[]) ?? [], req.body?.excludeReturnId ? Number(req.body.excludeReturnId) : undefined);
    res.json({
      invoiceId: c.invoice.id,
      invoiceNumber: c.invoice.number,
      currencyTitle: c.invoice.currency.title,
      lines: c.lines.map(lineShape),
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get("/purchase-returns", can(`${FORM}.view`), async (_req, res) => {
  const rows = await prisma.purchaseReturn.findMany({
    include: { party: true, currency: true, purchaseInvoice: { select: { number: true } }, journalEntry: { select: { referenceNumber: true } }, lines: { select: { amount: true, discount: true, vatAmount: true, baseAmount: true, baseDiscount: true } } },
    orderBy: [{ date: "desc" }, { number: "desc" }],
  });
  res.json(
    rows.map((r) => ({
      id: r.id,
      number: r.number,
      date: r.date,
      partyTitle: partyTitle(r.party),
      invoiceNumber: r.purchaseInvoice.number,
      currencyTitle: r.currency.title,
      lineCount: r.lines.length,
      totalAmount: r.lines.reduce((s, l) => s + n(l.amount) - n(l.discount), 0),
      journalEntryId: r.journalEntryId,
      journalEntryReferenceNumber: r.journalEntry?.referenceNumber ?? null,
    }))
  );
});

router.get("/purchase-returns/:id", can(`${FORM}.view`), async (req, res) => {
  const id = Number(req.params.id);
  const r = await prisma.purchaseReturn.findUnique({
    where: { id },
    include: {
      party: true,
      currency: true,
      purchaseInvoice: { select: { id: true, number: true, vendorInvoiceNumber: true } },
      lines: { include: { goodsItem: true, unit: true, sourceInventoryLine: { include: { document: { select: { number: true } } } } }, orderBy: { rowOrder: "asc" } },
    },
  });
  if (!r) return res.status(404).json({ error: "برگشت خرید یافت نشد" });
  res.json({
    id: r.id,
    number: r.number,
    date: r.date,
    partyId: r.partyId,
    partyTitle: partyTitle(r.party),
    invoiceId: r.purchaseInvoice.id,
    invoiceNumber: r.purchaseInvoice.number,
    currencyTitle: r.currency.title,
    fxRate: n(r.fxRate),
    description: r.description,
    journalEntryId: r.journalEntryId,
    updatedAt: r.updatedAt,
    lines: r.lines.map((l) => ({
      sourceInventoryLineId: l.sourceInventoryLineId,
      goodsItemCode: l.goodsItem.fullCode,
      goodsItemTitle: l.goodsItem.title,
      unitTitle: l.unit.title,
      quantity: n(l.quantity),
      unitPrice: n(l.unitPrice),
      amount: n(l.amount),
      discount: n(l.discount),
      vatAmount: n(l.vatAmount),
      returnDocNumber: l.sourceInventoryLine.document.number,
      description: l.description,
    })),
  });
});

interface Body {
  date: string;
  partyId: number;
  description?: string;
  lines: { sourceInventoryLineId: number; description?: string }[];
}

async function buildData(body: Body, excludeReturnId?: number) {
  const date = new Date(body.date);
  if (isNaN(date.getTime())) throw new Error("تاریخ نامعتبر است");
  const fiscalPeriod = await resolveDocumentFiscalPeriod(date);
  const party = await prisma.party.findUnique({ where: { id: Number(body.partyId) } });
  if (!party) throw new Error("طرف مقابل یافت نشد");
  const { lines, invoice } = await computeLines((body.lines ?? []).map((l) => Number(l.sourceInventoryLineId)), excludeReturnId);
  if (invoice.partyId !== party.id) throw new Error("طرف مقابل برگشت خرید باید همان طرف مقابل فاکتور خرید مبنا باشد");
  assertDateAfterBases(date, lines, invoice);
  const descOf = new Map((body.lines ?? []).map((l) => [Number(l.sourceInventoryLineId), l.description?.trim() || null]));
  return {
    date,
    fiscalPeriodId: fiscalPeriod.id,
    partyId: party.id,
    purchaseInvoiceId: invoice.id,
    currencyId: invoice.currencyId,
    fxRate: invoice.fxRate,
    description: body.description?.trim() || null,
    lines: lines.map((l, i) => ({
      rowOrder: i,
      sourceInventoryLineId: l.sourceInventoryLineId,
      purchaseInvoiceLineId: l.purchaseInvoiceLineId,
      goodsItemId: l.goodsItemId,
      unitId: l.unitId,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      amount: l.amount,
      discount: l.discount,
      baseAmount: l.baseAmount,
      baseDiscount: l.baseDiscount,
      vatAmount: l.vatAmount,
      description: descOf.get(l.sourceInventoryLineId) ?? null,
    })),
  };
}

router.post("/purchase-returns", can(`${FORM}.create`), async (req, res) => {
  try {
    const d = await buildData(req.body);
    const created = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(7100080, ${d.fiscalPeriodId}::int)`;
      const last = await tx.purchaseReturn.findFirst({ where: { fiscalPeriodId: d.fiscalPeriodId }, orderBy: { number: "desc" }, select: { number: true } });
      const { lines, ...head } = d;
      return tx.purchaseReturn.create({ data: { ...head, number: (last?.number ?? 0) + 1, lines: { create: lines } } });
    });
    res.status(201).json({ id: created.id, number: created.number });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ثبت برگشت خرید" });
  }
});

router.put("/purchase-returns/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.purchaseReturn.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "برگشت خرید یافت نشد" });
  try {
    assertRecordNotStale(existing.updatedAt, req.body.updatedAt, "برگشت خرید");
    if (existing.journalEntryId) throw new Error("برای این برگشت خرید سند حسابداری صادر شده؛ ابتدا سند را حذف کنید");
    const d = await buildData(req.body, id);
    if (d.fiscalPeriodId !== existing.fiscalPeriodId) throw new Error("تاریخ باید در همان دوره مالی برگشت خرید بماند");
    await prisma.$transaction(async (tx) => {
      await tx.purchaseReturnLine.deleteMany({ where: { purchaseReturnId: id } });
      const { lines, ...head } = d;
      await tx.purchaseReturn.update({ where: { id }, data: { ...head, lines: { create: lines } } });
    });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ویرایش برگشت خرید" });
  }
});

router.delete("/purchase-returns/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.purchaseReturn.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "برگشت خرید یافت نشد" });
  if (existing.journalEntryId) return res.status(400).json({ error: "برای این برگشت خرید سند حسابداری صادر شده؛ ابتدا سند حسابداری را حذف کنید" });
  try {
    await resolveDocumentFiscalPeriod(existing.date);
    await prisma.purchaseReturn.delete({ where: { id } });
    res.status(204).send();
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در حذف برگشت خرید" });
  }
});

// سند حسابداری برگشت خرید (قرینه‌ی سند فاکتور خرید): بدهکار «پرداختنی خرید» (خالص + ارزش‌افزوده)، بستانکار «کنترل برگشت» (خالص) و «ارزش‌افزوده خرید».
// «کنترل برگشت» نوع حسابِ جدا در حسابداری کالا و خدمت است (به‌ازای گروه حسابداری)؛ سند انبارِ «برگشت به تامین‌کننده» هم همین حساب را بدهکار می‌کند (issueWarehouseJournalEntries.ts)، پس دو سند خودبه‌خود تهاتر می‌شوند.
// منطق صدور سند در یک تابع نام‌دار تا کار زمان‌بندی‌شده‌ی «صدور سند حسابداری» (jobs/issuers) دقیقاً همین را صدا بزند
export async function issuePurchaseReturnJournalHandler(req: any, res: any) {
  const id = Number(req.params.id);
  const ret = await prisma.purchaseReturn.findUnique({
    where: { id },
    include: { party: true, currency: true, purchaseInvoice: { include: { purchaseType: true } }, lines: { include: { goodsItem: true }, orderBy: { rowOrder: "asc" } } },
  });
  if (!ret) return res.status(404).json({ error: "برگشت خرید یافت نشد" });
  if (ret.journalEntryId) return res.status(400).json({ error: "قبلاً برای این برگشت خرید سند حسابداری صادر شده است" });
  try {
    const baseCurrency = await getBaseCurrency();
    const fxRate = n(ret.fxRate);
    const invoice = ret.purchaseInvoice;
    const partyDetailCode = ret.party.detailCode;
    const partyDetailTypeId = await resolveDetailTypeId(partyDetailCode);

    const groupIds = Array.from(new Set(ret.lines.map((l) => l.goodsItem.accountingGroupId)));
    const settings = await prisma.goodsServiceAccountingSetting.findMany({ where: { OR: [{ accountingGroupId: { in: groupIds } }, { accountType: "PURCHASE_PAYABLE" }] }, include: { account: true } });
    const eff = new EffectiveSettings(settings as any[]);
    const docDate: Date = ret.date;
    const findGroupSetting = (groupId: number, type: string, match: (s: any) => boolean) =>
      eff.find(docDate, (s: any) => s.accountingGroupId === groupId && s.accountType === type && match(s)) as (typeof settings)[number] | undefined;
    const payable = eff.find(docDate, (s: any) => s.accountType === "PURCHASE_PAYABLE" && s.purchaseTypeId === invoice.purchaseTypeId) as (typeof settings)[number] | undefined;

    const errors: string[] = [];
    if (!payable) errors.push(`برای نوع خرید «${invoice.purchaseType.title}»، حساب «پرداختنی خرید» در حسابداری کالا و خدمت تعریف نشده است`);

    const description = `بابت برگشت خرید ${ret.number} ${formatJalaliDateForMessage(ret.date)} ${partyTitle(ret.party)}`.trim();
    const controlByAccount = new Map<number, { amount: number; baseAmount: number; account: any }>();
    const vatByAccount = new Map<number, { amount: number; account: any }>();
    let payAmount = 0;
    let payBase = 0;
    for (const line of ret.lines) {
      const net = n(line.amount) - n(line.discount);
      const netBase = n(line.baseAmount) - n(line.baseDiscount);
      const vat = n(line.vatAmount);
      const control = findGroupSetting(line.goodsItem.accountingGroupId, "RETURN_CONTROL", () => true);
      if (!control) {
        errors.push(`برای کالای «${line.goodsItem.title}»، حساب «کنترل برگشت» در حسابداری کالا و خدمت تعریف نشده است`);
        continue;
      }
      let vatSetting: (typeof settings)[number] | undefined;
      if (vat > 0) {
        vatSetting = findGroupSetting(line.goodsItem.accountingGroupId, "PURCHASE_VAT", (s) => s.purchaseTypeId === invoice.purchaseTypeId);
        if (!vatSetting) {
          errors.push(`برای کالای «${line.goodsItem.title}» و نوع خرید «${invoice.purchaseType.title}»، حساب «ارزش‌افزوده خرید» در حسابداری کالا و خدمت تعریف نشده است`);
          continue;
        }
      }
      const c = controlByAccount.get(control.accountId);
      if (c) {
        c.amount += net;
        c.baseAmount += netBase;
      } else controlByAccount.set(control.accountId, { amount: net, baseAmount: netBase, account: control.account });
      if (vatSetting) {
        const v = vatByAccount.get(vatSetting.accountId);
        if (v) v.amount += vat;
        else vatByAccount.set(vatSetting.accountId, { amount: vat, account: vatSetting.account });
      }
      payAmount += net + (vat > 0 ? fromBaseCurrencyAmount(vat, fxRate, ret.currency) : 0);
      payBase += netBase + vat;
    }
    if (errors.length > 0) return res.status(400).json({ error: Array.from(new Set(errors)).join("\n") });

    const lines: IssueLineInput[] = [];
    const payIsCur = payable!.account.isCurrency;
    lines.push({
      accountId: payable!.accountId,
      ...resolveAccountDetailFields(payable!.account, partyDetailTypeId, partyDetailCode),
      currencyId: payIsCur ? invoice.currencyId : baseCurrency.id,
      debit: payIsCur ? roundToCurrencyDecimals(payAmount, ret.currency.decimalPlaces) : roundToCurrencyDecimals(payBase, baseCurrency.decimalPlaces),
      credit: 0,
      fxRate: payIsCur ? fxRate : 1,
      description,
    });
    for (const { amount, baseAmount, account } of controlByAccount.values()) {
      const isCur = account.isCurrency;
      lines.push({
        accountId: account.id,
        ...resolveAccountDetailFields(account, partyDetailTypeId, partyDetailCode),
        currencyId: isCur ? invoice.currencyId : baseCurrency.id,
        debit: 0,
        credit: isCur ? roundToCurrencyDecimals(amount, ret.currency.decimalPlaces) : roundToCurrencyDecimals(baseAmount, baseCurrency.decimalPlaces),
        fxRate: isCur ? fxRate : 1,
        description,
      });
    }
    for (const { amount, account } of vatByAccount.values()) {
      lines.push({
        accountId: account.id,
        ...resolveAccountDetailFields(account, partyDetailTypeId, partyDetailCode),
        currencyId: baseCurrency.id,
        debit: 0,
        credit: roundToCurrencyDecimals(amount, baseCurrency.decimalPlaces),
        fxRate: 1,
        description,
      });
    }

    const docType = await findIssuingDocType("PURCHASE_RETURN");
    if (!docType) return res.status(400).json({ error: "نوع سند «برگشت خرید» در سیستم تعریف نشده است" });
    const entry = await issueJournalEntry({
      date: ret.date,
      documentTypeId: docType.id,
      description,
      issuingSystem: "PURCHASE",
      isManual: false,
      lines,
      sources: [{ label: `برگشت خرید شماره ${ret.number}`, path: `/purchase-returns/${ret.id}/edit` }],
    });
    await eff.markUsed(entry.id);
    await prisma.purchaseReturn.update({ where: { id }, data: { journalEntryId: entry.id } });
    res.json({ journalEntryId: entry.id, number: entry.number, referenceNumber: entry.referenceNumber, message: entry.message });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در صدور سند حسابداری" });
  }
}
router.post("/purchase-returns/:id/issue-journal-entry", can(`${FORM}.issueJournalEntry`), issuePurchaseReturnJournalHandler);

router.delete("/purchase-returns/:id/journal-entry", can(`${FORM}.revertJournalEntry`), async (req, res) => {
  const id = Number(req.params.id);
  const ret = await prisma.purchaseReturn.findUnique({ where: { id } });
  if (!ret) return res.status(404).json({ error: "برگشت خرید یافت نشد" });
  if (!ret.journalEntryId) return res.status(400).json({ error: "برای این برگشت خرید سندی صادر نشده است" });
  try {
    await prisma.$transaction([prisma.purchaseReturn.update({ where: { id }, data: { journalEntryId: null } }), prisma.journalEntry.delete({ where: { id: ret.journalEntryId } })]);
    res.status(204).send();
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در حذف سند حسابداری" });
  }
});

export default router;
