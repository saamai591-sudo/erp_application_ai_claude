import { prisma, Db } from "../lib/prisma";
import { getLineAmounts, setLineAmount } from "./documentItemAmountService";
import { CARRY_FORWARD_OPENING_WHERE } from "./warehouseStockService";
import { getPreviousYearAccountingCloseProblem, lockOpeningYearShared, assertFiscalYearNotAccountingClosed } from "./inventoryAccountingGuards";

// ارزش‌گذاری در سطح «کالا» است (تصمیم صریح کاربر، جایگزین کاردکس سطح کالا+انبار قبلی): وضعیت/قفل ارزش‌گذاری (GoodsPricingStatus) در سطح
// کالا+دوره‌ی گزارشگری است و کلید محاسبه هم فقط «کالا» است — میانگین موزون متحرک روی مجموع همه‌ی انبارهای کالا حساب می‌شود و انبار هیچ
// نقشی در محاسبه ندارد (اطلاعات انبار روی ردیف‌های سند دست‌نخورده می‌ماند). ردیف‌های انتقال بین انبارها در این استخر واحد اثر ارزشی خالص
// صفر دارند. داده از شروع دوره مالی تا پایان دوره‌ی گزارشگری بارگذاری می‌شود (حرکت‌های بعد از آن بی‌اثرند)، ولی فقط ردیف‌های داخل خودِ
// دوره ارزش‌گذاری/نوشته می‌شوند؛ ردیف‌های دوره‌های قبل با مبلغ ثبت‌شده‌شان در استخر می‌آیند. موجودی اول دوره (دستی، یا سیستمیِ مبلغ‌دار پس
// از «بستن حسابداری موجودی» سال قبل) یک رکورد معتبر است. (مرجع قدیمی Documents/pricingAlghoritm.sql کاردکس را به‌ازای کالا+انبار می‌گرفت؛
// آن رفتار دیگر مبنا نیست.)
//
// طبقه‌بندی جهت هر نوع سند دقیقاً همان جدول SIGNED_TYPES موجود در warehouseStockService.ts است.
//
// انتقال بین انبارها (WAREHOUSE_TRANSFER_OUT/IN): برخلاف تصور اولیه («چون در سطح کالا خالص صفر است
// نادیده گرفته می‌شود»)، طبق موتور مرجع (Documents/pricingAlghoritm.sql، بخش «انتقالی» —
// DocumentType=5) این دو باید قیمت‌گذاری شوند، نه نادیده گرفته شوند: صفر بودن خالص فقط در مجموع کل
// تاریخچه درست است، نه در هر لحظه — چون سند ارسال و سند دریافت اغلب تاریخ (و گاهی دوره‌ی گزارشگری)
// متفاوتی دارند، در فاصله‌ی بین آن دو تاریخ کالا واقعاً «در راه» است و باید به همین صورت (خروج در تاریخ
// ارسال، ورود در تاریخ دریافت) در کاردکس جاری کالا لحاظ شود. رفتار:
// - WAREHOUSE_TRANSFER_OUT دقیقاً مثل بقیه‌ی OUT_COMPUTED_TYPES است (فی میانگین موزون در همان لحظه × مقدار).
// - WAREHOUSE_TRANSFER_IN بر خلاف بقیه‌ی انواع ورودی، فی میانگین جاری خودش را نمی‌گیرد؛ مبلغش سهم
//   متناسب (بر اساس مقدار) از مبلغ همان ردیف WAREHOUSE_TRANSFER_OUT است که ارجاع می‌دهد (تا کالا با
//   همان بهایی که از انبار مبدا خارج شده، وارد انبار مقصد شود) — دقیقاً معادل
//   COALESCE(pt.Amount, oi.Price, CardexFee*Quantity) در موتور مرجع، با این تفاوت که چون این پروژه
//   ترتیب تاریخ سند ارسال <= سند دریافت را از قبل در سطح اپلیکیشن اجباری کرده (نگاه کنید به
//   warehouseTransferIn.ts)، ردیف OUT همیشه زودتر از IN در همین کاردکس پردازش و مبلغش «شناخته‌شده»
//   است — نیازی به COALESCE/fallback یا لوپ همگرایی جداگانه (مثل برگشت تامین‌کننده) نیست.
//
// منبع مبلغ:
// - INITIAL_INVENTORY / WAREHOUSE_RECEIPT / PRODUCTION_RECEIPT / WAREHOUSE_ADJUSTMENT (اضافات
//   انبارگردانی): مبلغ «داده‌شده» (ستون amount سند) — طبق تصمیم صریح کاربر، این چهار نوع سند باید
//   توسط خودِ کاربر قیمت‌گذاری شوند (نه موتور)؛ لایه‌ی اعتبارسنجی جداگانه (goodsPricingValidation.ts)
//   پیش از اجرا بررسی می‌کند که amount این‌ها صفر نمانده باشد — این سرویس خودش کنترل/مسدودسازی خاصی
//   روی صفر بودن آن‌ها اعمال نمی‌کند (فرض بر این است که لایه‌ی اعتبارسنجی قبلاً همه‌چیز را تایید کرده).
// - بقیه‌ی انواع (صادره‌ها، برگشت‌ها، انتقالی): مبلغ توسط همین موتور محاسبه می‌شود — صادره‌ها و
//   WAREHOUSE_TRANSFER_OUT بر اساس میانگین موزون متحرک، WAREHOUSE_TRANSFER_IN بر اساس سهم متناسب از
//   ردیف ارسال مرتبط (بالا توضیح داده شد).
//
// طبق مستند «موتور قیمت‌گذاری در حالت برگشت»: وقتی به یک برگشت به تامین‌کننده می‌رسیم که به ردیف رسید
// مشخصی ارجاع دارد —
// ۱) اگر برگشت، کل مقدار آن رسید را برمی‌گرداند: مبلغ رسید مستقیماً «ست» (جایگزین، نه کم) می‌شود با
//    مبلغ تازه‌محاسبه‌شده‌ی برگشت (بر مبنای کاردکس در همان لحظه)، و کاردکس دوباره محاسبه می‌شود؛ این
//    فرایند تا همگرایی مبلغ برگشت با مبلغ رسید تکرار می‌شود.
// ۲) اگر برگشت فقط بخشی از مقدار رسید را برمی‌گرداند: رسید به دو «سهم» تقسیم می‌شود — سهم بازگشتی
//    (متناسب با مقدار برگشتی از مبلغ اصلی رسید، که مثل حالت ۱ در لوپ همگرا می‌شود) و سهم باقیمانده
//    (ثابت، بقیه‌ی مبلغ اصلی). این تقسیم فقط برای محاسبه‌ی کاردکس است؛ ردیف رسید در دیتابیس هیچ‌وقت
//    شکسته نمی‌شود — نتیجه‌ی نهایی (سهم باقیمانده + سهم(های) همگراشده‌ی برگشت) در همان یک ردیف نوشته
//    می‌شود. اگر چند برگشت جداگانه به یک رسید ارجاع داشته باشند، هرکدام سهم بازگشتی مستقل خودشان را
//    دارند (بر اساس مقدار خودشان) و همه‌ی سهم‌ها هم‌زمان با هم همگرا می‌شوند.
//
// قفل بودن دوره (طبق Documents/WareHouseAmountChanges.md، این بخش کاملاً بازنویسی شده): چون دیگر هیچ
// ستون خام amount/unitCost ای روی خودِ سند نیست (فقط تاریخچه‌ی DocumentItemAmount)، مفهوم «overwrite
// نکردن ردیف قفل‌شده» دیگر لازم نیست — هر تغییر، قفل باشد یا نه، فقط یک رکورد تازه‌ی DocumentItemAmount
// اضافه می‌کند (هرگز رکورد قبلی را دست نمی‌زند). «قفل بودن» فقط برای برچسب‌گذاریِ گزارشی به کار می‌رود:
// اگر ردیف در دوره‌ی در حال قیمت‌گذاری باشد priceType=ENGINE_PRICING، اگر در دوره‌ای زودتر (قبلاً
// قیمت‌گذاری‌شده) باشد priceType=ENGINE_CORRECTION — دقیقاً همان تمایزی که قبلاً appliedToLine در
// GoodsPricingAdjustment (اکنون بازنشسته) نشان می‌داد، و گزارش «اصلاحیه‌های قیمت‌گذاری» حالا با فیلتر
// priceType=ENGINE_CORRECTION روی همین جدول کار می‌کند (نگاه کنید به routes/goodsPricing.ts).

