import { Router } from "express";
import { prisma } from "../lib/prisma";
import { assertDateNotConfirmed } from "../utils/journalEntryValidation";
import { assertWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { assertRecordNotStale } from "../utils/concurrency";
import { resolveVatRatePercent, computeLineVat } from "../utils/vatCalculation";
import { getVatRatePercentForDate } from "../services/accountingSettingsService";
import { toBaseCurrencyAmount, ConversionCurrency } from "../utils/currencyConversion";
import { issueJournalEntry, IssueLineInput } from "../services/journalEntryService";
import { resolveDetailTypeId, resolveAccountDetailFields } from "../utils/detailValues";
import { formatJalaliDateForMessage } from "../utils/jalaliDate";
import { can } from "../authz/guard";
import { allocateDocumentNumber, assertEditAllowed } from "../services/numberingPatternService";
import { findFormPrefix } from "../authz/registry";

const FORM = findFormPrefix("sales-return-invoices");

// =========================================================================
// ماژول «فروش» > عملیات > فاکتور برگشت از فروش
//
// طبق تصمیم صریح کاربر: این سند دقیقاً هم‌ساختار/هم‌رفتار فاکتور فروش (salesInvoices.ts) است، با
// جایگزینی «حواله فروش» (SALES_DELIVERY) با «برگشت از فروش» (سند انبار SALES_RETURN، نگاه کنید به
// routes/salesReturns.ts که طبق تصمیم صریح کاربر در این کار دست‌نخورده می‌ماند — فقط از آن خوانده
// می‌شود). مبنا/ارز/تخفیف/ارزش‌افزوده/عدم وجود اکشن تایید (صدور سند مستقیماً از وضعیت «ثبت») همه
// دقیقاً هم‌الگوی فاکتور فروش‌اند — نگاه کنید به یادداشت بالای آن فایل برای جزئیات کامل هرکدام. مدل
// (SalesReturnInvoice/SalesReturnInvoiceLine) کاملاً مستقل از SalesInvoice است (نه جدول مشترک، برخلاف
// PurchaseCostLine) چون کاربر این‌بار اشتراک جدول درخواست نداده بود.
//
// - تفاوت با فاکتور فروش در سند حسابداری دو جاست: (۱) طبق تصمیم صریح کاربر، جهت بدهکار/بستانکار
//   برعکس فاکتور فروش است — بستانکارِ «دریافتنی فروش» (کاهش مطالبات از مشتری) و بدهکارِ «ارزش‌افزوده
//   فروش» (کاهش بدهی مالیاتی). (۲) طبق تصمیم صریح کاربر (اصلاحیه‌ی بعدی)، به‌جای معین «درآمد فروش»
//   (که فاکتور فروش استفاده می‌کند)، اینجا معین اختصاصی «برگشت از فروش»
//   (GoodsAccountType.SALES_RETURN — تا پیش از این کار در schema تعریف شده بود ولی هیچ روتی به آن
//   ارجاع نمی‌داد) بدهکار می‌شود؛ نه یک نسخه‌ی برعکس‌شده‌ی «درآمد فروش». هر دو معین از قبل در فرم
//   «حسابداری کالا و خدمت» قابل‌تنظیم بودند (GoodsServiceAccounting.tsx، هیچ تغییری در آن فرم لازم
//   نبود).
// =========================================================================

const router = Router();

async function resolveFiscalPeriod(date: Date) {
  const fiscalPeriod = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
  if (!fiscalPeriod) throw new Error("این تاریخ در هیچ دوره مالی تعریف نشده است");
  await assertWithinCurrentFiscalPeriod(fiscalPeriod.id);
  await assertDateNotConfirmed(prisma, date, fiscalPeriod.id);
  return fiscalPeriod;
}

function partyDisplayName(party: any) {
  return party.category === "LEGAL" ? party.name : `${party.firstName || ""} ${party.lastName || ""}`.trim();
}

/** نرخ تبدیل ارز فاکتور را از بدنه‌ی درخواست resolve می‌کند — دقیقاً هم‌الگوی
 * salesInvoices.ts#resolveInvoiceFxRate. */
function resolveInvoiceFxRate(currencyId: number, baseCurrencyId: number, bodyFxRate: number | undefined): number {
  if (currencyId === baseCurrencyId) return 1;
  const fxRate = Number(bodyFxRate);
  if (!(fxRate > 0)) throw new Error("نرخ ارز الزامی است");
  return fxRate;
}

async function salesReturnLineRemaining(id: number, excludeInvoiceId?: number) {
  const line = await prisma.inventoryDocumentLine.findFirst({
    where: { id, document: { documentType: "SALES_RETURN" } },
    include: { document: true, salesReturnInvoiceLines: true },
  });
  if (!line) return null;
  const done = line.salesReturnInvoiceLines
    .filter((i: any) => !excludeInvoiceId || i.salesReturnInvoiceId !== excludeInvoiceId)
    .reduce((s: number, i: any) => s + Number(i.quantity), 0);
  const remaining = Number(line.quantity) - done;
  return { line, remaining };
}

interface LineInput {
  sourceInventoryLineId?: number | null;
  goodsItemId?: number | null;
  unitId?: number | null;
  quantity: number;
  unitPrice: number;
  amount: number;
  discount?: number;
  vatAmount?: number;
  description?: string | null;
}

async function validateLines(lines: LineInput[], basis: string, currency: ConversionCurrency, fxRate: number, baseCurrency: ConversionCurrency, docDate: Date, excludeInvoiceId?: number) {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("فاکتور برگشت از فروش باید حداقل یک ردیف کالا داشته باشد");

  const cleaned: {
    sourceInventoryLineId: number | null;
    goodsItemId: number;
    unitId: number;
    quantity: number;
    unitPrice: number;
    amount: number;
    discount: number;
    baseAmount: number;
    baseDiscount: number;
    vatAmount: number;
    description: string | null;
  }[] = [];

  for (const [idx, l] of lines.entries()) {
    const qty = Number(l.quantity);
    if (!(qty > 0)) throw new Error(`مقدار ردیف ${idx + 1} باید عددی مثبت باشد`);

    let goodsItemId = l.goodsItemId || 0;
    let unitId = l.unitId || 0;
    const unitPrice = Number(l.unitPrice) || 0;
    const amount = Number(l.amount) || 0;
    let sourceInventoryLineId: number | null = null;

    if (!(unitPrice >= 0)) throw new Error(`فی ردیف ${idx + 1} نامعتبر است`);
    if (!(amount >= 0)) throw new Error(`مبلغ ردیف ${idx + 1} نامعتبر است`);

    const discount = Number(l.discount) || 0;
    if (!(discount >= 0)) throw new Error(`تخفیف ردیف ${idx + 1} نامعتبر است`);
    if (discount > amount) throw new Error(`تخفیف ردیف ${idx + 1} نمی‌تواند از مبلغ ردیف بیشتر باشد`);

    if (basis === "SALES_RETURN") {
      if (!l.sourceInventoryLineId) throw new Error(`ردیف ${idx + 1}: انتخاب ردیف برگشت از فروش الزامی است`);
      const info = await salesReturnLineRemaining(l.sourceInventoryLineId, excludeInvoiceId);
      if (!info) throw new Error(`ردیف برگشت از فروش برای ردیف ${idx + 1} یافت نشد`);
      if (qty > info.remaining) throw new Error(`مقدار ردیف ${idx + 1} از باقیمانده‌ی قابل صورتحساب (${info.remaining}) بیشتر است`);
      sourceInventoryLineId = info.line.id;
      goodsItemId = info.line.goodsItemId;
      unitId = info.line.unitId;
    } else {
      if (!goodsItemId) throw new Error(`کالا برای ردیف ${idx + 1} الزامی است`);
    }

    const item = await prisma.goodsItem.findUnique({ where: { id: goodsItemId } });
    if (!item) throw new Error(`کالای ردیف ${idx + 1} یافت نشد`);
    if (item.kind !== "GOODS") throw new Error(`ردیف ${idx + 1}: فقط کالا قابل انتخاب است`);
    if (!unitId) unitId = item.mainUnitId;

    // مبلغ/تخفیف به ارز مبنا و ارزش‌افزوده — دقیقاً هم‌الگوی salesInvoices.ts#validateLines.
    const baseAmount = toBaseCurrencyAmount(amount, fxRate, currency, baseCurrency);
    const baseDiscount = toBaseCurrencyAmount(discount, fxRate, currency, baseCurrency);
    const vatRatePercent = resolveVatRatePercent(item, await getVatRatePercentForDate(docDate));
    const suggestedVatAmount = computeLineVat(baseAmount, baseDiscount, vatRatePercent);
    const vatAmount = l.vatAmount !== undefined && l.vatAmount !== null ? Number(l.vatAmount) : suggestedVatAmount;
    if (!(vatAmount >= 0)) throw new Error(`مالیات بر ارزش افزوده ردیف ${idx + 1} نامعتبر است`);

    cleaned.push({
      sourceInventoryLineId,
      goodsItemId,
      unitId,
      quantity: qty,
      unitPrice,
      amount,
      discount,
      baseAmount,
      baseDiscount,
      vatAmount,
      description: l.description || null,
    });
  }
  return cleaned;
}

// =========================================================================
// پیکر «باقیمانده» برگشت از فروش
// =========================================================================

router.get("/sales-return-invoices/pickable-sales-return-lines", can(`${FORM}.view`), async (req, res) => {
  const destDate = req.query.destDate ? new Date(req.query.destDate as string) : null;
  const excludeInvoiceId = req.query.excludeInvoiceId ? Number(req.query.excludeInvoiceId) : null;
  const lines = await prisma.inventoryDocumentLine.findMany({
    where: { document: { documentType: "SALES_RETURN", ...(destDate ? { date: { lte: destDate } } : {}) } },
    include: { document: true, goodsItem: true, unit: true, salesReturnInvoiceLines: true },
    orderBy: { id: "desc" },
  });
  const result = lines
    .map((l: any) => {
      const done = l.salesReturnInvoiceLines
        .filter((i: any) => !excludeInvoiceId || i.salesReturnInvoiceId !== excludeInvoiceId)
        .reduce((s: number, i: any) => s + Number(i.quantity), 0);
      const quantity = Number(l.quantity);
      const remaining = quantity - done;
      return {
        id: l.id,
        sourceInventoryLineId: l.id,
        salesReturnId: l.document.id,
        number: l.document.number,
        date: l.document.date,
        goodsItemId: l.goodsItemId,
        goodsItemCode: l.goodsItem.fullCode,
        goodsItemTitle: l.goodsItem.title,
        unitId: l.unitId,
        unitTitle: l.unit.title,
        quantity,
        done,
        remaining,
      };
    })
    .filter((r: any) => r.remaining > 0);
  res.json(result);
});

// =========================================================================
// CRUD
// =========================================================================

interface HeaderBody {
  date: string;
  basis: "NO_BASIS" | "SALES_RETURN";
  customerId: number;
  salesTypeId: number;
  salesCenterId: number;
  currencyId: number;
  fxRate?: number;
  description?: string;
  lines: LineInput[];
}

router.get("/sales-return-invoices", can(`${FORM}.view`), async (_req, res) => {
  const items = await prisma.salesReturnInvoice.findMany({
    include: { customer: { include: { party: true } }, salesType: true, salesCenter: true, fiscalPeriod: true, currency: true, journalEntry: true, lines: true },
    orderBy: { id: "desc" },
  });
  res.json(
    items.map((d: any) => ({
      id: d.id,
      number: d.number,
      date: d.date,
      basis: d.basis,
      customerId: d.customerId,
      customerTitle: partyDisplayName(d.customer.party),
      salesTypeId: d.salesTypeId,
      salesTypeTitle: d.salesType.title,
      salesCenterId: d.salesCenterId,
      salesCenterTitle: d.salesCenter.title,
      currencyTitle: d.currency.title,
      status: d.status,
      journalEntryReferenceNumber: d.journalEntry?.referenceNumber ?? null,
      lineCount: d.lines.length,
      totalAmount: d.lines.reduce((s: number, l: any) => s + Number(l.amount), 0),
    }))
  );
});

router.get("/sales-return-invoices/:id", can(`${FORM}.view`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.salesReturnInvoice.findUnique({
    where: { id },
    include: {
      customer: { include: { party: true } },
      salesType: true,
      salesCenter: true,
      fiscalPeriod: true,
      currency: true,
      journalEntry: true,
      lines: { include: { goodsItem: true, unit: true }, orderBy: { rowOrder: "asc" } },
    },
  });
  if (!d) return res.status(404).json({ error: "فاکتور برگشت از فروش یافت نشد" });
  res.json({
    id: d.id,
    number: d.number,
    date: d.date,
    basis: d.basis,
    customerId: d.customerId,
    customerTitle: partyDisplayName(d.customer.party),
    salesTypeId: d.salesTypeId,
    salesTypeTitle: d.salesType.title,
    salesCenterId: d.salesCenterId,
    salesCenterTitle: d.salesCenter.title,
    currencyId: d.currencyId,
    fxRate: Number(d.fxRate),
    fiscalPeriodId: d.fiscalPeriodId,
    description: d.description,
    status: d.status,
    journalEntryId: d.journalEntryId,
    journalEntryReferenceNumber: d.journalEntry?.referenceNumber ?? null,
    updatedAt: d.updatedAt,
    lines: d.lines.map((l: any) => ({
      id: l.id,
      sourceInventoryLineId: l.sourceInventoryLineId,
      goodsItemId: l.goodsItemId,
      goodsItemCode: l.goodsItem.fullCode,
      goodsItemTitle: l.goodsItem.title,
      unitId: l.unitId,
      unitTitle: l.unit.title,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      amount: Number(l.amount),
      discount: Number(l.discount),
      vatAmount: Number(l.vatAmount),
      description: l.description,
    })),
  });
});

router.post("/sales-return-invoices", can(`${FORM}.create`), async (req, res) => {
  const body = req.body as HeaderBody;
  if (!body.date || !body.basis || !body.customerId || !body.salesTypeId || !body.salesCenterId || !body.currencyId) {
    return res.status(400).json({ error: "تاریخ، مبنا، مشتری، نوع فروش، مرکز فروش و ارز الزامی است" });
  }
  try {
    const date = new Date(body.date);
    const fiscalPeriod = await resolveFiscalPeriod(date);
    const customer = await prisma.customer.findUnique({ where: { id: body.customerId } });
    if (!customer) throw new Error("مشتری یافت نشد");
    const salesType = await prisma.salesType.findUnique({ where: { id: body.salesTypeId } });
    if (!salesType) throw new Error("نوع فروش یافت نشد");
    const salesCenter = await prisma.salesCenter.findUnique({ where: { id: body.salesCenterId } });
    if (!salesCenter) throw new Error("مرکز فروش یافت نشد");
    const currency = await prisma.currency.findUnique({ where: { id: body.currencyId } });
    if (!currency) throw new Error("ارز یافت نشد");
    const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
    if (!baseCurrency) throw new Error("ارز پایه تعریف نشده است");
    const fxRate = resolveInvoiceFxRate(body.currencyId, baseCurrency.id, body.fxRate);

    const lines = await validateLines(body.lines, body.basis, currency, fxRate, baseCurrency, date);

    // شماره از «الگوی شماره‌گذاری» (اتمی، داخل همین تراکنش) می‌آید؛ اگر برای (نوع فروش، مرکز فروش) الگویی نباشد ذخیره ممنوع است.
    const created = await prisma.$transaction(async (tx: any) => {
      const allocated = await allocateDocumentNumber(tx, { form: "SALES_RETURN", salesTypeId: body.salesTypeId, salesCenterId: body.salesCenterId, fiscalPeriodId: fiscalPeriod.id, date });
      const number = allocated.number;
      return tx.salesReturnInvoice.create({
      data: {
        fiscalPeriodId: fiscalPeriod.id,
        number,
        numberingPatternId: allocated.numberingPatternId,
        date,
        basis: body.basis,
        customerId: body.customerId,
        salesTypeId: body.salesTypeId,
        salesCenterId: body.salesCenterId,
        currencyId: body.currencyId,
        fxRate,
        description: body.description || null,
        status: "DRAFT",
        lines: { create: lines.map((l, idx) => ({ ...l, rowOrder: idx })) },
      },
      });
    });
    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "شماره سند تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ثبت فاکتور برگشت از فروش" });
  }
});

