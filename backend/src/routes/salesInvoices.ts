import { Router } from "express";
import { prisma } from "../lib/prisma";
import { assertDateNotConfirmed } from "../utils/journalEntryValidation";
import { assertWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { assertRecordNotStale } from "../utils/concurrency";
import { resolveVatRatePercent, computeLineVat } from "../utils/vatCalculation";
import { getVatRatePercentForDate, getAdvanceReceiptMethodForDate } from "../services/accountingSettingsService";
import { getSalesInvoiceAdvanceState, saveSalesInvoiceAdvanceAllocations, assertAdvanceAllocationsStillValid, salesInvoiceNetTotal, salesInvoiceVatTotal } from "../services/salesInvoiceAdvanceService";
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
// - فی/مبلغ: برای ردیف بدون مبنا و ردیف مبتنی بر حواله‌ی «بدون‌مبنا» (چون حواله فروش خودش فی صفر دارد)
//   توسط کاربر وارد می‌شود — دقیقاً مثل فاکتور خرید. اما طبق Documents/فراخوانی قیمت در فاکتور.md
//   (تصمیم صریح کاربر): اگر ردیف حواله‌ی انتخاب‌شده خودش بر مبنای سفارش فروش یا پیش‌فاکتور صادر شده
//   باشد (سند مبنای واقعی حواله)، فی/مبلغ دیگر از کاربر گرفته نمی‌شود — همیشه از «مانده‌ی فاکتورنشده»ی
//   همان ردیف سفارش/پیش‌فاکتور محاسبه و جایگزین هر مقدار ارسالی کلاینت می‌شود (validateLines، هم در
//   ایجاد هم در ویرایش؛ نگاه کنید به deliveryLineBaseInfo پایین‌تر) — قفل «نه فقط یک flag» چون این
//   بازمحاسبه مستقیماً از فیلدهای دیتابیسی sourceSalesOrderLineId/sourceSalesQuoteLineId خودِ ردیف
//   حواله (که در انتخاب مبنای حواله فروش ثبت شده‌اند) خوانده می‌شود، نه از یک ستون/فلگ جداگانه روی
//   خودِ ردیف فاکتور.
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

// «مانده‌ی فاکتورنشده»ی یک ردیف سفارش فروش = مقدار/مبلغ ردیف منهای مجموع مقدار/مبلغ ردیف‌های فاکتور
// فروشی که (از طریق هر حواله‌ی فروشِ مبتنی بر این ردیف سفارش) قبلاً صادر شده‌اند — دقیقاً هم‌الگوی
// salesDeliveries.ts#salesOrderLineRemaining، فقط سطح «فاکتورشده» به‌جای «تحویل‌شده».
async function salesOrderLineUninvoiced(id: number, excludeInvoiceId?: number) {
  const line = await prisma.salesOrderLine.findUnique({
    where: { id },
    include: {
      salesOrder: { include: { currency: true, salesType: true } },
      inventoryLines: { where: { document: { documentType: "SALES_DELIVERY" } }, include: { salesInvoiceLines: true } },
    },
  });
  if (!line) return null;
  let invoicedQty = 0;
  let invoicedAmount = 0;
  for (const dl of line.inventoryLines) {
    for (const il of dl.salesInvoiceLines) {
      if (excludeInvoiceId && il.salesInvoiceId === excludeInvoiceId) continue;
      invoicedQty += Number(il.quantity);
      invoicedAmount += Number(il.amount);
    }
  }
  const totalQty = Number(line.quantity);
  const totalAmount = Number(line.amount);
  return { line, salesOrder: line.salesOrder, totalQty, totalAmount, remainingQty: totalQty - invoicedQty, remainingAmount: totalAmount - invoicedAmount };
}

// «مانده‌ی فاکتورنشده»ی یک ردیف پیش‌فاکتور — دقیقاً هم‌الگوی بالا، فقط از سمت SalesQuoteLine (برای
// حواله‌های فروشی که مستقیماً بر مبنای پیش‌فاکتور صادر شده‌اند، نه از طریق سفارش فروش).
async function salesQuoteLineUninvoiced(id: number, excludeInvoiceId?: number) {
  const line = await prisma.salesQuoteLine.findUnique({
    where: { id },
    include: {
      salesQuote: { include: { currency: true, salesType: true } },
      inventoryLines: { where: { document: { documentType: "SALES_DELIVERY" } }, include: { salesInvoiceLines: true } },
    },
  });
  if (!line) return null;
  let invoicedQty = 0;
  let invoicedAmount = 0;
  for (const dl of line.inventoryLines) {
    for (const il of dl.salesInvoiceLines) {
      if (excludeInvoiceId && il.salesInvoiceId === excludeInvoiceId) continue;
      invoicedQty += Number(il.quantity);
      invoicedAmount += Number(il.amount);
    }
  }
  const totalQty = Number(line.quantity);
  const totalAmount = Number(line.amount);
  return { line, salesQuote: line.salesQuote, totalQty, totalAmount, remainingQty: totalQty - invoicedQty, remainingAmount: totalAmount - invoicedAmount };
}

interface DeliveryBaseInfo {
  kind: "SALES_ORDER" | "SALES_QUOTE";
  currencyId: number;
  currencyTitle: string;
  salesTypeId: number;
  salesTypeTitle: string;
  baseAmount: number;
  uninvoicedAmount: number;
  baseQuantity: number;
  uninvoicedQuantity: number;
}

// سند مبنای واقعی یک ردیف حواله فروش (سفارش فروش یا پیش‌فاکتور) به‌همراه ارز/نوع فروش/مانده‌ی
// فاکتورنشده‌اش — null یعنی حواله «بدون‌مبنا»ست (فی/مبلغ همچنان دستی می‌ماند). طبق
// Documents/فراخوانی قیمت در فاکتور.md: «این منطق باید برای هر دو مسیر قابل استفاده باشد» —
// پیش‌فاکتور→حواله→فاکتور و سفارش‌فروش→حواله→فاکتور — هر دو از این یک تابع مشترک عبور می‌کنند.
async function deliveryLineBaseInfo(
  deliveryLine: { sourceSalesOrderLineId: number | null; sourceSalesQuoteLineId: number | null },
  excludeInvoiceId?: number
): Promise<DeliveryBaseInfo | null> {
  if (deliveryLine.sourceSalesOrderLineId) {
    const info = await salesOrderLineUninvoiced(deliveryLine.sourceSalesOrderLineId, excludeInvoiceId);
    if (!info) return null;
    return {
      kind: "SALES_ORDER",
      currencyId: info.salesOrder.currencyId,
      currencyTitle: info.salesOrder.currency.title,
      salesTypeId: info.salesOrder.salesTypeId,
      salesTypeTitle: info.salesOrder.salesType.title,
      baseAmount: info.totalAmount,
      uninvoicedAmount: info.remainingAmount,
      baseQuantity: info.totalQty,
      uninvoicedQuantity: info.remainingQty,
    };
  }
  if (deliveryLine.sourceSalesQuoteLineId) {
    const info = await salesQuoteLineUninvoiced(deliveryLine.sourceSalesQuoteLineId, excludeInvoiceId);
    if (!info) return null;
    return {
      kind: "SALES_QUOTE",
      currencyId: info.salesQuote.currencyId,
      currencyTitle: info.salesQuote.currency.title,
      salesTypeId: info.salesQuote.salesTypeId,
      salesTypeTitle: info.salesQuote.salesType.title,
      baseAmount: info.totalAmount,
      uninvoicedAmount: info.remainingAmount,
      baseQuantity: info.totalQty,
      uninvoicedQuantity: info.remainingQty,
    };
  }
  return null;
}

async function validateLines(lines: LineInput[], basis: string, currency: ConversionCurrency, currencyId: number, fxRate: number, baseCurrency: ConversionCurrency, docDate: Date, salesTypeId: number, excludeInvoiceId?: number) {
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

  // یک ردیف حواله می‌تواند در چند ردیف فاکتور بیاید؛ مجموع مقدار ردیف‌های ارجاع‌دهنده به آن باید از مانده‌ی قابل صورتحسابش بیشتر نشود
  const allocatedToDeliveryLine = new Map<number, number>();
  // نرخ واحدِ محاسبه‌شده از سند مبنای هر ردیف سفارش/پیش‌فاکتور، برای یک بار محاسبه و استفاده‌ی مجدد
  // در همه‌ی ردیف‌های فاکتور که به همان ردیف سفارش/پیش‌فاکتور ارجاع می‌دهند (حتی از طریق حواله‌های
  // مختلف) — طبق Documents/فراخوانی قیمت در فاکتور.md.
  const baseInfoCache = new Map<string, DeliveryBaseInfo>();

  for (const [idx, l] of lines.entries()) {
    const qty = Number(l.quantity);
    if (!(qty > 0)) throw new Error(`مقدار ردیف ${idx + 1} باید عددی مثبت باشد`);

    let goodsItemId = l.goodsItemId || 0;
    let unitId = l.unitId || 0;
    let unitPrice = Number(l.unitPrice) || 0;
    let amount = Number(l.amount) || 0;
    let sourceInventoryLineId: number | null = null;

    if (basis === "SALES_DELIVERY") {
      if (!l.sourceInventoryLineId) throw new Error(`ردیف ${idx + 1}: انتخاب ردیف حواله فروش الزامی است`);
      const info = await salesDeliveryLineRemaining(l.sourceInventoryLineId, excludeInvoiceId);
      if (!info) throw new Error(`ردیف حواله فروش برای ردیف ${idx + 1} یافت نشد`);
      const deliveryTotal = (allocatedToDeliveryLine.get(info.line.id) || 0) + qty;
      if (deliveryTotal > info.remaining) throw new Error(`ردیف ${idx + 1}: مجموع مقدار ردیف‌هایی که به این ردیف حواله فروش ارجاع می‌دهند (${deliveryTotal}) از باقیمانده‌ی قابل صورتحساب (${info.remaining}) بیشتر است`);
      allocatedToDeliveryLine.set(info.line.id, deliveryTotal);
      sourceInventoryLineId = info.line.id;
      goodsItemId = info.line.goodsItemId;
      unitId = info.line.unitId;

      // فراخوانی قیمت از سند مبنای حواله (Documents/فراخوانی قیمت در فاکتور.md): اگر حواله‌ی انتخاب‌شده
      // خودش بر مبنای سفارش فروش/پیش‌فاکتور صادر شده باشد، فی/مبلغ همیشه از مانده‌ی فاکتورنشده‌ی آن سند
      // مبنا محاسبه و جایگزین هر مقدار ارسالی کلاینت می‌شود — هم در ایجاد هم در ویرایش.
      const baseKey = info.line.sourceSalesOrderLineId
        ? `O:${info.line.sourceSalesOrderLineId}`
        : info.line.sourceSalesQuoteLineId
        ? `Q:${info.line.sourceSalesQuoteLineId}`
        : null;
      if (baseKey) {
        let base = baseInfoCache.get(baseKey);
        if (!base) {
          const computed = await deliveryLineBaseInfo(info.line, excludeInvoiceId);
          if (!computed) throw new Error(`سند مبنای ردیف حواله فروش ${idx + 1} یافت نشد`);
          base = computed;
          baseInfoCache.set(baseKey, base);
        }
        if (base.currencyId !== currencyId) throw new Error(`ردیف ${idx + 1}: ارز فاکتور باید با ارز سند مبنای حواله فروش (${base.currencyTitle}) یکسان باشد`);
        if (base.salesTypeId !== salesTypeId) throw new Error(`ردیف ${idx + 1}: نوع فروش فاکتور باید با نوع فروش سند مبنای حواله فروش (${base.salesTypeTitle}) یکسان باشد`);
        if (!(base.uninvoicedQuantity > 0)) throw new Error(`ردیف ${idx + 1}: مانده‌ی مقدار فاکتورنشده‌ی سند مبنا صفر یا منفی است`);
        const unitAmount = base.uninvoicedAmount / base.uninvoicedQuantity;
        unitPrice = Math.round(unitAmount * 10000) / 10000;
        amount = Math.round(unitPrice * qty * 100) / 100;
      }
    } else {
      if (!goodsItemId) throw new Error(`کالا برای ردیف ${idx + 1} الزامی است`);
    }

    if (!(unitPrice >= 0)) throw new Error(`فی ردیف ${idx + 1} نامعتبر است`);
    if (!(amount >= 0)) throw new Error(`مبلغ ردیف ${idx + 1} نامعتبر است`);

    const discount = Number(l.discount) || 0;
    if (!(discount >= 0)) throw new Error(`تخفیف ردیف ${idx + 1} نامعتبر است`);
    if (discount > amount) throw new Error(`تخفیف ردیف ${idx + 1} نمی‌تواند از مبلغ ردیف بیشتر باشد`);

    const item = await prisma.goodsItem.findUnique({ where: { id: goodsItemId } });
    if (!item) throw new Error(`کالای ردیف ${idx + 1} یافت نشد`);
    if (!unitId) unitId = item.mainUnitId;

    // مبلغ/تخفیف به ارز مبنا و ارزش‌افزوده — دقیقاً هم‌الگوی purchaseInvoices.ts#validateLines: فقط برای
    // بایگانی/محاسبه نگه داشته می‌شوند (نه نمایش در UI)، و کاربر می‌تواند مقدار پیشنهادی مالیات را
    // ویرایش کند (اگر کلاینت صریحاً مقداری فرستاده باشد، همان معتبر است، نه مقدار محاسبه‌شده).
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
// پیکر «باقیمانده» حواله فروش
// =========================================================================

router.get("/sales-invoices/pickable-sales-delivery-lines", can(`${FORM}.view`), async (req, res) => {
  const destDate = req.query.destDate ? new Date(req.query.destDate as string) : null;
  const excludeInvoiceId = req.query.excludeInvoiceId ? Number(req.query.excludeInvoiceId) : null;
  const lines = await prisma.inventoryDocumentLine.findMany({
    where: { document: { documentType: "SALES_DELIVERY", ...(destDate ? { date: { lte: destDate } } : {}) } },
    include: { document: true, goodsItem: true, unit: true, salesInvoiceLines: true },
    // به ترتیب سند مبنا و سپس ترتیب ردیف‌ها در همان سند (rowOrder) — چون انتخابگر چندتایی ردیف‌های انتخاب‌شده
    // را به همین ترتیب به فاکتور اضافه می‌کند، ترتیب نزولی id ردیف‌های یک سند را وارونه اضافه می‌کرد.
    orderBy: [{ document: { date: "asc" } }, { document: { number: "asc" } }, { documentId: "asc" }, { rowOrder: "asc" }, { id: "asc" }],
  });
  const result: any[] = [];
  for (const l of lines as any[]) {
    // مصرف همین فاکتور (در حال ویرایش) نباید در «مانده» لحاظ شود، وگرنه ردیفی که کل مانده‌اش را
    // همین فاکتور قبلاً گرفته، از فهرست انتخابگر حذف می‌شود و در حالت ویرایش، ردیف مبدای قبلاً
    // انتخاب‌شده در گرید نمایش داده نمی‌شود — دقیقاً هم‌الگوی purchaseInvoices.ts's excludeInvoiceId.
    const done = l.salesInvoiceLines
      .filter((i: any) => !excludeInvoiceId || i.salesInvoiceId !== excludeInvoiceId)
      .reduce((s: number, i: any) => s + Number(i.quantity), 0);
    const quantity = Number(l.quantity);
    const remaining = quantity - done;
    if (!(remaining > 0)) continue;

    // اطلاعات سند مبنای واقعی حواله (سفارش فروش/پیش‌فاکتور) — طبق
    // Documents/فراخوانی قیمت در فاکتور.md: چون خودِ حواله فروش ارز/نوع فروش ندارد، انتخابگر باید
    // این اطلاعات را از سند مبنای آن همراه بیاورد؛ null یعنی حواله «بدون‌مبنا»ست.
    const base = await deliveryLineBaseInfo(l, excludeInvoiceId ?? undefined);

    result.push({
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
      base: base
        ? {
            currencyId: base.currencyId,
            currencyTitle: base.currencyTitle,
            salesTypeId: base.salesTypeId,
            salesTypeTitle: base.salesTypeTitle,
            baseAmount: base.baseAmount,
            uninvoicedAmount: base.uninvoicedAmount,
            baseQuantity: base.baseQuantity,
            uninvoicedQuantity: base.uninvoicedQuantity,
          }
        : null,
    });
  }
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

    const lines = await validateLines(body.lines, body.basis, currency, body.currencyId, fxRate, baseCurrency, date, body.salesTypeId);

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
  if (existing.status === "VOIDED") return res.status(400).json({ error: "این فاکتور فروش باطل شده است؛ قابل ویرایش نیست" });
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

    const lines = await validateLines(body.lines, body.basis, currency, body.currencyId, fxRate, baseCurrency, date, body.salesTypeId, id);
    await assertAdvanceAllocationsStillValid(id, { customerId: body.customerId, currencyId: body.currencyId, date, netTotal: salesInvoiceNetTotal(lines as any), vatTotal: salesInvoiceVatTotal(lines as any, fxRate) });

    const [, updated] = await prisma.$transaction([
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
    // updatedAt جدید باید برگردد تا frontend/lib/api.ts (rememberVersion) آن را جایگزین نسخه‌ی قبلی کند؛
    // وگرنه ذخیره‌ی دوباره‌ی همان فرم (بدون بارگذاری مجدد) با نسخه‌ی کهنه ارسال و رد می‌شود
    // (utils/concurrency.ts).
    res.json({ id, updatedAt: updated.updatedAt });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ذخیره" });
  }
});

router.delete("/sales-invoices/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const d = await prisma.salesInvoice.findUnique({ where: { id } });
  if (!d) return res.status(404).json({ error: "یافت نشد" });
  if (d.journalEntryId) return res.status(400).json({ error: "برای این فاکتور سند حسابداری صادر شده؛ ابتدا سند حسابداری را حذف کنید" });
  if (d.status === "VOIDED") return res.status(400).json({ error: "این فاکتور فروش باطل شده است؛ قابل حذف نیست" });
  await prisma.salesInvoice.delete({ where: { id } });
  res.status(204).send();
});

// =========================================================================
// ابطال فاکتور فروش (اکشن «ابطال») — طبق تصمیم صریح کاربر: صرفاً یک تغییر وضعیت سبک، نه حذف و نه ایجاد
// سند/فرآیند جداگانه. فقط وقتی مجاز است که فاکتور هیچ «گردش» یا سند حسابداری‌ای نداشته باشد — دقیقاً
// همان مجموعه‌ی روابطی که به این فاکتور ارجاع می‌دهند (journalEntryId خودِ فاکتور + هر جدولی که
// salesInvoiceId دارد: رسید/پرداخت/تخصیص پیش‌دریافت/تنخواه). بعد از ابطال، فاکتور کاملاً قفل می‌شود
// (ویرایش/حذف/صدور سند/تخصیص پیش‌دریافت — نگاه کنید به گاردهای هرکدام) و در «مرور فروش» و انتخابگرهای
// اسناد مبنا (services/paymentBasisCandidates.ts، routes/receipts.ts) به‌طور پیش‌فرض نادیده گرفته می‌شود.
router.post("/sales-invoices/:id/void", can(`${FORM}.void`), async (req, res) => {
  const id = Number(req.params.id);
  const invoice = await prisma.salesInvoice.findUnique({ where: { id } });
  if (!invoice) return res.status(404).json({ error: "فاکتور فروش یافت نشد" });
  if (invoice.status === "VOIDED") return res.status(400).json({ error: "این فاکتور فروش قبلاً باطل شده است" });
  if (invoice.journalEntryId) return res.status(400).json({ error: "برای این فاکتور سند حسابداری صادر شده است؛ امکان ابطال وجود ندارد" });

  const [receiptCount, paymentCount, advanceCount, pettyCashPaymentCount, pettyCashSummaryCount] = await Promise.all([
    prisma.receiptSettlementLine.count({ where: { salesInvoiceId: id } }),
    prisma.paymentSettlementLine.count({ where: { salesInvoiceId: id } }),
    prisma.salesInvoiceAdvanceAllocation.count({ where: { salesInvoiceId: id } }),
    prisma.pettyCashPayment.count({ where: { salesInvoiceId: id } }),
    prisma.pettyCashSummaryLine.count({ where: { salesInvoiceId: id } }),
  ]);
  if (receiptCount + paymentCount + advanceCount + pettyCashPaymentCount + pettyCashSummaryCount > 0) {
    return res.status(400).json({ error: "برای این فاکتور فروش گردش (دریافت/پرداخت/تخصیص پیش‌دریافت/تنخواه) ثبت شده است؛ امکان ابطال وجود ندارد" });
  }

  await prisma.salesInvoice.update({ where: { id }, data: { status: "VOIDED" } });
  res.json({ id, status: "VOIDED" });
});

// =========================================================================
// صدور سند حسابداری — طبق Documents/SaleInvoiceVoucher.md.
// =========================================================================

// =========================================================================
// تخصیص پیش‌دریافت (Documents/تخصیص پیش دریافت.md) — عملیات مستقل از ویرایش اطلاعات اصلی فاکتور؛ کنترل‌ها در
// services/salesInvoiceAdvanceService.ts (شامل قفل بر اساس «گردش» فاکتور، قابل توسعه با یک مورد به SALES_INVOICE_ADVANCE_LOCKS).
// =========================================================================

router.get("/sales-invoices/:id/advance-allocations", can(`${FORM}.view`), async (req, res) => {
  try {
    res.json(await getSalesInvoiceAdvanceState(Number(req.params.id)));
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در دریافت اطلاعات پیش‌دریافت" });
  }
});

router.put("/sales-invoices/:id/advance-allocations", can(`${FORM}.allocateAdvance`), async (req, res) => {
  try {
    await saveSalesInvoiceAdvanceAllocations(Number(req.params.id), req.body?.allocations);
    res.json(await getSalesInvoiceAdvanceState(Number(req.params.id)));
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در ثبت تخصیص پیش‌دریافت" });
  }
});

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
  if (invoice.status === "VOIDED") return res.status(400).json({ error: "این فاکتور فروش باطل شده است؛ امکان صدور سند حسابداری وجود ندارد" });

  try {
    const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
    if (!baseCurrency) throw new Error("ارز پایه تعریف نشده است");
    const fxRate = Number(invoice.fxRate);

    const partyDetailCode = invoice.customer.party.detailCode;
    const partyDetailTypeId = await resolveDetailTypeId(partyDetailCode);

    const accountingGroupIds = Array.from(new Set(invoice.lines.map((l) => l.goodsItem.accountingGroupId)));
    // طبق تصمیم صریح کاربر: «دریافتنی فروش» دیگر به گروه حسابداری وابسته نیست (فقط نوع فروش) — پس
    // شرط OR لازم است تا این نوع، صرف‌نظر از این‌که کدام گروه‌های حسابداری در ردیف‌های این فاکتور
    // هستند، هم واکشی شود.
    const settings = await prisma.goodsServiceAccountingSetting.findMany({
      where: { OR: [{ accountingGroupId: { in: accountingGroupIds } }, { accountType: "SALES_RECEIVABLE" }] },
      include: { account: true },
    });
    function findSetting(accountingGroupId: number, accountType: string, match: (s: (typeof settings)[number]) => boolean) {
      return settings.find((s) => s.accountingGroupId === accountingGroupId && s.accountType === accountType && match(s));
    }
    // «دریافتنی فروش» فقط با نوع فروش کلید می‌خورد — بدون قید گروه حسابداری.
    function findReceivableSetting(match: (s: (typeof settings)[number]) => boolean) {
      return settings.find((s) => s.accountType === "SALES_RECEIVABLE" && match(s));
    }

    const customerName = partyDisplayName(invoice.customer.party) || "";
    const description = `بابت فاکتور فروش ${invoice.number} ${formatJalaliDateForMessage(invoice.date)} ${customerName}`.trim();
    const vatDescription = `بابت ارزش‌افزوده فاکتور فروش ${invoice.number} ${formatJalaliDateForMessage(invoice.date)} ${customerName}`.trim();

    const errors: string[] = [];
    // «دریافتنی فروش» دیگر به‌ازای هر ردیف/کالا متفاوت نیست (فقط یک بار، بر اساس نوع فروش هدر، بررسی می‌شود)
    const arSetting = findReceivableSetting((s) => s.salesTypeId === invoice.salesTypeId);
    if (!arSetting) {
      errors.push(`برای نوع فروش «${invoice.salesType.title}»، حساب «دریافتنی فروش» در حسابداری کالا و خدمت تعریف نشده است`);
    }

    // طبق «Aggregation rule» مستند: مبلغ ردیف و ارزش‌افزوده هرگز با هم در یک سطل جمع نمی‌شوند، حتی اگر
    // هر دو روی همان معین «دریافتنی فروش» بنشینند — برای همین چهار سطل کاملاً جدا.
    const arAmountByAccount = new Map<number, { amount: number; account: (typeof settings)[number]["account"] }>();
    const arVatByAccount = new Map<number, { amount: number; account: (typeof settings)[number]["account"] }>();
    const revenueByAccount = new Map<number, { amount: number; account: (typeof settings)[number]["account"] }>();
    const vatCreditByAccount = new Map<number, { amount: number; account: (typeof settings)[number]["account"] }>();

    for (const line of invoice.lines) {
      if (!arSetting) break;
      const amount = Number(line.amount);
      const discount = Number(line.discount);
      const baseAmount = Number(line.baseAmount);
      const baseDiscount = Number(line.baseDiscount);
      const vatAmount = Number(line.vatAmount);
      const goodsItem = line.goodsItem;

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

    // ---------- تخصیص پیش‌دریافت (Documents/تخصیص پیش دریافت.md) ----------
    // هر تخصیص: بدهکار «پیش‌دریافت» (همان معینی که رسید دریافت بستانکار کرده) به ارزش دفتری/تاریخی، و کاهش بدهکار «دریافتنی فروش» به مبلغ تخصیص
    // با نرخ فاکتور. اختلاف ارزش ریالی (نرخ فاکتور − نرخ تاریخی) طبق «رویه‌ها و تنظیمات حسابداری» (روش معتبر در تاریخ فاکتور) شناسایی می‌شود:
    //  • نرخ تاریخ معامله/فاکتور: روی «سود و زیان تسعیر ارز» (اختلاف مثبت = زیان، بدهکار؛ منفی = سود، بستانکار)
    //  • نرخ تاریخی پیش‌دریافت: مبلغ فروش برای بخش پیش‌دریافت با نرخ تاریخی ثبت می‌شود (اصلاح درآمد فروش به‌اندازه‌ی اختلاف)، بدون تسعیر جدا
    // مبلغ ارزی تخصیص/مانده‌ی قابل پرداخت هرگز تحت‌تأثیر اختلاف نرخ نیست. سند همیشه بالانس است.
    // «پیش‌دریافت ارزش افزوده» (Documents/تغییرات تخصیص پیش‌دریافت.md) همین منطق را جدا از پیش‌دریافت عادی و روی دریافتنی/ارزش‌افزوده‌ی فاکتور دارد.
    const advanceDebitLines: IssueLineInput[] = [];
    const advanceAdjustLines: IssueLineInput[] = [];
    const allocations = await prisma.salesInvoiceAdvanceAllocation.findMany({
      where: { salesInvoiceId: id },
      include: { receiptSettlementLine: { include: { receipt: true, receiptType: { include: { account: true } } } } },
      orderBy: { id: "asc" },
    });
    if (allocations.length > 0) {
      const treasurySettings = await prisma.treasuryAccountSetting.findMany({
        where: { accountType: { in: ["RECEIPT_SUBJECT", "FX_GAIN_LOSS"] } },
        include: { account: true },
      });
      const invIsBase = invoice.currencyId === baseCurrency.id;
      // مجموع هر ماهیت جدا نگهداری می‌شود («پیش‌دریافت» روی دریافتنیِ مبلغ، «پیش‌دریافت ارزش افزوده» روی دریافتنیِ ارزش‌افزوده) و هرگز با هم جمع نمی‌شوند
      const acc = {
        ADVANCE_RECEIPT: { cur: 0, inv: 0, hist: 0 },
        ADVANCE_VAT_RECEIPT: { cur: 0, inv: 0, hist: 0 },
      };
      for (const a of allocations) {
        const l = a.receiptSettlementLine;
        const rt = l.receiptType;
        const amount = Number(a.amount);
        const bucket = a.nature === "ADVANCE_VAT_RECEIPT" ? acc.ADVANCE_VAT_RECEIPT : acc.ADVANCE_RECEIPT;
        const natureTitle = a.nature === "ADVANCE_VAT_RECEIPT" ? "پیش‌دریافت ارزش افزوده" : "پیش‌دریافت";
        const account = rt.basisType === "NONE" ? rt.account : treasurySettings.find((s) => s.accountType === "RECEIPT_SUBJECT" && s.receiptTypeId === rt.id)?.account;
        if (!account) {
          errors.push(`برای نوع دریافت «${rt.title}» (${natureTitle} رسید شماره ${l.receipt.number}) معینِ ${natureTitle} تعریف نشده است`);
          continue;
        }
        const rowRate = Number(l.fxRate);
        const hist = invIsBase ? amount : toBaseCurrencyAmount(amount, rowRate, invoice.currency, baseCurrency);
        const atInvoice = invIsBase ? amount : toBaseCurrencyAmount(amount, fxRate, invoice.currency, baseCurrency);
        bucket.cur += amount;
        bucket.inv += atInvoice;
        bucket.hist += hist;
        const details = resolveAccountDetailFields(account, partyDetailTypeId, partyDetailCode);
        const advDescription = `بابت تخصیص ${natureTitle} رسید شماره ${l.receipt.number} به فاکتور فروش ${invoice.number} ${customerName}`.trim();
        if (account.isCurrency && !invIsBase) {
          advanceDebitLines.push({ accountId: account.id, ...details, currencyId: invoice.currencyId, debit: amount, credit: 0, fxRate: rowRate, description: advDescription });
        } else {
          advanceDebitLines.push({ accountId: account.id, ...details, currencyId: baseCurrency.id, debit: hist, credit: 0, fxRate: 1, description: advDescription });
        }
      }

      // کاهش بدهکار «دریافتنی فروش» (بخش مبلغ) به‌اندازه‌ی پیش‌دریافتِ عادی (مبلغ ارزی اگر معین ارزی است، وگرنه معادل ریالی با نرخ فاکتور)
      if (acc.ADVANCE_RECEIPT.cur > 0) {
        for (const [key, entry] of Array.from(arAmountByAccount.entries())) {
          entry.amount -= entry.account.isCurrency ? acc.ADVANCE_RECEIPT.cur : acc.ADVANCE_RECEIPT.inv;
          if (entry.amount < -0.005) errors.push("مجموع پیش‌دریافت تخصیص‌یافته از مبلغ دریافتنی فاکتور بیشتر است");
          if (entry.amount <= 0.005) arAmountByAccount.delete(key);
        }
      }

      // کاهش بدهکار «دریافتنی ارزش افزوده» (همیشه به ارز مبنا) به‌اندازه‌ی پیش‌دریافت ارزش افزوده؛ چون سقف تخصیص به ارز فاکتور و گرد‌شده است،
      // مبلغ مؤثر حداکثر برابر ارزش‌افزوده‌ی فاکتور است (تا سند همیشه بالانس بماند)
      let vatEffectiveBase = acc.ADVANCE_VAT_RECEIPT.inv;
      if (acc.ADVANCE_VAT_RECEIPT.cur > 0) {
        const arVatTotal = Array.from(arVatByAccount.values()).reduce((s, e) => s + e.amount, 0);
        if (acc.ADVANCE_VAT_RECEIPT.inv > arVatTotal + 0.005 * Math.max(1, fxRate)) {
          errors.push("مجموع پیش‌دریافت ارزش افزوده‌ی تخصیص‌یافته از ارزش افزوده‌ی فاکتور بیشتر است");
        }
        vatEffectiveBase = Math.min(acc.ADVANCE_VAT_RECEIPT.inv, arVatTotal);
        let left = vatEffectiveBase;
        for (const [key, entry] of Array.from(arVatByAccount.entries())) {
          const take = Math.min(entry.amount, left);
          entry.amount -= take;
          left -= take;
          if (entry.amount <= 0.005) arVatByAccount.delete(key);
        }
      }

      // اختلاف ارزش ریالی (نرخ فاکتور − نرخ تاریخی) هر ماهیت جدا محاسبه و طبق روش معتبر در تاریخ فاکتور شناسایی می‌شود
      const diffRegular = Math.round((acc.ADVANCE_RECEIPT.inv - acc.ADVANCE_RECEIPT.hist) * 100) / 100;
      const diffVat = Math.round((vatEffectiveBase - acc.ADVANCE_VAT_RECEIPT.hist) * 100) / 100;
      if (!invIsBase && (Math.abs(diffRegular) > 0.005 || Math.abs(diffVat) > 0.005)) {
        const method = await getAdvanceReceiptMethodForDate(invoice.date);
        if (!method) {
          errors.push("روش شناسایی پیش‌دریافت ارزی برای تاریخ فاکتور در «رویه‌ها و تنظیمات حسابداری» (تنظیمات ارز) تعریف نشده است");
        } else {
          const parts: { diff: number; title: string; contra: { account: any } | undefined; contraTitle: string }[] = [
            { diff: diffRegular, title: "پیش‌دریافت", contra: Array.from(revenueByAccount.values())[0], contraTitle: "درآمد فروش" },
            { diff: diffVat, title: "پیش‌دریافت ارزش افزوده", contra: Array.from(vatCreditByAccount.values())[0], contraTitle: "ارزش‌افزوده فروش" },
          ];
          const fxAccount = treasurySettings.find((s) => s.accountType === "FX_GAIN_LOSS")?.account;
          for (const p of parts) {
            if (Math.abs(p.diff) <= 0.005) continue;
            if (method === "TRANSACTION_DATE_RATE") {
              if (!fxAccount) {
                errors.push("حساب «سود و زیان تسعیر ارز» در «تعیین حسابهای معین» تعریف نشده است");
                break;
              }
              advanceAdjustLines.push({
                accountId: fxAccount.id,
                currencyId: baseCurrency.id,
                debit: p.diff > 0 ? p.diff : 0,
                credit: p.diff < 0 ? -p.diff : 0,
                fxRate: 1,
                description: `تسعیر ${p.title} تخصیص‌یافته به ${description}`,
              });
            } else if (!p.contra) {
              errors.push(`حساب «${p.contraTitle}» برای اصلاح مبلغ بخش ${p.title} مشخص نیست`);
            } else {
              const details = resolveAccountDetailFields(p.contra.account, partyDetailTypeId, partyDetailCode);
              advanceAdjustLines.push({
                accountId: p.contra.account.id,
                ...details,
                currencyId: baseCurrency.id,
                debit: p.diff > 0 ? p.diff : 0,
                credit: p.diff < 0 ? -p.diff : 0,
                fxRate: 1,
                description: `فروش بخش ${p.title} با نرخ تاریخی — ${description}`,
              });
            }
          }
        }
      }
      if (errors.length > 0) return res.status(400).json({ error: errors.join("\n") });
    }

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
      lines: [...debitLines, ...advanceDebitLines, ...creditLines, ...advanceAdjustLines],
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