// طبق تصمیم صریح کاربر: «اضافات انبارگردانی» (WAREHOUSE_ADJUSTMENT) هم باید توسط کاربر قیمت‌گذاری شود
// (نه موتور) — دقیقاً مثل رسید انبار خرید/رسید تولید/موجودی اول دوره. این سند فقط برای مقدار مثبت
// (مازاد) استفاده می‌شود؛ کسری انبارگردانی نوع سند کاملاً جدایی دارد (INVENTORY_COUNTING_SHORTAGE، در
// OUT_COMPUTED_TYPES، همچنان توسط موتور محاسبه می‌شود).
// این چهار نوع سند («اسنادی که باید توسط کاربر قیمت‌گذاری شوند») از goodsPricingValidation.ts هم برای
// بررسی «آیا مبلغ این‌ها صفر مانده» استفاده می‌شود — به همین دلیل به‌جای ماندن در حالت private، با یک
// نام صریح‌تر (USER_PRICED_TYPES) هم export می‌شود.
const IN_GIVEN_TYPES = new Set(["INITIAL_INVENTORY", "WAREHOUSE_RECEIPT", "PRODUCTION_RECEIPT", "WAREHOUSE_ADJUSTMENT"]);
export const USER_PRICED_TYPES = IN_GIVEN_TYPES;
const IN_COMPUTED_TYPES = new Set(["SALES_RETURN", "STORE_SALE_RETURN", "CENTER_CONSUMPTION_RETURN", "PROJECT_CONSUMPTION_RETURN", "PRODUCTION_CONSUMPTION_RETURN"]);
const OUT_COMPUTED_TYPES = new Set([
  "SALES_DELIVERY",
  "STORE_SALE_ISSUE",
  "CENTER_CONSUMPTION",
  "PROJECT_CONSUMPTION",
  "PRODUCTION_CONSUMPTION",
  "FIXED_ASSET_ISSUE",
  "WAREHOUSE_TRANSFER_OUT",
  "INVENTORY_COUNTING_SHORTAGE",
]);
export const PRICING_DOC_TYPES = [
  ...IN_GIVEN_TYPES,
  ...IN_COMPUTED_TYPES,
  ...OUT_COMPUTED_TYPES,
  "SUPPLIER_RETURN",
  "WAREHOUSE_TRANSFER_IN",
];