router.put("/sales-return-invoices/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as HeaderBody;
  const existing = await prisma.salesReturnInvoice.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "یافت نشد" });
  if (existing.journalEntryId) return res.status(400).json({ error: "برای این فاکتور سند حسابداری صادر شده؛ ابتدا سند حسابداری را حذف کنید" });
  if (!body.date || !body.basis || !body.customerId || !body.salesTypeId || !body.salesCenterId || !body.currencyId) {
    return res.status(400).json({ error: "تاریخ، مبنا، مشتری، نوع فروش، مرکز فروش و ارز الزامی است" });
  }
  try {
    assertRecordNotStale(existing.updatedAt, req.body.updatedAt, "این فاکتور برگشت از فروش");
    const date = new Date(body.date);
    const fiscalPeriod = await resolveFiscalPeriod(date);
    const customer = await prisma.customer.findUnique({ where: { id: body.customerId } });
    if (!customer) throw new Error("مشتری یافت نشد");
    const salesType = await prisma.salesType.findUnique({ where: { id: body.salesTypeId } });
    if (!salesType) throw new Error("نوع فروش یافت نشد");
    const salesCenter = await prisma.salesCenter.findUnique({ where: { id: body.salesCenterId } });
    if (!salesCenter) throw new Error("مرکز فروش یافت نشد");
    const currency = await prisma.currency.findUnique({ where: { id: body.currencyId } });
    if (!currency) throw new Error("ارز یافت نشد");
    const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
    if (!baseCurrency) throw new Error("ارز پایه تعریف نشده است");
    const fxRate = resolveInvoiceFxRate(body.currencyId, baseCurrency.id, body.fxRate);

    const lines = await validateLines(body.lines, body.basis, currency, fxRate, baseCurrency, date, id);

    await prisma.$transaction(async (tx: any) => {
      await assertEditAllowed(tx, existing, { form: "SALES_RETURN", salesTypeId: body.salesTypeId, salesCenterId: body.salesCenterId, fiscalPeriodId: fiscalPeriod.id, date });
      await tx.salesReturnInvoiceLine.deleteMany({ where: { salesReturnInvoiceId: id } });
      await tx.salesReturnInvoice.update({
        where: { id },
        data: {
          fiscalPeriodId: fiscalPeriod.id,
          date,
          basis: body.basis,
          customerId: body.customerId,
          salesTypeId: body.salesTypeId,
          salesCenterId: body.salesCenterId,
          currencyId: body.currencyId,
          fxRate,
          description: body.description || null,
          lines: { create: lines.map((l, idx) => ({ ...l, rowOrder: idx })) },
        },
      });
    });
    res.json({ id });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.delete("/sales-return-invoices/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.salesReturnInvoice.findUnique({ where: { id } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.journalEntryId) return res.status(400).json({ error: "برای این فاکتور سند حسابداری صادر شده؛ ابتدا سند حسابداری را حذف کنید" });
  await prisma.salesReturnInvoice.delete({ where: { id } });
  res.status(204).send();
});

