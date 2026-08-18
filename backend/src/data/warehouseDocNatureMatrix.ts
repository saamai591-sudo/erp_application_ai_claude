// =========================================================================
// ماتریس «نوع کالا × ماهیت/نوع سند انبار»
// طبق مستند پروژه «نوع کالا-ماهیت سند انبار» — این یک entity/CRUD جدید نیست؛ صرفاً یک
// جدول‌داده‌ی ثابت (business rule) + چند تابع کمکی است که به‌عنوان بیس/زیرساخت سیستم انبار
// در اختیار ماژول‌های آینده‌ی اسناد انبار (رسید انبار، حواله انبار، انتقال بین انبارها، ...) قرار می‌گیرد.
//
// هدف: وقتی یکی از آن ماژول‌ها برای «ماهیت» (وارده/صادره) و «نوع» مشخصی (مثلاً وارده/خرید) در حال
// نمایش لیست کالاهای قابل انتخاب است، با فراخوانی توابع این فایل بفهمد فقط کالاهایی با کدام
// «نوع کالا»‌ها (AccountingGroup.goodsType) مجاز به بارگذاری در آن سند هستند.
//
// نکته: ستون «سایر شرایط» در مستند مبدا (فعال بودن کالا) برای هر ۲۵ ردیف یکسان است و در واقع
// همان قاعده‌ی عمومی «فقط کالای فعال قابل انتخاب است» است که در کل سیستم انبار (طبق مستند عمومی
// عملیات انبار) همه‌جا رعایت می‌شود؛ بنابراین به‌صورت فیلد جداگانه در این ماتریس مدل نشده و باید در
// همان لایه‌ای که goodsItem.isActive را فیلتر می‌کند رعایت شود (نمونه: warehouseDocGoodsFilterService).
// =========================================================================

/** ماهیت سند انبار: وارده (ورود کالا به انبار) یا صادره (خروج کالا از انبار) */
export type WarehouseDocDirection = "INBOUND" | "OUTBOUND";

export const WAREHOUSE_DOC_DIRECTION_FA: Record<WarehouseDocDirection, string> = {
  INBOUND: "وارده",
  OUTBOUND: "صادره",
};

/**
 * نوع کالا (AccountingGroup.goodsType) — دقیقاً همان enum GoodsType در schema.prisma.
 * توجه: مقدار SERVICE عمداً در این ماتریس ظاهر نمی‌شود چون اسناد انبار فقط با ردیف‌های
 * kind=GOODS سر و کار دارند (خدمت هرگز در انبار بارگذاری نمی‌شود).
 */
export type WarehouseGoodsType =
  | "RAW_MATERIAL" // مواد اولیه
  | "SEMI_FINISHED" // نیمه‌ساخته
  | "PRODUCT" // محصول
  | "SUPPLIES" // ملزومات
  | "CONTRACT_GOODS" // کارمزدی
  | "SCRAP" // ضایعات
  | "FIXED_ASSET" // دارایی ثابت
  | "TRADE_GOODS"; // کالای تجاری

export const WAREHOUSE_GOODS_TYPE_FA: Record<WarehouseGoodsType, string> = {
  RAW_MATERIAL: "مواد اولیه",
  SEMI_FINISHED: "نیمه‌ساخته",
  PRODUCT: "محصول",
  SUPPLIES: "ملزومات",
  CONTRACT_GOODS: "کارمزدی",
  SCRAP: "ضایعات",
  FIXED_ASSET: "دارایی ثابت",
  TRADE_GOODS: "کالای تجاری",
};

const ALL_GOODS_TYPES: WarehouseGoodsType[] = [
  "RAW_MATERIAL",
  "SEMI_FINISHED",
  "PRODUCT",
  "SCRAP",
  "FIXED_ASSET",
  "TRADE_GOODS",
  "SUPPLIES",
  "CONTRACT_GOODS",
];

export interface WarehouseDocNatureRule {
  direction: WarehouseDocDirection;
  /** عنوان دقیق «نوع» طبق مستند (مثلاً «خرید»، «رسید امانی»، «فروش فروشگاهی»، ...) */
  type: string;
  /** انواع کالای مجاز برای بارگذاری در سندی با این ماهیت/نوع */
  allowedGoodsTypes: WarehouseGoodsType[];
}