// عنوان فارسی هر نوع سند انبار — هم در گزارش «اصلاحیه‌های قیمت‌گذاری» (goodsPricing.ts) و هم در پیام‌های
// لایه‌ی اعتبارسنجی (goodsPricingValidation.ts) استفاده می‌شود؛ یک‌جا نگه داشته می‌شود تا دو کپی از هم
// جدا نشوند.
export const DOC_TYPE_FA: Record<string, string> = {
  INITIAL_INVENTORY: "موجودی اول دوره",
  WAREHOUSE_RECEIPT: "رسید انبار خرید",
  WAREHOUSE_ADJUSTMENT: "اضافات انبارگردانی",
  SALES_DELIVERY: "حواله فروش",
  SALES_RETURN: "برگشت از فروش",
  STORE_SALE_ISSUE: "حواله فروش فروشگاهی",
  STORE_SALE_RETURN: "برگشت حواله فروش فروشگاهی",
  SUPPLIER_RETURN: "برگشت به تامین‌کننده",
  PRODUCTION_RECEIPT: "رسید تولید",
  CENTER_CONSUMPTION: "مصرف مرکز هزینه",
  PROJECT_CONSUMPTION: "مصرف پروژه",
  PRODUCTION_CONSUMPTION: "مصرف تولید",
  CENTER_CONSUMPTION_RETURN: "برگشت مصرف مرکز هزینه",
  PROJECT_CONSUMPTION_RETURN: "برگشت مصرف پروژه",
  PRODUCTION_CONSUMPTION_RETURN: "برگشت مصرف تولید",
  FIXED_ASSET_ISSUE: "حواله دارایی ثابت",
  INVENTORY_COUNTING_SHORTAGE: "کسری انبارگردانی",
  WAREHOUSE_TRANSFER_IN: "رسید انتقال",
};

const MAX_ITERATIONS = 25;

async function getBaseCurrencyDecimalPlaces(db: Db = prisma): Promise<number> {
  const baseCurrency = await db.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) throw new Error("ارز پایه تعریف نشده است؛ ابتدا یک ارز را به‌عنوان ارز پایه مشخص کنید");
  return baseCurrency.decimalPlaces;
}

function round(value: number, decimalPlaces: number): number {
  const factor = Math.pow(10, decimalPlaces);
  return Math.round(value * factor) / factor;
}

type Line = {
  id: number;
  quantity: any;
  amount: any;
  sourceWarehouseReceiptLineId: number | null;
  sourceWarehouseTransferOutLineId: number | null;
  document: { documentType: string; date: Date; warehouseId: number; number?: number; creationType?: string };
};

