import { Router } from "express";
import { prisma } from "../lib/prisma";
import { assertDateNotConfirmed } from "../utils/journalEntryValidation";
import { assertWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { assertRecordNotStale } from "../utils/concurrency";
import { resolveVatRatePercent, computeLineVat } from "../utils/vatCalculation";
import { getVatRatePercentForDate, getAdvanceReceiptMethodForDate } from "../services/accountingSettingsService";
import { getSalesInvoiceAdvanceState, saveSalesInvoiceAdvanceAllocations, assertAdvanceAllocationsStillValid, salesInvoiceNetTotal, salesInvoiceVatTotal } from "../services/salesInvoiceAdvanceService";
import { toBaseCurrencyAmount, ConversionCurrency } from "../utils/currencyConversion";
import { allocateDocumentNumber, assertEditAllowed } from "../services/numberingPatternService";
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

type LineBasis = "NO_BASIS" | "SALES_DELIVERY" | "SALES_ORDER" | "SALES_QUOTE";
const LINE_BASES = new Set<string>(["NO_BASIS", "SALES_DELIVERY", "SALES_ORDER", "SALES_QUOTE"]);
const BASIS_FA: Record<LineBasis, string> = { NO_BASIS: "بدون مبنا", SALES_DELIVERY: "حواله فروش", SALES_ORDER: "سفارش فروش", SALES_QUOTE: "پیش‌فاکتور" };

interface LineInput {
  /** مبنای همین ردیف (تنها منبع حقیقت؛ هدر فاکتور مبنا ندارد) */
  basis?: LineBasis;
  sourceInventoryLineId?: number | null;
  sourceSalesOrderLineId?: number | null;
  sourceSalesQuoteLineId?: number | null;
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
      salesInvoiceLines: true,
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
  // ردیف‌های فاکتورِ مستقیماً بر مبنای «سفارش فروش» (مبنای سطح ردیف) هم از مانده کم می‌شوند
  for (const il of (line as any).salesInvoiceLines) {
    if (excludeInvoiceId && il.salesInvoiceId === excludeInvoiceId) continue;
    invoicedQty += Number(il.quantity);
    invoicedAmount += Number(il.amount);
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
      salesInvoiceLines: true,
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
  // ردیف‌های فاکتورِ مستقیماً بر مبنای «پیش‌فاکتور» (مبنای سطح ردیف) هم از مانده کم می‌شوند
  for (const il of (line as any).salesInvoiceLines) {
    if (excludeInvoiceId && il.salesInvoiceId === excludeInvoiceId) continue;
    invoicedQty += Number(il.quantity);
    invoicedAmount += Number(il.amount);
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

// =========================================================================
// «مبنا» در سطح ردیف (هدر فاکتور مبنا ندارد): هر ردیف مبنای خودش را دارد — بدون مبنا / حواله فروش / سفارش فروش / پیش‌فاکتور — و
// مبنا تعیین می‌کند کدام فیلد مبدا (sourceInventoryLineId | sourceSalesOrderLineId | sourceSalesQuoteLineId) پر باشد و چه اقلامی قابل انتخاب‌اند.
// قواعد سازگاری سند مبنا با هدر فاکتور (همه در بک‌اند، مستقل از فرانت‌اند، برای هر سند مبنا جداگانه):
//   طرف حساب = مشتری هدر، مرکز فروش = مرکز هدر، نوع فروش = نوع هدر، ارز = ارز هدر، و تاریخ مبنا <= تاریخ فاکتور.
//   «حواله فروش» خودش مرکز فروش/نوع فروش/ارز ندارد: اگر حواله مبنا داشته باشد (سفارش فروش/پیش‌فاکتور) این سه از همان مبنا گرفته و مقایسه
//   می‌شود؛ اگر مبنا نداشته باشد فقط طرف حساب و تاریخ کنترل می‌شود.
// =========================================================================

interface HeaderCtx {
  customerId: number;
  partyDetailCode: string | null;
  salesTypeId: number;
  salesCenterId: number;
  currencyId: number;
  date: Date;
}

async function buildHeaderCtx(h: { customerId: number; salesTypeId: number; salesCenterId: number; currencyId: number; date: Date }): Promise<HeaderCtx> {
  const customer = await prisma.customer.findUnique({ where: { id: h.customerId }, include: { party: true } });
  if (!customer) throw new Error("مشتری یافت نشد");
  return { ...h, partyDetailCode: customer.party.detailCode };
}

/** سازگاری سفارش فروش/پیش‌فاکتور با هدر؛ دلیل عدم پذیرش یا null */
function orderOrQuoteReason(doc: { status: string; customerId: number; salesTypeId: number; salesCenterId: number; currencyId: number; date: Date }, h: HeaderCtx, title: string): string | null {
  if (doc.status !== "APPROVED") return `${title} در وضعیت تایید نیست`;
  if (doc.customerId !== h.customerId) return `طرف حساب ${title} با مشتری فاکتور یکسان نیست`;
  if (doc.salesCenterId !== h.salesCenterId) return `مرکز فروش ${title} با مرکز فروش فاکتور یکسان نیست`;
  if (doc.salesTypeId !== h.salesTypeId) return `نوع فروش ${title} با نوع فروش فاکتور یکسان نیست`;
  if (doc.currencyId !== h.currencyId) return `ارز ${title} با ارز فاکتور یکسان نیست`;
  if (doc.date.getTime() > h.date.getTime()) return `تاریخ ${title} بعد از تاریخ فاکتور است`;
  return null;
}

async function loadDeliveryDoc(id: number) {
  return prisma.inventoryDocument.findFirst({
    where: { id, documentType: "SALES_DELIVERY" },
    include: {
      lines: {
        include: {
          goodsItem: true,
          unit: true,
          salesInvoiceLines: true,
          sourceSalesOrderLine: { include: { salesOrder: { include: { currency: true, salesType: true, salesCenter: true } } } },
          sourceSalesQuoteLine: { include: { salesQuote: { include: { currency: true, salesType: true, salesCenter: true } } } },
        },
        orderBy: [{ rowOrder: "asc" }, { id: "asc" }],
      },
    },
  });
}

/** سازگاری حواله فروش با هدر: همیشه طرف حساب + تاریخ؛ فقط اگر حواله مبنا (سفارش/پیش‌فاکتور) دارد، مرکز فروش/نوع فروش/ارز مبنا هم */
function deliveryDocReason(doc: any, h: HeaderCtx): string | null {
  if (!h.partyDetailCode || doc.detailCode !== h.partyDetailCode) return "طرف حساب حواله فروش با مشتری فاکتور یکسان نیست";
  if (doc.date.getTime() > h.date.getTime()) return "تاریخ حواله فروش بعد از تاریخ فاکتور است";
  const seen = new Set<string>();
  for (const l of doc.lines) {
    const base: any = l.sourceSalesOrderLine?.salesOrder ?? l.sourceSalesQuoteLine?.salesQuote;
    if (!base) continue; // حواله بدون مبنا: مرکز فروش/نوع فروش/ارز کنترل نمی‌شود
    const key = `${l.sourceSalesOrderLine ? "O" : "Q"}${base.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const t = l.sourceSalesOrderLine ? "سفارش فروشِ مبنای حواله" : "پیش‌فاکتورِ مبنای حواله";
    if (base.salesCenterId !== h.salesCenterId) return `مرکز فروش ${t} با مرکز فروش فاکتور یکسان نیست`;
    if (base.salesTypeId !== h.salesTypeId) return `نوع فروش ${t} با نوع فروش فاکتور یکسان نیست`;
    if (base.currencyId !== h.currencyId) return `ارز ${t} با ارز فاکتور یکسان نیست`;
  }
  return null;
}

/** مقدار ردیف‌های پیش‌فاکتور که قبلاً در سفارش فروش آمده‌اند — از مانده‌ی صورتحساب مستقیم پیش‌فاکتور کم می‌شود (همان سند دوبار صورتحساب نشود) */
async function quoteLineOrderedQty(quoteLineId: number): Promise<number> {
  const agg = await prisma.salesOrderLine.aggregate({ where: { sourceSalesQuoteLineId: quoteLineId }, _sum: { quantity: true } });
  return Number(agg._sum.quantity ?? 0);
}

async function validateLines(
  lines: LineInput[],
  h: HeaderCtx,
  currency: ConversionCurrency,
  fxRate: number,
  baseCurrency: ConversionCurrency,
  excludeInvoiceId?: number,
  /** ردیف‌های کالاییِ «بدون مبنا/سفارش/پیش‌فاکتور» که از قبل در همین فاکتور ذخیره بوده‌اند (طراحی قبلی) — فقط همان‌ها اجازه‌ی ماندن دارند */
  legacyNoBasisGoodsIds: Set<number> = new Set()
) {
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("فاکتور فروش باید حداقل یک ردیف داشته باشد");

  const cleaned: {
    basis: LineBasis;
    sourceInventoryLineId: number | null;
    sourceSalesOrderLineId: number | null;
    sourceSalesQuoteLineId: number | null;
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

  // یک ردیف مبنا (حواله/سفارش/پیش‌فاکتور) می‌تواند در چند ردیف فاکتور بیاید؛ مجموع مقدارِ ارجاع‌دهنده‌ها از مانده‌ی قابل صورتحساب بیشتر نشود
  const allocated = new Map<string, number>();
  const baseInfoCache = new Map<string, DeliveryBaseInfo>();
  const docReasonCache = new Map<string, string | null>();

  for (const [idx, l] of lines.entries()) {
    const n = idx + 1;
    const basis = l.basis as LineBasis;
    if (!basis || !LINE_BASES.has(basis)) throw new Error(`ردیف ${n}: مبنا الزامی/نامعتبر است`);
    const qty = Number(l.quantity);
    if (!(qty > 0)) throw new Error(`مقدار ردیف ${n} باید عددی مثبت باشد`);

    // فقط فیلد مبدای متناسب با مبنای همین ردیف مجاز است
    const wanted = { SALES_DELIVERY: "sourceInventoryLineId", SALES_ORDER: "sourceSalesOrderLineId", SALES_QUOTE: "sourceSalesQuoteLineId" } as Record<string, string>;
    for (const f of ["sourceInventoryLineId", "sourceSalesOrderLineId", "sourceSalesQuoteLineId"] as const) {
      if (l[f] && wanted[basis] !== f) throw new Error(`ردیف ${n}: برای مبنای «${BASIS_FA[basis]}» انتخاب این سند مبنا مجاز نیست`);
    }

    let goodsItemId = l.goodsItemId || 0;
    let unitId = l.unitId || 0;
    let unitPrice = Number(l.unitPrice) || 0;
    let amount = Number(l.amount) || 0;
    let sourceInventoryLineId: number | null = null;
    let sourceSalesOrderLineId: number | null = null;
    let sourceSalesQuoteLineId: number | null = null;

    if (basis === "NO_BASIS") {
      if (!goodsItemId) throw new Error(`ردیف ${n}: انتخاب خدمت الزامی است`);
    } else if (basis === "SALES_DELIVERY") {
      if (!l.sourceInventoryLineId) throw new Error(`ردیف ${n}: انتخاب ردیف حواله فروش الزامی است`);
      const info = await salesDeliveryLineRemaining(l.sourceInventoryLineId, excludeInvoiceId);
      if (!info) throw new Error(`ردیف حواله فروش برای ردیف ${n} یافت نشد`);
      // سازگاری خودِ سند حواله با هدر (طرف حساب/تاریخ، و مرکز/نوع/ارز مبنای حواله در صورت وجود)
      const docKey = `D${info.line.documentId}`;
      if (!docReasonCache.has(docKey)) {
        const doc = await loadDeliveryDoc(info.line.documentId);
        docReasonCache.set(docKey, doc ? deliveryDocReason(doc, h) : "حواله فروش یافت نشد");
      }
      const docReason = docReasonCache.get(docKey);
      if (docReason) throw new Error(`ردیف ${n}: ${docReason}`);

      const key = `D:${info.line.id}`;
      const deliveryTotal = (allocated.get(key) || 0) + qty;
      if (deliveryTotal > info.remaining) throw new Error(`ردیف ${n}: مجموع مقدار ردیف‌هایی که به این ردیف حواله فروش ارجاع می‌دهند (${deliveryTotal}) از باقیمانده‌ی قابل صورتحساب (${info.remaining}) بیشتر است`);
      allocated.set(key, deliveryTotal);
      sourceInventoryLineId = info.line.id;
      goodsItemId = info.line.goodsItemId;
      unitId = info.line.unitId;

      // فراخوانی قیمت از سند مبنای حواله (Documents/فراخوانی قیمت در فاکتور.md) — بدون تغییر نسبت به قبل
      const baseKey = info.line.sourceSalesOrderLineId ? `O:${info.line.sourceSalesOrderLineId}` : info.line.sourceSalesQuoteLineId ? `Q:${info.line.sourceSalesQuoteLineId}` : null;
      if (baseKey) {
        let base = baseInfoCache.get(baseKey);
        if (!base) {
          const computed = await deliveryLineBaseInfo(info.line, excludeInvoiceId);
          if (!computed) throw new Error(`سند مبنای ردیف حواله فروش ${n} یافت نشد`);
          base = computed;
          baseInfoCache.set(baseKey, base);
        }
        if (!(base.uninvoicedQuantity > 0)) throw new Error(`ردیف ${n}: مانده‌ی مقدار فاکتورنشده‌ی سند مبنا صفر یا منفی است`);
        const unitAmount = base.uninvoicedAmount / base.uninvoicedQuantity;
        unitPrice = Math.round(unitAmount * 10000) / 10000;
        amount = Math.round(unitPrice * qty * 100) / 100;
      }
    } else if (basis === "SALES_ORDER") {
      if (!l.sourceSalesOrderLineId) throw new Error(`ردیف ${n}: انتخاب ردیف سفارش فروش الزامی است`);
      const info = await salesOrderLineUninvoiced(l.sourceSalesOrderLineId, excludeInvoiceId);
      if (!info) throw new Error(`ردیف سفارش فروش برای ردیف ${n} یافت نشد`);
      const reason = orderOrQuoteReason(info.salesOrder, h, "سفارش فروش");
      if (reason) throw new Error(`ردیف ${n}: ${reason}`);
      const key = `O:${info.line.id}`;
      const total = (allocated.get(key) || 0) + qty;
      if (total > info.remainingQty + 1e-9) throw new Error(`ردیف ${n}: مجموع مقدار ردیف‌هایی که به این ردیف سفارش فروش ارجاع می‌دهند (${total}) از باقیمانده‌ی قابل صورتحساب (${info.remainingQty}) بیشتر است`);
      allocated.set(key, total);
      if (!(info.remainingQty > 0)) throw new Error(`ردیف ${n}: مانده‌ی مقدار فاکتورنشده‌ی ردیف سفارش فروش صفر یا منفی است`);
      sourceSalesOrderLineId = info.line.id;
      goodsItemId = info.line.goodsItemId;
      unitId = info.line.unitId;
      // فی/مبلغ همیشه از مانده‌ی فاکتورنشده‌ی ردیف سفارش محاسبه می‌شود (مثل مسیر حواله مبتنی بر سفارش)
      unitPrice = Math.round((info.remainingAmount / info.remainingQty) * 10000) / 10000;
      amount = Math.round(unitPrice * qty * 100) / 100;
    } else {
      if (!l.sourceSalesQuoteLineId) throw new Error(`ردیف ${n}: انتخاب ردیف پیش‌فاکتور الزامی است`);
      const info = await salesQuoteLineUninvoiced(l.sourceSalesQuoteLineId, excludeInvoiceId);
      if (!info) throw new Error(`ردیف پیش‌فاکتور برای ردیف ${n} یافت نشد`);
      const reason = orderOrQuoteReason(info.salesQuote, h, "پیش‌فاکتور");
      if (reason) throw new Error(`ردیف ${n}: ${reason}`);
      const remainingQty = info.remainingQty - (await quoteLineOrderedQty(info.line.id));
      const key = `Q:${info.line.id}`;
      const total = (allocated.get(key) || 0) + qty;
      if (total > remainingQty + 1e-9) throw new Error(`ردیف ${n}: مجموع مقدار ردیف‌هایی که به این ردیف پیش‌فاکتور ارجاع می‌دهند (${total}) از باقیمانده‌ی قابل صورتحساب (${remainingQty}) بیشتر است`);
      allocated.set(key, total);
      if (!(remainingQty > 0)) throw new Error(`ردیف ${n}: مانده‌ی مقدار فاکتورنشده‌ی ردیف پیش‌فاکتور صفر یا منفی است`);
      sourceSalesQuoteLineId = info.line.id;
      goodsItemId = info.line.goodsItemId;
      unitId = info.line.unitId;
      unitPrice = Math.round((info.totalAmount / info.totalQty) * 10000) / 10000;
      amount = Math.round(unitPrice * qty * 100) / 100;
    }

    if (!(unitPrice >= 0)) throw new Error(`فی ردیف ${n} نامعتبر است`);
    if (!(amount >= 0)) throw new Error(`مبلغ ردیف ${n} نامعتبر است`);

    const discount = Number(l.discount) || 0;
    if (!(discount >= 0)) throw new Error(`تخفیف ردیف ${n} نامعتبر است`);
    if (discount > amount) throw new Error(`تخفیف ردیف ${n} نمی‌تواند از مبلغ ردیف بیشتر باشد`);

    const item = await prisma.goodsItem.findUnique({ where: { id: goodsItemId } });
    if (!item) throw new Error(`کالای ردیف ${n} یافت نشد`);
    // «بدون مبنا»: فقط خدمت (کالا فقط از طریق مبنای حواله/سفارش/پیش‌فاکتور وارد فاکتور می‌شود). ردیف کالاییِ بدون مبنای قدیمی که از قبل در همین فاکتور بوده، می‌ماند.
    // سفارش فروش و پیش‌فاکتور هم همین‌طورند: کالا فقط از مسیر حواله فروش می‌آید، از این دو فقط ردیف «خدمت» قابل انتخاب است.
    if (basis !== "SALES_DELIVERY" && item.kind !== "SERVICE" && !legacyNoBasisGoodsIds.has(item.id)) {
      throw new Error(`ردیف ${n}: برای مبنای «${BASIS_FA[basis]}» فقط خدمت قابل انتخاب است`);
    }
    if (!unitId) unitId = item.mainUnitId;

    // مبلغ/تخفیف به ارز مبنا و ارزش‌افزوده — دقیقاً هم‌الگوی purchaseInvoices.ts#validateLines
    const baseAmount = toBaseCurrencyAmount(amount, fxRate, currency, baseCurrency);
    const baseDiscount = toBaseCurrencyAmount(discount, fxRate, currency, baseCurrency);
    const vatRatePercent = resolveVatRatePercent(item, await getVatRatePercentForDate(h.date));
    const suggestedVatAmount = computeLineVat(baseAmount, baseDiscount, vatRatePercent);
    const vatAmount = l.vatAmount !== undefined && l.vatAmount !== null ? Number(l.vatAmount) : suggestedVatAmount;
    if (!(vatAmount >= 0)) throw new Error(`مالیات بر ارزش افزوده ردیف ${n} نامعتبر است`);

    cleaned.push({
      basis,
      sourceInventoryLineId,
      sourceSalesOrderLineId,
      sourceSalesQuoteLineId,
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
// انتخابگر «ردیف مبنا» در سطح ردیف — برای هر نوع مبنای ردیف: حواله فروش / سفارش فروش / پیش‌فاکتور. یک endpoint
// (basis-lines) ردیف‌های قابل صورتحساب (مانده > ۰) اسنادِ سازگار با هدر (طرف حساب/مرکز/نوع/ارز/تاریخ) را برمی‌گرداند؛
// سند ناسازگار هرگز لیست نمی‌شود و ثبت/ویرایش هم همین قواعد را سمت سرور دوباره اعمال می‌کند (validateLines).
// اطلاعات سند مبنای حواله (ارز/نوع فروش/مبلغ مبنا) فقط برای محاسبه‌ی فی/مبلغ ردیف در سرور استفاده می‌شود و در انتخابگر نمایش داده نمی‌شود.
// سفارش فروش و پیش‌فاکتور فقط ردیف «خدمت» می‌دهند (کالا فقط از مسیر حواله فروش وارد فاکتور می‌شود).
// =========================================================================

async function headerCtxFromQuery(q: any): Promise<HeaderCtx> {
  const customerId = Number(q.customerId);
  const salesTypeId = Number(q.salesTypeId);
  const salesCenterId = Number(q.salesCenterId);
  const currencyId = Number(q.currencyId);
  if (!customerId || !salesTypeId || !salesCenterId || !currencyId || !q.date) {
    throw new Error("تاریخ، مشتری، نوع فروش، مرکز فروش و ارز برای انتخاب مبنا الزامی است");
  }
  return buildHeaderCtx({ customerId, salesTypeId, salesCenterId, currencyId, date: new Date(q.date as string) });
}

interface BasisLineRow {
  basis: LineBasis;
  sourceInventoryLineId: number | null;
  sourceSalesOrderLineId: number | null;
  sourceSalesQuoteLineId: number | null;
  documentId: number;
  documentNumber: number;
  documentDate: Date;
  goodsItemId: number;
  goodsItemCode: string;
  goodsItemTitle: string;
  goodsItemKind: string;
  unitId: number;
  unitTitle: string;
  quantity: number;
  remaining: number;
  /** فی از سند مبنا محاسبه شده و قابل ویرایش نیست */
  priceLocked: boolean;
  unitPrice: number | null;
}

function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}

/** ردیف‌های قابل صورتحساب (مانده > ۰) یک سند مبنا */
async function basisDocumentLines(type: LineBasis, docId: number, excludeInvoiceId?: number): Promise<BasisLineRow[]> {
  const out: BasisLineRow[] = [];
  if (type === "SALES_DELIVERY") {
    const doc = await loadDeliveryDoc(docId);
    if (!doc) return out;
    for (const l of doc.lines as any[]) {
      const done = l.salesInvoiceLines.filter((i: any) => !excludeInvoiceId || i.salesInvoiceId !== excludeInvoiceId).reduce((s: number, i: any) => s + Number(i.quantity), 0);
      const remaining = Number(l.quantity) - done;
      if (!(remaining > 0)) continue;
      const base = await deliveryLineBaseInfo(l, excludeInvoiceId);
      out.push({
        basis: "SALES_DELIVERY",
        sourceInventoryLineId: l.id,
        sourceSalesOrderLineId: null,
        sourceSalesQuoteLineId: null,
        documentId: doc.id,
        documentNumber: doc.number,
        documentDate: doc.date,
        goodsItemId: l.goodsItemId,
        goodsItemCode: l.goodsItem.fullCode,
        goodsItemTitle: l.goodsItem.title,
        goodsItemKind: l.goodsItem.kind,
        unitId: l.unitId,
        unitTitle: l.unit.title,
        quantity: Number(l.quantity),
        remaining,
        priceLocked: !!base,
        unitPrice: base && base.uninvoicedQuantity > 0 ? round4(base.uninvoicedAmount / base.uninvoicedQuantity) : null,
      });
    }
  } else if (type === "SALES_ORDER") {
    const order = await prisma.salesOrder.findUnique({ where: { id: docId }, include: { lines: { include: { goodsItem: true, unit: true }, orderBy: [{ rowOrder: "asc" }, { id: "asc" }] } } });
    if (!order) return out;
    for (const l of order.lines as any[]) {
      if (l.goodsItem.kind !== "SERVICE") continue; // کالا فقط از مسیر حواله فروش
      const info = await salesOrderLineUninvoiced(l.id, excludeInvoiceId);
      if (!info || !(info.remainingQty > 0)) continue;
      out.push({
        basis: "SALES_ORDER",
        sourceInventoryLineId: null,
        sourceSalesOrderLineId: l.id,
        sourceSalesQuoteLineId: null,
        documentId: order.id,
        documentNumber: order.number,
        documentDate: order.date,
        goodsItemId: l.goodsItemId,
        goodsItemCode: l.goodsItem.fullCode,
        goodsItemTitle: l.goodsItem.title,
        goodsItemKind: l.goodsItem.kind,
        unitId: l.unitId,
        unitTitle: l.unit.title,
        quantity: info.totalQty,
        remaining: info.remainingQty,
        priceLocked: true,
        unitPrice: round4(info.remainingAmount / info.remainingQty),
      });
    }
  } else if (type === "SALES_QUOTE") {
    const quote = await prisma.salesQuote.findUnique({ where: { id: docId }, include: { lines: { include: { goodsItem: true, unit: true }, orderBy: [{ rowOrder: "asc" }, { id: "asc" }] } } });
    if (!quote) return out;
    for (const l of quote.lines as any[]) {
      if (l.goodsItem.kind !== "SERVICE") continue; // کالا فقط از مسیر حواله فروش
      const info = await salesQuoteLineUninvoiced(l.id, excludeInvoiceId);
      if (!info) continue;
      const remaining = info.remainingQty - (await quoteLineOrderedQty(l.id));
      if (!(remaining > 0)) continue;
      out.push({
        basis: "SALES_QUOTE",
        sourceInventoryLineId: null,
        sourceSalesOrderLineId: null,
        sourceSalesQuoteLineId: l.id,
        documentId: quote.id,
        documentNumber: quote.number,
        documentDate: quote.date,
        goodsItemId: l.goodsItemId,
        goodsItemCode: l.goodsItem.fullCode,
        goodsItemTitle: l.goodsItem.title,
        goodsItemKind: l.goodsItem.kind,
        unitId: l.unitId,
        unitTitle: l.unit.title,
        quantity: info.totalQty,
        remaining,
        priceLocked: true,
        unitPrice: round4(info.totalAmount / info.totalQty),
      });
    }
  }
  return out;
}

/** دلیل ناسازگاری یک سند مبنا با هدر (null = سازگار) */
async function basisDocumentReason(type: LineBasis, docId: number, h: HeaderCtx): Promise<{ reason: string | null; number: number }> {
  if (type === "SALES_DELIVERY") {
    const doc = await loadDeliveryDoc(docId);
    if (!doc) return { reason: "حواله فروش یافت نشد", number: docId };
    return { reason: deliveryDocReason(doc, h), number: doc.number };
  }
  if (type === "SALES_ORDER") {
    const o = await prisma.salesOrder.findUnique({ where: { id: docId } });
    if (!o) return { reason: "سفارش فروش یافت نشد", number: docId };
    return { reason: orderOrQuoteReason(o, h, "سفارش فروش"), number: o.number };
  }
  const q = await prisma.salesQuote.findUnique({ where: { id: docId } });
  if (!q) return { reason: "پیش‌فاکتور یافت نشد", number: docId };
  return { reason: orderOrQuoteReason(q, h, "پیش‌فاکتور"), number: q.number };
}

router.get("/sales-invoices/basis-lines", can(`${FORM}.view`), async (req, res) => {
  try {
    const type = req.query.type as LineBasis;
    if (!["SALES_DELIVERY", "SALES_ORDER", "SALES_QUOTE"].includes(type)) throw new Error("نوع مبنا نامعتبر است");
    const h = await headerCtxFromQuery(req.query);
    const excludeInvoiceId = req.query.excludeInvoiceId ? Number(req.query.excludeInvoiceId) : undefined;

    let docIds: number[];
    if (type === "SALES_DELIVERY") docIds = (await prisma.inventoryDocument.findMany({ where: { documentType: "SALES_DELIVERY", date: { lte: h.date } }, select: { id: true }, orderBy: [{ date: "asc" }, { number: "asc" }] })).map((d) => d.id);
    else if (type === "SALES_ORDER") docIds = (await prisma.salesOrder.findMany({ where: { customerId: h.customerId, status: "APPROVED" }, select: { id: true }, orderBy: [{ date: "asc" }, { number: "asc" }] })).map((d) => d.id);
    else docIds = (await prisma.salesQuote.findMany({ where: { customerId: h.customerId, status: "APPROVED" }, select: { id: true }, orderBy: [{ date: "asc" }, { number: "asc" }] })).map((d) => d.id);

    const lines: BasisLineRow[] = [];
    for (const id of docIds) {
      // eslint-disable-next-line no-await-in-loop
      const { reason } = await basisDocumentReason(type, id, h);
      if (reason) continue; // سند ناسازگار با هدر هرگز لیست نمی‌شود
      // eslint-disable-next-line no-await-in-loop
      lines.push(...(await basisDocumentLines(type, id, excludeInvoiceId)));
    }
    res.json(lines);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در دریافت ردیف‌های مبنا" });
  }
});

// =========================================================================
// CRUD
// =========================================================================

interface HeaderBody {
  date: string;
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
  // جمع پیش‌دریافت‌های تخصیص‌یافته به هر فاکتور (پیش‌دریافت عادی + پیش‌دریافت ارزش افزوده، به ارز فاکتور)؛ برای ستون «پیش‌دریافت» فهرست و جمع پای گرید
  const advanceSums = await prisma.salesInvoiceAdvanceAllocation.groupBy({ by: ["salesInvoiceId"], _sum: { amount: true } });
  const advanceByInvoice = new Map<number, number>(advanceSums.map((a: any) => [a.salesInvoiceId, Number(a._sum.amount ?? 0)]));
  res.json(
    items.map((d: any) => ({
      id: d.id,
      number: d.number,
      date: d.date,
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
      advanceAmount: advanceByInvoice.get(d.id) ?? 0,
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
      lines: {
        include: {
          goodsItem: true,
          unit: true,
          sourceInventoryLine: { include: { document: true } },
          sourceSalesOrderLine: { include: { salesOrder: true } },
          sourceSalesQuoteLine: { include: { salesQuote: true } },
        },
        orderBy: { rowOrder: "asc" },
      },
    },
  });
  if (!d) return res.status(404).json({ error: "فاکتور فروش یافت نشد" });
  // مبنا و سند مبدای هر ردیف از خودِ ردیف خوانده می‌شود (نه از هدر): نوع سند/شماره/تاریخ برای نمایش، مانده‌ی قابل صورتحساب (بدون احتساب همین فاکتور)
  // و این‌که فی از سند مبنا محاسبه شده (قفل) یا نه.
  const lineDtos = [];
  for (const l of d.lines as any[]) {
    let source: any = null;
    if (l.basis === "SALES_DELIVERY" && l.sourceInventoryLine) {
      const info = await salesDeliveryLineRemaining(l.sourceInventoryLineId, id);
      const base = info ? await deliveryLineBaseInfo(info.line, id) : null;
      source = { documentId: l.sourceInventoryLine.document.id, documentNumber: l.sourceInventoryLine.document.number, documentDate: l.sourceInventoryLine.document.date, remaining: info?.remaining ?? 0, priceLocked: !!base };
    } else if (l.basis === "SALES_ORDER" && l.sourceSalesOrderLine) {
      const info = await salesOrderLineUninvoiced(l.sourceSalesOrderLineId, id);
      source = { documentId: l.sourceSalesOrderLine.salesOrder.id, documentNumber: l.sourceSalesOrderLine.salesOrder.number, documentDate: l.sourceSalesOrderLine.salesOrder.date, remaining: info?.remainingQty ?? 0, priceLocked: true };
    } else if (l.basis === "SALES_QUOTE" && l.sourceSalesQuoteLine) {
      const info = await salesQuoteLineUninvoiced(l.sourceSalesQuoteLineId, id);
      const remaining = info ? info.remainingQty - (await quoteLineOrderedQty(l.sourceSalesQuoteLineId)) : 0;
      source = { documentId: l.sourceSalesQuoteLine.salesQuote.id, documentNumber: l.sourceSalesQuoteLine.salesQuote.number, documentDate: l.sourceSalesQuoteLine.salesQuote.date, remaining, priceLocked: true };
    }
    lineDtos.push({
      id: l.id,
      basis: l.basis,
      sourceInventoryLineId: l.sourceInventoryLineId,
      sourceSalesOrderLineId: l.sourceSalesOrderLineId,
      sourceSalesQuoteLineId: l.sourceSalesQuoteLineId,
      source,
      goodsItemId: l.goodsItemId,
      goodsItemCode: l.goodsItem.fullCode,
      goodsItemTitle: l.goodsItem.title,
      goodsItemKind: l.goodsItem.kind,
      unitId: l.unitId,
      unitTitle: l.unit.title,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      amount: Number(l.amount),
      discount: Number(l.discount),
      vatAmount: Number(l.vatAmount),
      description: l.description,
    });
  }
  res.json({
    id: d.id,
    number: d.number,
    date: d.date,
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
    lines: lineDtos,
  });
});

router.post("/sales-invoices", can(`${FORM}.create`), async (req, res) => {
  const body = req.body as HeaderBody;
  if (!body.date || !body.customerId || !body.salesTypeId || !body.salesCenterId || !body.currencyId) {
    return res.status(400).json({ error: "تاریخ، مشتری، نوع فروش، مرکز فروش و ارز الزامی است" });
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

    const headerCtx = await buildHeaderCtx({ customerId: body.customerId, salesTypeId: body.salesTypeId, salesCenterId: body.salesCenterId, currencyId: body.currencyId, date });
    const lines = await validateLines(body.lines, headerCtx, currency, fxRate, baseCurrency);

    // شماره از «الگوی شماره‌گذاری» (اتمی، داخل همین تراکنش) می‌آید؛ اگر برای (نوع فروش، مرکز فروش) الگویی نباشد ذخیره ممنوع است.
    const created = await prisma.$transaction(async (tx: any) => {
      const allocated = await allocateDocumentNumber(tx, { form: "SALES_INVOICE", salesTypeId: body.salesTypeId, salesCenterId: body.salesCenterId, fiscalPeriodId: fiscalPeriod.id, date });
      const number = allocated.number;
      return tx.salesInvoice.create({
      data: {
        fiscalPeriodId: fiscalPeriod.id,
        number,
        numberingPatternId: allocated.numberingPatternId,
        date,
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
  if (!body.date || !body.customerId || !body.salesTypeId || !body.salesCenterId || !body.currencyId) {
    return res.status(400).json({ error: "تاریخ، مشتری، نوع فروش، مرکز فروش و ارز الزامی است" });
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

    // ردیف‌های کالاییِ «بدون مبنا/سفارش/پیش‌فاکتور» که از طراحی قبلی در همین فاکتور مانده‌اند می‌توانند بمانند؛ ردیف تازه‌ی کالایی با این مبناها مجاز نیست (کالا فقط از حواله فروش)
    const legacyRows = await prisma.salesInvoiceLine.findMany({ where: { salesInvoiceId: id, basis: { in: ["NO_BASIS", "SALES_ORDER", "SALES_QUOTE"] }, goodsItem: { kind: "GOODS" } }, select: { goodsItemId: true } });
    const headerCtx = await buildHeaderCtx({ customerId: body.customerId, salesTypeId: body.salesTypeId, salesCenterId: body.salesCenterId, currencyId: body.currencyId, date });
    const lines = await validateLines(body.lines, headerCtx, currency, fxRate, baseCurrency, id, new Set(legacyRows.map((r) => r.goodsItemId)));
    await assertAdvanceAllocationsStillValid(id, { customerId: body.customerId, currencyId: body.currencyId, date, netTotal: salesInvoiceNetTotal(lines as any), vatTotal: salesInvoiceVatTotal(lines as any, fxRate) });

    const updated = await prisma.$transaction(async (tx: any) => {
      // «الگوی شماره‌گذاری»: شماره عوض نمی‌شود؛ تغییر الگو/سال مالی رد و تغییر تاریخ با کنترل تاریخ الگو سنجیده می‌شود (داخل همین تراکنش)
      await assertEditAllowed(tx, existing, { form: "SALES_INVOICE", salesTypeId: body.salesTypeId, salesCenterId: body.salesCenterId, fiscalPeriodId: fiscalPeriod.id, date });
      await tx.salesInvoiceLine.deleteMany({ where: { salesInvoiceId: id } });
      return tx.salesInvoice.update({
        where: { id },
        data: {
          fiscalPeriodId: fiscalPeriod.id,
          date,
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
      include: { receiptSettlementLine: { include: { receipt: true, receiptType: true } } },
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
        const account = treasurySettings.find((s) => s.accountType === "RECEIPT_SUBJECT" && s.receiptTypeId === rt.id)?.account;
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
