import { Router } from "express";
import { prisma } from "../lib/prisma";
import { assertDateNotConfirmed } from "../utils/journalEntryValidation";
import { assertWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { assertRecordNotStale } from "../utils/concurrency";
import { resolveVatRatePercent, computeLineVat } from "../utils/vatCalculation";
import { toBaseCurrencyAmount, ConversionCurrency } from "../utils/currencyConversion";
import { issueJournalEntry, IssueLineInput } from "../services/journalEntryService";
import { resolveDetailTypeId, resolveAccountDetailFields } from "../utils/detailValues";
import { formatJalaliDateForMessage } from "../utils/jalaliDate";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

const FORM = findFormPrefix("sales-invoices");

// =========================================================================
// ماژول «فروش» > عملیات > فاکتور فروش نهایی
//
// این سند هیچ مستند تحلیل اختصاصی در پروژه ندارد؛ ساختار زیر حاصل بحث و تصمیم‌گیری مشترک با کاربر
// است، با الگوبرداری از «فاکتور خرید» (سند مشابه در زنجیره خرید) با یک تفاوت کلیدی صریح:
// - مبنا: بدون مبنا / حواله فروش. برخلاف فاکتور خرید (که هر ردیف رسید انبار خرید را دقیقاً یک‌بار و
//   کامل مصرف می‌کرد — قید @@unique در schema)، اینجا طبق تصمیم صریح کاربر رابطه «مانده‌ای» است:
//   مشتری ممکن است طی چند حواله فروش (مثلاً چند مرسوله کوچک) یک فاکتور بگیرد یا برعکس، یک حواله طی
//   چند فاکتور جداگانه صورتحساب شود — پس sourceInventoryLineId نال‌پذیر و بدون @@unique است و
//   با الگوی استاندارد «باقیمانده» (مثل بقیه‌ی زنجیره خرید/فروش) کنترل می‌شود.
// - فقط حواله‌های «قطعی»‌شده قابل صورتحساب هستند (حواله در وضعیت ثبت هنوز واقعاً از انبار خارج نشده).
// - فی/مبلغ برخلاف حواله فروش، اینجا توسط کاربر وارد می‌شود (چه در ردیف بدون مبنا چه در ردیف مبتنی بر
//   حواله فروش — چون حواله فروش خودش فی صفر دارد) — دقیقاً مثل فاکتور خرید.
// - بدون اکشن تایید در این فاز (طبق تصمیم صریح کاربر، مشابه فاکتور خرید): وضعیت همیشه «ثبت» می‌ماند؛
//   به همین دلیل هیچ مسیر approve/unapprove‌ای در این فایل تعریف نشده است.
// - نوع فروش/نرخ ارز/ارزش‌افزوده: طبق تصمیم صریح کاربر (۱۴۰۵/۰۶/۱۷)، دقیقاً هم‌معماری PurchaseInvoice
//   پیاده شده‌اند — هدر «نوع فروش» (salesTypeId، الزامی) + fxRate دستی (نه از جدول نرخ ارز، اگر ارز
//   فاکتور همان ارز مبنا باشد همیشه ۱ ذخیره می‌شود)، هر ردیف baseAmount/baseDiscount/vatAmount (طبق
//   utils/vatCalculation.ts، فقط برای بایگانی/محاسبه، در UI/پاسخ API نمی‌آیند).
// - صدور سند حسابداری: طبق Documents/SaleInvoiceVoucher.md و تصمیم صریح کاربر (۱۴۰۵/۰۶/۱۸) — برخلاف
//   فاکتور خرید/فاکتور خرید خدمات (که هر دو نیازمند «تایید» قبل از صدور سند هستند)، اینجا چون اصلاً
//   وضعیت «تایید» وجود ندارد، صدور سند مستقیماً از همان وضعیت «ثبت» انجام می‌شود (فقط با شرط این‌که
//   قبلاً سندی صادر نشده باشد). با صدور سند، ویرایش/حذف فاکتور قفل می‌شود (نگاه کنید به PUT/DELETE).
//   ساختار سند (طبق تصمیم صریح کاربر در همان مستند، هر دو سوال زیر را با «بله» تایید کرد):
//     • بدهکار «دریافتنی فروش» (هم مبلغ ردیف و هم ارزش‌افزوده‌اش) با گروه حسابداری ردیف + نوع فروش
//       هدر کلید می‌خورد — دقیقاً هم‌الگوی بستانکار «درآمد فروش»/«ارزش‌افزوده فروش» (نه فقط گروه
//       حسابداری تنها، برخلاف برداشت اولیه از عبارت مستند).
//     • مبلغ ردیف/ارزش‌افزوده هرگز در یک خط سند با هم جمع نمی‌شوند، حتی وقتی هر دو روی یک معین
//       می‌نشینند (طبق «Aggregation rule» مستند) — ارزش‌افزوده همیشه به ارز مبنا، مبلغ ردیف به ارز
//       فاکتور اگر معین ارزی باشد وگرنه به ارز مبنا.
//     • قاعده‌ی «اگر بدهکار محاسبه‌شده منفی بود، به‌صورت بستانکار مثبت ثبت شود (و برعکس)» به‌عنوان یک
//       قاعده‌ی عمومی در journalEntryService.ts#issueJournalEntry پیاده شده، نه اینجا (طبق تصریح خودِ
//       مستند: «باید در کل سیستم اعمال شود»).
// =========================================================================

const router = Router();

async function resolveFiscalPeriod(date: Date) {
  const fiscalPeriod = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
  if (!fiscalPeriod) throw new Error("این تاریخ در هیچ دوره مالی تعریف نشده است");
  await assertWithinCurrentFiscalPeriod(fiscalPeriod.id);
  await assertDateNotConfirmed(prisma, date, fiscalPeriod.id);
  return fiscalPeriod;
}

async function nextNumber(model: { findFirst: (args: any) => Promise<any> }, fiscalPeriodId: number) {
  const last = await model.findFirst({ where: { fiscalPeriodId }, orderBy: { number: "desc" } });
  return last ? last.number + 1 : 1;
}

function partyDisplayName(party: any) {
  return party.category === "LEGAL" ? party.name : `${party.firstName || ""} ${party.lastName || ""}`.trim();
}

/** نرخ تبدیل ارز فاکتور را از بدنه‌ی درخواست resolve می‌کند — دقیقاً هم‌الگوی
 * purchaseInvoices.ts#resolveInvoiceFxRate: اگر ارز فاکتور همان ارز مبنا باشد همیشه ۱ برمی‌گردد، وگرنه
 * نرخ باید توسط کاربر وارد شده باشد (اجباری، بزرگ‌تر از صفر)، نه از جدول نرخ ارز. */
function resolveInvoiceFxRate(currencyId: number, baseCurrencyId: number, bodyFxRate: number | undefined): number {
  if (currencyId === baseCurrencyId) return 1;
  const fxRate = Number(bodyFxRate);
  if (!(fxRate > 0)) throw new Error("نرخ ارز الزامی است");
  return fxRate;
}

async function salesDeliveryLineRemaining(id: number, excludeInvoiceId?: number) {
  const line = await prisma.inventoryDocumentLine.findFirst({
    where: { id, document: { documentType: "SALES_DELIVERY" } },
    include: { document: true, salesInvoiceLines: true },
  });
  if (!line) return null;
  const done = line.salesInvoiceLines
    .filter((i: any) => !excludeInvoiceId || i.salesInvoiceId !== excludeInvoiceId)
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

async function validateLines(lines: LineInput[], basis: string, currency: ConversionCurrency, fxRate: number, excludeInvoiceId?: number) {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("فاکتور فروش باید حداقل یک ردیف کالا داشته باشد");

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

    if (basis === "SALES_DELIVERY") {
      if (!l.sourceInventoryLineId) throw new Error(`ردیف ${idx + 1}: انتخاب ردیف حواله فروش الزامی است`);
      const info = await salesDeliveryLineRemaining(l.sourceInventoryLineId, excludeInvoiceId);
      if (!info) throw new Error(`ردیف حواله فروش برای ردیف ${idx + 1} یافت نشد`);
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

    // مبلغ/تخفیف به ارز مبنا و ارزش‌افزوده — دقیقاً هم‌الگوی purchaseInvoices.ts#validateLines: فقط برای
    // بایگانی/محاسبه نگه داشته می‌شوند (نه نمایش در UI)، و کاربر می‌تواند مقدار پیشنهادی مالیات را
    // ویرایش کند (اگر کلاینت صریحاً مقداری فرستاده باشد، همان معتبر است، نه مقدار محاسبه‌شده).
    const baseAmount = toBaseCurrencyAmount(amount, fxRate, currency);
    const baseDiscount = toBaseCurrencyAmount(discount, fxRate, currency);
    const vatRatePercent = resolveVatRatePercent(item);
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
// پیکر «باقیمانده» حواله فروش
// =========================================================================

router.get("/sales-invoices/pickable-sales-delivery-lines", can(`${FORM}.view`), async (req, res) => {
  const destDate = req.query.destDate ? new Date(req.query.destDate as string) : null;
  const excludeInvoiceId = req.query.excludeInvoiceId ? Number(req.query.excludeInvoiceId) : null;
  const lines = await prisma.inventoryDocumentLine.findMany({
    where: { document: { documentType: "SALES_DELIVERY", ...(destDate ? { date: { lte: destDate } } : {}) } },
    include: { document: true, goodsItem: true, unit: true, salesInvoiceLines: true },
    orderBy: { id: "desc" },
  });
  const result = lines
    .map((l: any) => {
      // مصرف همین فاکتور (در حال ویرایش) نباید در «مانده» لحاظ شود، وگرنه ردیفی که کل مانده‌اش را
      // همین فاکتور قبلاً گرفته، از فهرست انتخابگر حذف می‌شود و در حالت ویرایش، ردیف مبدای قبلاً
      // انتخاب‌شده در گرید نمایش داده نمی‌شود — دقیقاً هم‌الگوی purchaseInvoices.ts's excludeInvoiceId.
      const done = l.salesInvoiceLines
        .filter((i: any) => !excludeInvoiceId || i.salesInvoiceId !== excludeInvoiceId)
        .reduce((s: number, i: any) => s + Number(i.quantity), 0);
      const quantity = Number(l.quantity);
      const remaining = quantity - done;
      return {
        id: l.id,
        sourceInventoryLineId: l.id,
        salesDeliveryId: l.document.id,
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
  basis: "NO_BASIS" | "SALES_DELIVERY";
  customerId: number;
  salesTypeId: number;
  salesCenterId: number;
  currencyId: number;
  fxRate?: number;
  description?: string;
  lines: LineInput[];
}

router.get("/sales-invoices", can(`${FORM}.view`), async (_req, res) => {
  const items = await prisma.salesInvoice.findMany({
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

router.get("/sales-invoices/:id", can(`${FORM}.view`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.salesInvoice.findUnique({
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
  if (!d) return res.status(404).json({ error: "فاکتور فروش یافت نشد" });
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

router.post("/sales-invoices", can(`${FORM}.create`), async (req, res) => {
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

    const lines = await validateLines(body.lines, body.basis, currency, fxRate);

    const number = await nextNumber(prisma.salesInvoice, fiscalPeriod.id);
    const created = await prisma.salesInvoice.create({
      data: {
        fiscalPeriodId: fiscalPeriod.id,
        number,
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
    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "شماره سند تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ثبت فاکتور فروش" });
  }
});

router.put("/sales-invoices/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as HeaderBody;
  const existing = await prisma.salesInvoice.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "یافت نشد" });
  if (existing.journalEntryId) return res.status(400).json({ error: "برای این فاکتور سند حسابداری صادر شده؛ ابتدا سند حسابداری را حذف کنید" });
  if (!body.date || !body.basis || !body.customerId || !body.salesTypeId || !body.salesCenterId || !body.currencyId) {
    return res.status(400).json({ error: "تاریخ، مبنا، مشتری، نوع فروش، مرکز فروش و ارز الزامی است" });
  }
  try {
    assertRecordNotStale(existing.updatedAt, req.body.updatedAt, "این فاکتور فروش");
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

    const lines = await validateLines(body.lines, body.basis, currency, fxRate, id);

    await prisma.$transaction([
      prisma.salesInvoiceLine.deleteMany({ where: { salesInvoiceId: id } }),
      prisma.salesInvoice.update({
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
      }),
    ]);
    res.json({ id });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.delete("/sales-invoices/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.salesInvoice.findUnique({ where: { id } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.journalEntryId) return res.status(400).json({ error: "برای این فاکتور سند حسابداری صادر شده؛ ابتدا سند حسابداری را حذف کنید" });
  await prisma.salesInvoice.delete({ where: { id } });
  res.status(204).send();
});

// =========================================================================
// صدور سند حسابداری — طبق Documents/SaleInvoiceVoucher.md.
// =========================================================================

router.post("/sales-invoices/:id/issue-journal-entry", can(`${FORM}.issueJournalEntry`), async (req, res) => {
  const id = Number(req.params.id);
  const invoice = await prisma.salesInvoice.findUnique({
    where: { id },
    include: {
      customer: { include: { party: true } },
      salesType: true,
      currency: true,
      lines: { include: { goodsItem: true }, orderBy: { rowOrder: "asc" } },
    },
  });
  if (!invoice) return res.status(404).json({ error: "فاکتور فروش یافت نشد" });
  if (invoice.journalEntryId) return res.status(400).json({ error: "قبلاً برای این فاکتور سند حسابداری صادر شده است" });

  try {
    const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
    if (!baseCurrency) throw new Error("ارز پایه تعریف نشده است");
    const fxRate = Number(invoice.fxRate);

    const partyDetailCode = invoice.customer.party.detailCode;
    const partyDetailTypeId = await resolveDetailTypeId(partyDetailCode);

    const accountingGroupIds = Array.from(new Set(invoice.lines.map((l) => l.goodsItem.accountingGroupId)));
    const settings = await prisma.goodsServiceAccountingSetting.findMany({
      where: { accountingGroupId: { in: accountingGroupIds } },
      include: { account: true },
    });
    function findSetting(accountingGroupId: number, accountType: string, match: (s: (typeof settings)[number]) => boolean) {
      return settings.find((s) => s.accountingGroupId === accountingGroupId && s.accountType === accountType && match(s));
    }

    const customerName = partyDisplayName(invoice.customer.party) || "";
    const description = `بابت فاکتور فروش ${invoice.number} ${formatJalaliDateForMessage(invoice.date)} ${customerName}`.trim();
    const vatDescription = `بابت ارزش‌افزوده فاکتور فروش ${invoice.number} ${formatJalaliDateForMessage(invoice.date)} ${customerName}`.trim();

    const errors: string[] = [];
    // طبق «Aggregation rule» مستند: مبلغ ردیف و ارزش‌افزوده هرگز با هم در یک سطل جمع نمی‌شوند، حتی اگر
    // هر دو روی همان معین «دریافتنی فروش» بنشینند — برای همین چهار سطل کاملاً جدا.
    const arAmountByAccount = new Map<number, { amount: number; account: (typeof settings)[number]["account"] }>();
    const arVatByAccount = new Map<number, { amount: number; account: (typeof settings)[number]["account"] }>();
    const revenueByAccount = new Map<number, { amount: number; account: (typeof settings)[number]["account"] }>();
    const vatCreditByAccount = new Map<number, { amount: number; account: (typeof settings)[number]["account"] }>();

    for (const line of invoice.lines) {
      const amount = Number(line.amount);
      const discount = Number(line.discount);
      const baseAmount = Number(line.baseAmount);
      const baseDiscount = Number(line.baseDiscount);
      const vatAmount = Number(line.vatAmount);
      const goodsItem = line.goodsItem;

      const arSetting = findSetting(goodsItem.accountingGroupId, "SALES_RECEIVABLE", (s) => s.salesTypeId === invoice.salesTypeId);
      if (!arSetting) {
        errors.push(`برای کالای «${goodsItem.title}» و نوع فروش «${invoice.salesType.title}»، حساب «دریافتنی فروش» در حسابداری کالا و خدمت تعریف نشده است`);
        continue;
      }
      const revenueSetting = findSetting(goodsItem.accountingGroupId, "SALES_REVENUE", (s) => s.salesTypeId === invoice.salesTypeId);
      if (!revenueSetting) {
        errors.push(`برای کالای «${goodsItem.title}» و نوع فروش «${invoice.salesType.title}»، حساب «درآمد فروش» در حسابداری کالا و خدمت تعریف نشده است`);
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

      // مبلغ ردیف منهای تخفیف — طبق تصمیم صریح مستند، برخلاف فاکتور خرید که مبلغ ناخالص را ثبت می‌کند،
      // اینجا مبلغ خالص (پس از تخفیف) روی هر دو طرف بدهکار «دریافتنی فروش» و بستانکار «درآمد فروش»
      // نوشته می‌شود.
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

      const revIsCurrency = revenueSetting.account.isCurrency;
      const revValue = revIsCurrency ? netAmount : netBaseAmount;
      const revExisting = revenueByAccount.get(revenueSetting.accountId);
      if (revExisting) revExisting.amount += revValue;
      else revenueByAccount.set(revenueSetting.accountId, { amount: revValue, account: revenueSetting.account });

      if (vatSetting) {
        const vatExisting = vatCreditByAccount.get(vatSetting.accountId);
        if (vatExisting) vatExisting.amount += vatAmount;
        else vatCreditByAccount.set(vatSetting.accountId, { amount: vatAmount, account: vatSetting.account });
      }
    }

    if (errors.length > 0) return res.status(400).json({ error: errors.join("\n") });

    const debitLines: IssueLineInput[] = [];
    for (const { amount, account } of arAmountByAccount.values()) {
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
    // ارزش‌افزوده «دریافتنی فروش» طبق مستند همیشه به ارز مبنا است، صرف‌نظر از ارزی‌بودن خودِ معین —
    // دقیقاً هم‌الگوی purchaseInvoices.ts's vatDebitLines.
    for (const { amount, account } of arVatByAccount.values()) {
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

    const creditLines: IssueLineInput[] = [];
    for (const { amount, account } of revenueByAccount.values()) {
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
    for (const { amount, account } of vatCreditByAccount.values()) {
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

    const docType = await prisma.documentType.findFirst({ where: { systemKey: "SALES_INVOICE" } });
    if (!docType) return res.status(400).json({ error: "نوع سند «فاکتور فروش» در سیستم تعریف نشده است" });

    const entry = await issueJournalEntry({
      date: invoice.date,
      documentTypeId: docType.id,
      description,
      issuingSystem: "SALES",
      isManual: false,
      lines: [...debitLines, ...creditLines],
      sources: [{ label: `فاکتور فروش شماره ${invoice.number}`, path: `/sales-invoices/${invoice.id}/edit` }],
    });

    await prisma.salesInvoice.update({ where: { id }, data: { journalEntryId: entry.id } });

    res.json({ journalEntryId: entry.id, number: entry.number, referenceNumber: entry.referenceNumber, message: entry.message });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در صدور سند حسابداری" });
  }
});

router.delete("/sales-invoices/:id/journal-entry", can(`${FORM}.revertJournalEntry`), async (req, res) => {
  const id = Number(req.params.id);
  const invoice = await prisma.salesInvoice.findUnique({ where: { id } });
  if (!invoice) return res.status(404).json({ error: "فاکتور فروش یافت نشد" });
  if (!invoice.journalEntryId) return res.status(400).json({ error: "برای این فاکتور سندی صادر نشده است" });
  try {
    await prisma.$transaction([
      prisma.salesInvoice.update({ where: { id }, data: { journalEntryId: null } }),
      prisma.journalEntry.delete({ where: { id: invoice.journalEntryId } }),
    ]);
    res.status(204).send();
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در حذف سند حسابداری" });
  }
});

export default router;