// یک بار کامل کاردکس سطح کالا را (با یک تخمین فعلی از سهم‌های بازگشتی هر برگشت تامین‌کننده) طی می‌کند.
// طبق تصمیم صریح کاربر کلید ارزش‌گذاری فقط «کالا» است: همه‌ی انبارها در یک استخر (qty/value) تجمیع می‌شوند و انبار هیچ نقشی در
// محاسبه ندارد (فقط روی خودِ ردیف‌های سند باقی می‌ماند). ردیف‌های قبل از شروع دوره‌ی گزارشگری (periodFrom) «همان‌طور که
// هستند» با مبلغ ثبت‌شده‌شان وارد استخر می‌شوند و هرگز بازمحاسبه/بازنویسی نمی‌شوند؛ فقط ردیف‌های داخل دوره محاسبه می‌شوند.
function walkKardex(
  lines: Line[],
  periodFrom: Date,
  returningLinesByReceipt: Map<number, Line[]>,
  fixedRemainingAmount: Map<number, number>,
  returnWorkingValue: Map<number, number>,
  fixedReturnAmount: Map<number, number>,
  externalTransferOut: Map<number, { qty: number; amount: number }>,
  decimalPlaces: number
) {
  const state = { qty: 0, value: 0 };
  const s = state;

  const computed = new Map<number, number>();
  const newReturnWorkingValue = new Map<number, number>();
  const linesById = new Map<number, Line>(lines.map((l) => [l.id, l]));

  for (const line of lines) {
    const qty = Number(line.quantity);
    const type = line.document.documentType;
    const inPeriod = line.document.date >= periodFrom;

    if (IN_GIVEN_TYPES.has(type)) {
      const returningLines = returningLinesByReceipt.get(line.id);
      if (!returningLines || returningLines.length === 0) {
        s.qty += qty;
        s.value += Number(line.amount);
      } else {
        const returnedQty = returningLines.reduce((sum, r) => sum + Number(r.quantity), 0);
        const remainingQty = qty - returnedQty;
        s.qty += remainingQty;
        s.value += fixedRemainingAmount.get(line.id) || 0;
        for (const r of returningLines) {
          s.qty += Number(r.quantity);
          s.value += returnWorkingValue.get(r.id) || 0;
        }
      }
      continue;
    }

    if (!inPeriod) {
      // دوره‌ی قبلی: مبلغ ثبت‌شده‌ی همین ردیف (که همان دوره محاسبه کرده) بی‌تغییر استفاده می‌شود
      const amt = Number(line.amount);
      computed.set(line.id, amt);
      if (type === "WAREHOUSE_TRANSFER_IN" || IN_COMPUTED_TYPES.has(type)) {
        s.qty += qty;
        s.value += amt;
      } else {
        s.qty -= qty;
        s.value -= amt;
      }
      continue;
    }

    if (type === "WAREHOUSE_TRANSFER_IN") {
      // مبلغ = سهم متناسب (بر اساس مقدار) از مبلغِ ردیف WAREHOUSE_TRANSFER_OUT مرتبط (قبلاً در همین کاردکس محاسبه/ثبت شده، چون
      // ترتیب تاریخ ارسال<=دریافت در سطح اپلیکیشن اجباری است). در استخر سطح‌کالا، ارسال و دریافت اثر ارزشی خالص صفر دارند.
      const outLine = line.sourceWarehouseTransferOutLineId ? linesById.get(line.sourceWarehouseTransferOutLineId) : undefined;
      // حواله‌ی انتقالیِ مبدا که قبل از شروع پنجره‌ی بارگذاری (سال مالی قبل) ثبت شده: مقدار/مبلغ ثبت‌شده‌ی خودِ آن ردیف
      const external = !outLine && line.sourceWarehouseTransferOutLineId ? externalTransferOut.get(line.sourceWarehouseTransferOutLineId) : undefined;
      const outQty = outLine ? Number(outLine.quantity) : external ? external.qty : 0;
      const outAmount = outLine ? computed.get(outLine.id) || 0 : external ? external.amount : 0;
      const amt = outQty > 0 ? round((outAmount * qty) / outQty, decimalPlaces) : 0;
      computed.set(line.id, amt);
      s.qty += qty;
      s.value += amt;
      continue;
    }

    if (IN_COMPUTED_TYPES.has(type)) {
      const avgCost = s.qty > 0 ? s.value / s.qty : 0;
      const amt = round(qty * avgCost, decimalPlaces);
      computed.set(line.id, amt);
      s.qty += qty;
      s.value += amt;
      continue;
    }

    // OUT_COMPUTED_TYPES + SUPPLIER_RETURN
    const fixed = fixedReturnAmount.get(line.id);
    const avgCost = s.qty > 0 ? s.value / s.qty : 0;
    const amt = fixed !== undefined ? fixed : round(qty * avgCost, decimalPlaces);
    computed.set(line.id, amt);
    s.qty -= qty;
    s.value -= amt;
    // فقط برگشت‌هایی که در لوپ همگرایی (رسید و برگشت هر دو داخل دوره) شرکت دارند
    if (type === "SUPPLIER_RETURN" && returnWorkingValue.has(line.id)) {
      newReturnWorkingValue.set(line.id, amt);
    }
  }

  return { computed, newReturnWorkingValue, state };
}

function mapsEqual(a: Map<number, number>, b: Map<number, number>, epsilon: number): boolean {
  const keys = new Set([...a.keys(), ...b.keys()]);
  for (const k of keys) {
    if (Math.abs((a.get(k) || 0) - (b.get(k) || 0)) > epsilon) return false;
  }
  return true;
}

async function findSuccessorPeriod(reportingPeriodId: number) {
  const period = await prisma.reportingPeriod.findUnique({ where: { id: reportingPeriodId } });
  if (!period) throw new Error("دوره گزارشگری یافت نشد");
  const successor = await prisma.reportingPeriod.findFirst({
    where: { fromDate: { gt: period.toDate } },
    orderBy: { fromDate: "asc" },
  });
  return { period, successor };
}

// این کالا در این دوره (یا هر دوره‌ی دیگری) قیمت‌گذاری شده یا نه
export async function getPricingStatusMap(goodsItemIds: number[], reportingPeriodId: number) {
  const rows = await prisma.goodsPricingStatus.findMany({
    where: { goodsItemId: { in: goodsItemIds }, reportingPeriodId },
    select: { goodsItemId: true },
  });
  return new Set(rows.map((r) => r.goodsItemId));
}