// ترتیب و مقادیر دقیقاً طبق مستند پروژه «نوع کالا-ماهیت سند انبار»
export const WAREHOUSE_DOC_NATURE_MATRIX: WarehouseDocNatureRule[] = [
  // ------------------------------------------------------------------ وارده
  { direction: "INBOUND", type: "تولید", allowedGoodsTypes: ["SEMI_FINISHED", "PRODUCT"] },
  { direction: "INBOUND", type: "خرید", allowedGoodsTypes: ["RAW_MATERIAL", "PRODUCT", "FIXED_ASSET", "TRADE_GOODS", "SUPPLIES"] },
  { direction: "INBOUND", type: "رسید امانی", allowedGoodsTypes: ["RAW_MATERIAL", "SEMI_FINISHED", "PRODUCT", "TRADE_GOODS", "SUPPLIES"] },
  { direction: "INBOUND", type: "ضایعات", allowedGoodsTypes: ["SCRAP"] },
  { direction: "INBOUND", type: "انتقالی", allowedGoodsTypes: [...ALL_GOODS_TYPES] },
  { direction: "INBOUND", type: "انبارگردانی", allowedGoodsTypes: ["RAW_MATERIAL", "SEMI_FINISHED", "PRODUCT", "FIXED_ASSET", "TRADE_GOODS", "SUPPLIES"] },
  { direction: "INBOUND", type: "اول دوره", allowedGoodsTypes: [...ALL_GOODS_TYPES] },
  { direction: "INBOUND", type: "دریافت از پیمانکار", allowedGoodsTypes: ["SEMI_FINISHED", "PRODUCT", "FIXED_ASSET", "TRADE_GOODS"] },
  { direction: "INBOUND", type: "کارمزدی", allowedGoodsTypes: ["CONTRACT_GOODS"] },
  { direction: "INBOUND", type: "دوباره کاری", allowedGoodsTypes: ["PRODUCT"] },

  // ----------------------------------------------------------------- صادره
  { direction: "OUTBOUND", type: "فروش", allowedGoodsTypes: ["RAW_MATERIAL", "SEMI_FINISHED", "PRODUCT", "TRADE_GOODS", "SUPPLIES"] },
  { direction: "OUTBOUND", type: "مصرف", allowedGoodsTypes: ["RAW_MATERIAL", "TRADE_GOODS", "SUPPLIES"] },
  { direction: "OUTBOUND", type: "انتقالی", allowedGoodsTypes: [...ALL_GOODS_TYPES] },
  { direction: "OUTBOUND", type: "ضایعات", allowedGoodsTypes: ["RAW_MATERIAL", "SEMI_FINISHED", "PRODUCT", "TRADE_GOODS", "SUPPLIES"] },
  { direction: "OUTBOUND", type: "انبارگردانی", allowedGoodsTypes: ["RAW_MATERIAL", "SEMI_FINISHED", "PRODUCT", "FIXED_ASSET", "TRADE_GOODS", "SUPPLIES"] },
  { direction: "OUTBOUND", type: "دارایی ثابت", allowedGoodsTypes: ["FIXED_ASSET"] },
  { direction: "OUTBOUND", type: "تبدیل کالا", allowedGoodsTypes: ["RAW_MATERIAL", "TRADE_GOODS", "SUPPLIES"] },
  { direction: "OUTBOUND", type: "فروش ضایعات", allowedGoodsTypes: ["SCRAP"] },
  { direction: "OUTBOUND", type: "بازیافت ضایعات", allowedGoodsTypes: ["SCRAP"] },
  { direction: "OUTBOUND", type: "پیمانکاری", allowedGoodsTypes: ["RAW_MATERIAL", "SEMI_FINISHED", "TRADE_GOODS", "SUPPLIES"] },
  { direction: "OUTBOUND", type: "ارسال نیمه ساخته", allowedGoodsTypes: ["SEMI_FINISHED"] },
  { direction: "OUTBOUND", type: "فروش فروشگاهی", allowedGoodsTypes: ["RAW_MATERIAL", "SEMI_FINISHED", "PRODUCT", "TRADE_GOODS", "SUPPLIES"] },
  { direction: "OUTBOUND", type: "مصرف کارمزدی", allowedGoodsTypes: ["CONTRACT_GOODS"] },
  { direction: "OUTBOUND", type: "مصرف دارایی ثابت", allowedGoodsTypes: ["RAW_MATERIAL", "SEMI_FINISHED", "PRODUCT", "TRADE_GOODS", "SUPPLIES"] },
  { direction: "OUTBOUND", type: "حواله دوباره کاری", allowedGoodsTypes: ["PRODUCT"] },
];

/** برای انتخاب سریع مقادیر معتبر «نوع» به ازای هر ماهیت (مثلاً برای ساخت select در ماژول‌های آینده) */
export function listTypesForDirection(direction: WarehouseDocDirection): string[] {
  return WAREHOUSE_DOC_NATURE_MATRIX.filter((r) => r.direction === direction).map((r) => r.type);
}

/**
 * انواع کالای مجاز برای بارگذاری در سندی با ماهیت/نوع مشخص.
 * اگر چنین ترکیب ماهیت/نوعی در ماتریس تعریف نشده باشد null برمی‌گرداند (یعنی قاعده‌ای برایش نداریم).
 */
export function getAllowedGoodsTypes(direction: WarehouseDocDirection, type: string): WarehouseGoodsType[] | null {
  const rule = WAREHOUSE_DOC_NATURE_MATRIX.find((r) => r.direction === direction && r.type === type);
  return rule ? rule.allowedGoodsTypes : null;
}

/** آیا کالایی با این «نوع کالا» مجاز است در سندی با این ماهیت/نوع بارگذاری شود؟ */
export function isGoodsTypeAllowedForDoc(direction: WarehouseDocDirection, type: string, goodsType: string): boolean {
  const allowed = getAllowedGoodsTypes(direction, type);
  if (!allowed) return false;
  return allowed.includes(goodsType as WarehouseGoodsType);
}