// =========================================================================
// صدور سند حسابداری — هم‌منطق salesInvoices.ts (همان کلید: گروه حسابداری ردیف + نوع فروش هدر)، با دو
// تفاوت طبق تصمیم صریح کاربر: بستانکار «دریافتنی فروش» (کاهش مطالبات مشتری) + بدهکار «برگشت از فروش»/
// «ارزش‌افزوده فروش» (کاهش بدهی مالیاتی) — یعنی هم جهت بدهکار/بستانکار برعکس فاکتور فروش است، هم معین
// بدهکارِ سطر کالا («درآمد فروش» در فاکتور فروش) اینجا معین اختصاصی «برگشت از فروش» است، نه همان معین
// درآمد.
// =========================================================================

router.post("/sales-return-invoices/:id/issue-journal-entry", can(`${FORM}.issueJournalEntry`), async (req, res) => {
  const id = Number(req.params.id);
  const invoice = await prisma.salesReturnInvoice.findUnique({
    where: { id },
    include: {
      customer: { include: { party: true } },
      salesType: true,
      currency: true,
      lines: { include: { goodsItem: true }, orderBy: { rowOrder: "asc" } },
    },
  });
  if (!invoice) return res.status(404).json({ error: "فاکتور برگشت از فروش یافت نشد" });
  if (invoice.journalEntryId) return res.status(400).json({ error: "قبلاً برای این فاکتور سند حسابداری صادر شده است" });

  try {
    const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
    if (!baseCurrency) throw new Error("ارز پایه تعریف نشده است");
    const fxRate = Number(invoice.fxRate);

    const partyDetailCode = invoice.customer.party.detailCode;
    const partyDetailTypeId = await resolveDetailTypeId(partyDetailCode);

    const accountingGroupIds = Array.from(new Set(invoice.lines.map((l) => l.goodsItem.accountingGroupId)));
    // طبق تصمیم صریح کاربر: «دریافتنی فروش» دیگر به گروه حسابداری وابسته نیست (فقط نوع فروش) — دقیقاً
    // هم‌الگوی salesInvoices.ts.
    const settings = await prisma.goodsServiceAccountingSetting.findMany({
      where: { OR: [{ accountingGroupId: { in: accountingGroupIds } }, { accountType: "SALES_RECEIVABLE" }] },
      include: { account: true },
    });
    function findSetting(accountingGroupId: number, accountType: string, match: (s: (typeof settings)[number]) => boolean) {
      return settings.find((s) => s.accountingGroupId === accountingGroupId && s.accountType === accountType && match(s));
    }
    function findReceivableSetting(match: (s: (typeof settings)[number]) => boolean) {
      return settings.find((s) => s.accountType === "SALES_RECEIVABLE" && match(s));
    }

    const customerName = partyDisplayName(invoice.customer.party) || "";
    const description = `بابت فاکتور برگشت از فروش ${invoice.number} ${formatJalaliDateForMessage(invoice.date)} ${customerName}`.trim();
    const vatDescription = `بابت ارزش‌افزوده فاکتور برگشت از فروش ${invoice.number} ${formatJalaliDateForMessage(invoice.date)} ${customerName}`.trim();

    const errors: string[] = [];
    // «دریافتنی فروش» دیگر به‌ازای هر ردیف/کالا متفاوت نیست (فقط یک بار، بر اساس نوع فروش هدر، بررسی می‌شود)
    const arSetting = findReceivableSetting((s) => s.salesTypeId === invoice.salesTypeId);
    if (!arSetting) {
      errors.push(`برای نوع فروش «${invoice.salesType.title}»، حساب «دریافتنی فروش» در حسابداری کالا و خدمت تعریف نشده است`);
    }

    // همان چهار سطلِ salesInvoices.ts (بدون جمع مبلغ ردیف و ارزش‌افزوده در یک سطل، حتی روی یک معین) —
    // فقط جهتشان در ساخت debitLines/creditLines پایین برعکس اعمال می‌شود.
    const arAmountByAccount = new Map<number, { amount: number; account: (typeof settings)[number]["account"] }>();
    const arVatByAccount = new Map<number, { amount: number; account: (typeof settings)[number]["account"] }>();
    const salesReturnByAccount = new Map<number, { amount: number; account: (typeof settings)[number]["account"] }>();
    const vatByAccount = new Map<number, { amount: number; account: (typeof settings)[number]["account"] }>();

    for (const line of invoice.lines) {
      if (!arSetting) break;
      const amount = Number(line.amount);
      const discount = Number(line.discount);
      const baseAmount = Number(line.baseAmount);
      const baseDiscount = Number(line.baseDiscount);
      const vatAmount = Number(line.vatAmount);
      const goodsItem = line.goodsItem;

      const salesReturnSetting = findSetting(goodsItem.accountingGroupId, "SALES_RETURN", (s) => s.salesTypeId === invoice.salesTypeId);
      if (!salesReturnSetting) {
        errors.push(`برای کالای «${goodsItem.title}» و نوع فروش «${invoice.salesType.title}»، حساب «برگشت از فروش» در حسابداری کالا و خدمت تعریف نشده است`);
        continue;
      }
      let vatSetting: (typeof settings)[number] | undefined;
      if (vatAmount > 0) {
        vatSetting = findSetting(goodsItem.accountingGroupId, "SALES_VAT", (s) => s.salesTypeId === invoice.salesTypeId);
        if (!vatSetting) {
          errors.push(`برای کالای «${goodsItem.title}» و نوع فروش «${invoice.salesType.title}»، حساب «ارزش‌افزوده فروش» در حسابداری کالا و خدمت تعریف نشده است`);
          continue;
        }
      }

      const netAmount = amount - discount;
      const netBaseAmount = baseAmount - baseDiscount;

      const arIsCurrency = arSetting.account.isCurrency;
      const arValue = arIsCurrency ? netAmount : netBaseAmount;
      const arExisting = arAmountByAccount.get(arSetting.accountId);
      if (arExisting) arExisting.amount += arValue;
      else arAmountByAccount.set(arSetting.accountId, { amount: arValue, account: arSetting.account });

      if (vatAmount > 0) {
        const arVatExisting = arVatByAccount.get(arSetting.accountId);
        if (arVatExisting) arVatExisting.amount += vatAmount;
        else arVatByAccount.set(arSetting.accountId, { amount: vatAmount, account: arSetting.account });
      }

      const srIsCurrency = salesReturnSetting.account.isCurrency;
      const srValue = srIsCurrency ? netAmount : netBaseAmount;
      const srExisting = salesReturnByAccount.get(salesReturnSetting.accountId);
      if (srExisting) srExisting.amount += srValue;
      else salesReturnByAccount.set(salesReturnSetting.accountId, { amount: srValue, account: salesReturnSetting.account });

      if (vatSetting) {
        const vatExisting = vatByAccount.get(vatSetting.accountId);
        if (vatExisting) vatExisting.amount += vatAmount;
        else vatByAccount.set(vatSetting.accountId, { amount: vatAmount, account: vatSetting.account });
      }
    }

    if (errors.length > 0) return res.status(400).json({ error: errors.join("\n") });

    // برعکسِ فاکتور فروش: «دریافتنی فروش» (مبلغ ردیف + ارزش‌افزوده) اینجا بستانکار می‌شود.
    const creditLines: IssueLineInput[] = [];
    for (const { amount, account } of arAmountByAccount.values()) {
      const details = resolveAccountDetailFields(account, partyDetailTypeId, partyDetailCode);
      const isCur = account.isCurrency;
      creditLines.push({
        accountId: account.id,
        ...details,
        currencyId: isCur ? invoice.currencyId : baseCurrency.id,
        debit: 0,
        credit: amount,
        fxRate: isCur ? fxRate : 1,
        description,
      });
    }
    for (const { amount, account } of arVatByAccount.values()) {
      const details = resolveAccountDetailFields(account, partyDetailTypeId, partyDetailCode);
      creditLines.push({
        accountId: account.id,
        ...details,
        currencyId: baseCurrency.id,
        debit: 0,
        credit: amount,
        fxRate: 1,
        description: vatDescription,
      });
    }

    // برعکسِ فاکتور فروش: «برگشت از فروش» (به‌جای «درآمد فروش»)/«ارزش‌افزوده فروش» اینجا بدهکار می‌شوند.
    const debitLines: IssueLineInput[] = [];
    for (const { amount, account } of salesReturnByAccount.values()) {
      const details = resolveAccountDetailFields(account, partyDetailTypeId, partyDetailCode);
      const isCur = account.isCurrency;
      debitLines.push({
        accountId: account.id,
        ...details,
        currencyId: isCur ? invoice.currencyId : baseCurrency.id,
        debit: amount,
        credit: 0,
        fxRate: isCur ? fxRate : 1,
        description,
      });
    }
    for (const { amount, account } of vatByAccount.values()) {
      const details = resolveAccountDetailFields(account, partyDetailTypeId, partyDetailCode);
      debitLines.push({
        accountId: account.id,
        ...details,
        currencyId: baseCurrency.id,
        debit: amount,
        credit: 0,
        fxRate: 1,
        description: vatDescription,
      });
    }

    const docType = await prisma.documentType.findFirst({ where: { systemKey: "SALES_RETURN_INVOICE" } });
    if (!docType) return res.status(400).json({ error: "نوع سند «فاکتور برگشت از فروش» در سیستم تعریف نشده است" });

    const entry = await issueJournalEntry({
      date: invoice.date,
      documentTypeId: docType.id,
      description,
      issuingSystem: "SALES",
      isManual: false,
      lines: [...debitLines, ...creditLines],
      sources: [{ label: `فاکتور برگشت از فروش شماره ${invoice.number}`, path: `/sales-return-invoices/${invoice.id}/edit` }],
    });

    await prisma.salesReturnInvoice.update({ where: { id }, data: { journalEntryId: entry.id } });

    res.json({ journalEntryId: entry.id, number: entry.number, referenceNumber: entry.referenceNumber, message: entry.message });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در صدور سند حسابداری" });
  }
});

router.delete("/sales-return-invoices/:id/journal-entry", can(`${FORM}.revertJournalEntry`), async (req, res) => {
  const id = Number(req.params.id);
  const invoice = await prisma.salesReturnInvoice.findUnique({ where: { id } });
  if (!invoice) return res.status(404).json({ error: "فاکتور برگشت از فروش یافت نشد" });
  if (!invoice.journalEntryId) return res.status(400).json({ error: "برای این فاکتور سندی صادر نشده است" });
  try {
    await prisma.$transaction([
      prisma.salesReturnInvoice.update({ where: { id }, data: { journalEntryId: null } }),
      prisma.journalEntry.delete({ where: { id: invoice.journalEntryId } }),
    ]);
    res.status(204).send();
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در حذف سند حسابداری" });
  }
});

export default router;