/**
 * فیلتر سند برای «پنجره‌ی ارزش‌گذاری»: از شروع دوره مالی تا پایان دوره‌ی گزارشگری (حرکت‌های بعد از آن هیچ اثری ندارند).
 * سند انتقال مانده‌ی سیستمیِ «بستن تعدادی» فقط وقتی می‌آید که دقیقاً در تاریخ شروع پنجره باشد (افتتاحیه‌ی مبلغ‌دارِ همین سال مالی،
 * که «بستن حسابداری موجودی» مبلغش را تعیین کرده)؛ افتتاحیه‌ی سال‌های بعد در آن نمی‌آید. موجودی اول دوره (دستی یا سیستمی) یک
 * رکورد/گردش معتبر است. حد بالای تاریخ با lt هم قابل تنظیم است (برای «قبل از شروع دوره»).
 */
export function pricingDocumentWhere(windowFrom: Date, upper: { lte: Date } | { lt: Date }) {
  return {
    documentType: { in: PRICING_DOC_TYPES as any },
    date: { gte: windowFrom, ...upper },
    OR: [{ NOT: CARRY_FORWARD_OPENING_WHERE }, { date: windowFrom }],
  };
}

export interface PricingWindow {
  /** شروع دوره مالیِ دوره‌ی گزارشگری — شروع بارگذاری */
  windowFrom: Date;
  /** شروع دوره‌ی گزارشگری — ردیف‌های قبل از آن فقط با مبلغ ثبت‌شده در استخر می‌آیند، از آن به بعد محاسبه می‌شوند */
  periodFrom: Date;
  /** پایان دوره‌ی گزارشگری — بالاترین تاریخ بارگذاری */
  toDate: Date;
}

/**
 * کاردکس کامل یک کالا (طبق تصمیم صریح کاربر فقط «کالا»؛ میانگین موزون متحرک روی مجموع همه‌ی انبارها) در پنجره‌ی
 * [شروع دوره مالی، پایان دوره‌ی گزارشگری]. تنها محل این محاسبه — هم priceItem و هم «بستن حسابداری موجودی» (مانده‌ی ارزشی پایان
 * دوره مالی؛ آنجا periodFrom=windowFrom یعنی بازمحاسبه‌ی کل سال) از همین تابع استفاده می‌کنند. firstMovementDate تاریخ اولین
 * گردشِ کالا در همه‌ی انبارها (شامل افتتاحیه) در همین پنجره است.
 */
export async function computeItemKardex(goodsItemId: number, win: PricingWindow, db: Db = prisma) {
  const decimalPlaces = await getBaseCurrencyDecimalPlaces(db);
  const epsilon = Math.pow(10, -decimalPlaces) / 2;

  const rawLines = await db.inventoryDocumentLine.findMany({
    where: { goodsItemId, document: pricingDocumentWhere(win.windowFrom, { lte: win.toDate }) },
    select: {
      id: true,
      quantity: true,
      sourceWarehouseReceiptLineId: true,
      sourceWarehouseTransferOutLineId: true,
      document: { select: { documentType: true, date: true, warehouseId: true, number: true, creationType: true } },
    },
    orderBy: [{ document: { date: "asc" } }, { documentId: "asc" }, { rowOrder: "asc" }, { id: "asc" }],
  });
  // مبلغ فعلی هر ردیف دیگر ستون خام نیست — طبق Documents/WareHouseAmountChanges.md، SUM(Difference)
  // تاریخچه‌ی همان ردیف است؛ یک کوئری batched برای همه‌ی ردیف‌های این اجرا، نه یک کوئری جدا به ازای هرکدام.
  const currentAmounts = await getLineAmounts(rawLines.map((l) => l.id), db);
  const lines = rawLines.map((l) => ({ ...l, amount: Number(currentAmounts.get(l.id) ?? 0) })) as Line[];
  const firstMovementDate = lines.length ? lines[0].document.date : null;

  // ردیف‌های مرجع بیرون از پنجره (سال مالی قبل): حواله‌ی انتقالیِ مبدا برای رسید انتقال، و رسید خرید برای برگشت به تامین‌کننده —
  // مقدار/مبلغ ثبت‌شده‌ی خودشان استفاده می‌شود
  const inSet = new Set(lines.map((l) => l.id));
  const externalIds = Array.from(
    new Set(
      lines.flatMap((l) => [l.sourceWarehouseTransferOutLineId, l.sourceWarehouseReceiptLineId]).filter((id): id is number => !!id && !inSet.has(id))
    )
  );
  const external = new Map<number, { qty: number; amount: number }>();
  if (externalIds.length) {
    const outs = await db.inventoryDocumentLine.findMany({ where: { id: { in: externalIds } }, select: { id: true, quantity: true } });
    const outAmounts = await getLineAmounts(externalIds, db);
    for (const o of outs) external.set(o.id, { qty: Number(o.quantity), amount: Number(outAmounts.get(o.id) ?? 0) });
  }

  // پیش‌پردازش برگشت‌های تامین‌کننده (فقط برگشت‌های داخل دوره):
  //  • رسید و برگشت هر دو داخل دوره: سهم ثابتِ «باقیمانده» و سهم اولیه‌ی هر برگشت (متناسب با مقدار خودش از مبلغ اصلی رسید) و
  //    لوپ همگرایی (نگاه کنید به یادداشت بالای فایل)؛
  //  • رسید قبل از دوره (یا بیرون از پنجره): مبلغ برگشت = سهم متناسب از مبلغ ثبت‌شده‌ی رسید، بدون همگرایی.
  const returningLinesByReceipt = new Map<number, Line[]>();
  const fixedReturnAmount = new Map<number, number>();
  const lineById = new Map<number, Line>(lines.map((l) => [l.id, l]));
  for (const l of lines) {
    if (l.document.documentType !== "SUPPLIER_RETURN" || !l.sourceWarehouseReceiptLineId || l.document.date < win.periodFrom) continue;
    const receipt = lineById.get(l.sourceWarehouseReceiptLineId);
    if (receipt && receipt.document.date >= win.periodFrom) {
      const arr = returningLinesByReceipt.get(receipt.id) || [];
      arr.push(l);
      returningLinesByReceipt.set(receipt.id, arr);
    } else {
      const src = receipt ? { qty: Number(receipt.quantity), amount: Number(receipt.amount) } : external.get(l.sourceWarehouseReceiptLineId);
      if (src && src.qty > 0) fixedReturnAmount.set(l.id, round((src.amount * Number(l.quantity)) / src.qty, decimalPlaces));
    }
  }
  const fixedRemainingAmount = new Map<number, number>();
  const initialReturnShare = new Map<number, number>();
  for (const [receiptId, returningLines] of returningLinesByReceipt) {
    const receipt = lineById.get(receiptId)!;
    const originalAmount = Number(receipt.amount);
    const originalQty = Number(receipt.quantity);
    let sumShares = 0;
    for (const r of returningLines) {
      const share = originalQty > 0 ? round((originalAmount * Number(r.quantity)) / originalQty, decimalPlaces) : 0;
      initialReturnShare.set(r.id, share);
      sumShares += share;
    }
    fixedRemainingAmount.set(receiptId, round(originalAmount - sumShares, decimalPlaces));
  }

  const externalTransferOut = external;
  let returnWorkingValue = new Map<number, number>(initialReturnShare);
  let computed = new Map<number, number>();
  let state = { qty: 0, value: 0 };
  let converged = false;
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const result = walkKardex(lines, win.periodFrom, returningLinesByReceipt, fixedRemainingAmount, returnWorkingValue, fixedReturnAmount, externalTransferOut, decimalPlaces);
    computed = result.computed;
    state = result.state;
    if (mapsEqual(result.newReturnWorkingValue, returnWorkingValue, epsilon)) {
      returnWorkingValue = result.newReturnWorkingValue;
      converged = true;
      break;
    }
    returnWorkingValue = result.newReturnWorkingValue;
  }
  if (!converged) throw new Error("محاسبه قیمت‌گذاری همگرا نشد؛ لطفاً اسناد کالا را بررسی کنید");

  return { lines, computed, initialReturnShare, state, decimalPlaces, epsilon, firstMovementDate };
}

export interface PreviousValuationProblem {
  goodsItemId: number;
  /** دوره‌ی گزارشگری قبلیِ دارای گردش که برای کالا ارزش‌گذاری ندارد */
  period: { id: number; title: string };
}

/**
 * کنترل «ارزش‌گذاری دوره‌ی گزارشگری قبل» (طبق تصمیم صریح کاربر؛ جدا از کنترل بستن حسابداری سال مالی قبل): کالایی که قبل از شروع
 * این دوره‌ی گزارشگری، در پنجره‌ی [شروع دوره مالی، شروع دوره) گردشی داشته (اولین گردش، شامل افتتاحیه، قبل از شروع دوره باشد) =
 * «مشمول ارزش‌گذاری دوره‌ی قبل». برای چنین کالایی آخرین دوره‌ی گزارشگریِ قبلیِ همان سال مالی که در آن گردش داشته — **موجودی اول دوره
 * هم گردش حساب می‌شود** (کالای فقط‌-افتتاحیه هم در دوره‌ی افتتاحیه پردازش و رکورد می‌گیرد، پس باید همان رکورد را داشته باشد) —
 * باید رکورد ارزش‌گذاری (GoodsPricingStatus) داشته باشد؛ رکورد یعنی «در آن دوره پردازش شده»، حتی اگر همان دوره گردش جدیدی نداشته.
 * اگر کالا قبل از شروع دوره هیچ گردشی نداشته باشد (اولین گردشش از شروع دوره یا بعد است)، مشمول نیست. هیچ کنترلی روی سال مالی
 * قبل نیست.
 */
export async function findPreviousValuationProblems(
  goodsItemIds: number[],
  period: { fromDate: Date; fiscalPeriodId: number },
  db: Db = prisma
): Promise<PreviousValuationProblem[]> {
  if (goodsItemIds.length === 0) return [];
  const fiscal = await db.fiscalPeriod.findUnique({ where: { id: period.fiscalPeriodId } });
  if (!fiscal) return [];
  const priorPeriods = await db.reportingPeriod.findMany({
    where: { fiscalPeriodId: period.fiscalPeriodId, toDate: { lt: period.fromDate } },
    orderBy: { toDate: "desc" },
  });
  if (priorPeriods.length === 0) return [];

  const rows = await db.inventoryDocumentLine.findMany({
    where: { goodsItemId: { in: goodsItemIds }, document: pricingDocumentWhere(fiscal.fromDate, { lt: period.fromDate }) },
    select: { goodsItemId: true, document: { select: { date: true } } },
  });
  const byItem = new Map<number, { date: Date }[]>();
  for (const r of rows) {
    const arr = byItem.get(r.goodsItemId) || [];
    arr.push(r.document);
    byItem.set(r.goodsItemId, arr);
  }

  const required = new Map<number, { id: number; title: string }>();
  for (const [itemId, docs] of byItem) {
    const target = priorPeriods.find((rp) => docs.some((d) => d.date >= rp.fromDate && d.date <= rp.toDate));
    if (target) required.set(itemId, { id: target.id, title: target.title });
  }
  if (required.size === 0) return [];

  const statuses = await db.goodsPricingStatus.findMany({
    where: { goodsItemId: { in: Array.from(required.keys()) }, reportingPeriodId: { in: Array.from(new Set(Array.from(required.values()).map((r) => r.id))) } },
    select: { goodsItemId: true, reportingPeriodId: true },
  });
  const valued = new Set(statuses.map((s) => `${s.goodsItemId}:${s.reportingPeriodId}`));
  const problems: PreviousValuationProblem[] = [];
  for (const [itemId, rp] of required) {
    if (!valued.has(`${itemId}:${rp.id}`)) problems.push({ goodsItemId: itemId, period: rp });
  }
  return problems;
}

/**
 * ارزش‌گذاری یک کالا در یک دوره‌ی گزارشگری — کل کار (قفل، پیش‌نیازها، محاسبه، نوشتن) در یک تراکنش:
 *  • قفل «مشترک» مبلغ افتتاحیه‌ی دوره مالیِ این دوره‌ی گزارشگری (lockOpeningYearShared) پیش از هر خواندن گرفته می‌شود، پس
 *    برگشتِ هم‌زمان «بستن حسابداری» (قفل انحصاری همان دوره) یا قبل از شروع ما کامل شده و ما نتیجه‌اش را می‌بینیم، یا تا commit
 *    ما منتظر می‌ماند و بعد، وجود این ارزش‌گذاری را می‌بیند و رد می‌شود؛
 *  • پیش‌نیازها: (۱) بستن حسابداری موجودیِ دوره مالی قبل (سطح سال مالی؛ هیچ کنترلی روی ارزش‌گذاری سطح‌کالای سال قبل نیست)،
 *    (۲) ارزش‌گذاری دوره‌ی گزارشگری قبلیِ دارای گردش برای همین کالا (findPreviousValuationProblems، سطح دوره‌ی گزارشگری)؛
 *  • داده از شروع دوره مالی تا پایان همین دوره‌ی گزارشگری بارگذاری می‌شود، ولی فقط ردیف‌های داخل دوره ارزش‌گذاری/نوشته می‌شوند؛
 *    ردیف‌های دوره‌های قبل با مبلغ ثبت‌شده‌شان در استخر می‌آیند و هرگز اصلاحیه (ENGINE_CORRECTION) نمی‌خورند؛
 *  • کالایی که در این دوره ردیفی ندارد (فقط موجودی اول دوره/گردش دوره‌های قبل) هم رکورد ارزش‌گذاریِ این دوره را می‌گیرد تا دوره‌های
 *    بعد بدانند «پردازش شده است».
 */
export async function priceItem(goodsItemId: number, reportingPeriodId: number, userId?: number) {
  return prisma.$transaction(
    async (tx) => {
      const period = await tx.reportingPeriod.findUnique({ where: { id: reportingPeriodId }, include: { fiscalPeriod: true } });
      if (!period) throw new Error("دوره گزارشگری یافت نشد");

      await lockOpeningYearShared(tx, period.fiscalPeriodId);
      await assertFiscalYearNotAccountingClosed(tx, period.fiscalPeriodId, "قیمت‌گذاری");
      const problem = await getPreviousYearAccountingCloseProblem(period.fiscalPeriodId, tx);
      if (problem) throw new Error(problem);

      const already = await tx.goodsPricingStatus.findUnique({
        where: { goodsItemId_reportingPeriodId: { goodsItemId, reportingPeriodId } },
      });
      if (already) throw new Error("این کالا قبلاً در این دوره قیمت‌گذاری شده است");

      const [prevProblem] = await findPreviousValuationProblems([goodsItemId], period, tx);
      if (prevProblem) {
        throw new Error(`این کالا در دوره‌ی گزارشگری «${prevProblem.period.title}» گردش داشته ولی در آن دوره قیمت‌گذاری نشده است؛ ابتدا آن دوره را برای این کالا قیمت‌گذاری کنید`);
      }

      const { lines, computed, initialReturnShare, decimalPlaces, epsilon } = await computeItemKardex(
        goodsItemId,
        { windowFrom: period.fiscalPeriod.fromDate, periodFrom: period.fromDate, toDate: period.toDate },
        tx
      );

      // نهایی‌سازی: خودِ رسید هرگز توسط قیمت‌گذاری اصلاح نمی‌شود (همیشه با مبلغ اصلی خودش باقی می‌ماند) —
      // سهم ثابت باقیمانده و همگرایی لوپ فقط برای محاسبه‌ی درستِ سایر ردیف‌های بین رسید و برگشت (مثلاً
      // مصرف) به کار می‌روند. مبلغ نهایی خودِ برگشت هم مقدار همگراشده‌ی کاردکس نیست؛ سهم متناسب از مبلغ
      // اصلی رسید است (همان initialReturnShare). بقیه‌ی ردیف‌های محاسبه‌شده از computed خوانده می‌شوند.
      const changes: { lineId: number; delta: number; newTotal: number; quantity: number }[] = [];
      for (const line of lines) {
        if (line.document.date < period.fromDate) continue; // دوره‌ی قبل: هرگز بازنویسی نمی‌شود
        let newTotal: number | undefined;
        if (line.document.documentType === "SUPPLIER_RETURN" && line.sourceWarehouseReceiptLineId && initialReturnShare.has(line.id)) {
          newTotal = initialReturnShare.get(line.id)!;
        } else if (computed.has(line.id)) {
          newTotal = computed.get(line.id)!;
        }
        if (newTotal === undefined) continue;

        // line.amount همین حالا SUM(Difference)ی کامل تاریخچه‌ی ردیف است
        const delta = round(newTotal - Number(line.amount), decimalPlaces);
        if (Math.abs(delta) > epsilon) {
          changes.push({ lineId: line.id, delta, newTotal, quantity: Number(line.quantity) });
        }
      }

      const created = await tx.goodsPricingStatus.create({
        data: { goodsItemId, reportingPeriodId, createdById: userId },
      });
      for (const c of changes) {
        await setLineAmount(tx, {
          lineId: c.lineId,
          newAmount: c.newTotal,
          priceType: "ENGINE_PRICING",
          effectiveDate: period.toDate,
          goodsPricingStatusId: created.id,
          createdById: userId ?? null,
        });
      }
      return { status: created, adjustmentCount: changes.length };
    },
    { maxWait: 15000, timeout: 120000 }
  );
}

export async function revertItem(goodsItemId: number, reportingPeriodId: number) {
  const status = await prisma.goodsPricingStatus.findUnique({
    where: { goodsItemId_reportingPeriodId: { goodsItemId, reportingPeriodId } },
  });
  if (!status) throw new Error("این کالا در این دوره قیمت‌گذاری نشده است");

  const { period: revertPeriod, successor } = await findSuccessorPeriod(reportingPeriodId);
  if (successor) {
    const successorPriced = await prisma.goodsPricingStatus.findUnique({
      where: { goodsItemId_reportingPeriodId: { goodsItemId, reportingPeriodId: successor.id } },
    });
    if (successorPriced) {
      throw new Error(`ابتدا باید برگشت قیمت‌گذاری دوره‌ی «${successor.title}» برای این کالا انجام شود`);
    }
  }

  // برخلاف قبل (که یک «کم‌کردن دلتا» دستی روی ستون خام لازم بود)، الان کافی است دقیقاً همان رکوردهای
  // DocumentItemAmount ای که این اجرا اضافه کرده بود حذف شوند — SUM(Difference) هر ردیف خودکار به
  // مقدار پیش از این اجرا برمی‌گردد. safe به‌خاطر بررسی «ابتدا باید دوره‌ی بعدی برگشت بخورد» بالا: هیچ
  // اجرای دیگری بعد از این یکی، روی همین کالا لایه‌ای اضافه نکرده است.
  await prisma.$transaction(async (tx) => {
    // سال مالیِ بسته‌شده‌ی حسابداری موجودی: برگشت قیمت‌گذاری هم یک تغییر قیمت است و مجاز نیست
    await assertFiscalYearNotAccountingClosed(tx, revertPeriod.fiscalPeriodId, "برگشت قیمت‌گذاری");
    await tx.documentItemAmount.deleteMany({ where: { goodsPricingStatusId: status.id } });
    await tx.goodsPricingStatus.delete({ where: { id: status.id } });
  });
}
