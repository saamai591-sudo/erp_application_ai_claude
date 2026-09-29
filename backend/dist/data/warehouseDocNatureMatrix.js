"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WAREHOUSE_DOC_NATURE_MATRIX = exports.WAREHOUSE_GOODS_TYPE_FA = exports.WAREHOUSE_DOC_DIRECTION_FA = void 0;
exports.listTypesForDirection = listTypesForDirection;
exports.getAllowedGoodsTypes = getAllowedGoodsTypes;
exports.isGoodsTypeAllowedForDoc = isGoodsTypeAllowedForDoc;
exports.WAREHOUSE_DOC_DIRECTION_FA = {
    INBOUND: "وارده",
    OUTBOUND: "صادره",
};
exports.WAREHOUSE_GOODS_TYPE_FA = {
    RAW_MATERIAL: "مواد اولیه",
    SEMI_FINISHED: "نیمه‌ساخته",
    PRODUCT: "محصول",
    SUPPLIES: "ملزومات",
    CONTRACT_GOODS: "کارمزدی",
    SCRAP: "ضایعات",
    FIXED_ASSET: "دارایی ثابت",
    TRADE_GOODS: "کالای تجاری",
};
const ALL_GOODS_TYPES = [
    "RAW_MATERIAL",
    "SEMI_FINISHED",
    "PRODUCT",
    "SCRAP",
    "FIXED_ASSET",
    "TRADE_GOODS",
    "SUPPLIES",
    "CONTRACT_GOODS",
];
// ترتیب و مقادیر دقیقاً طبق مستند پروژه «نوع کالا-ماهیت سند انبار»
exports.WAREHOUSE_DOC_NATURE_MATRIX = [
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
    // ۵ ردیف زیر در مستند مبدا «نوع کالا-ماهیت سند انبار» وجود ندارند (آن مستند فقط ۶ نوع سند اول‌ساخته‌شده
    // را می‌شناخت) — طبق بند ۳۴ stockAnalysis.md که این ۵ عملیات را هم به فهرست انواع سند انبار اضافه کرد،
    // با آینه‌ی همان انواع کالای مجازِ عملیاتِ مستقیم متناظرشان تکمیل شدند (یک برگشت نمی‌تواند نوع کالایی
    // را برگرداند که در عملیات مستقیم مجاز به خروج/ورود نبوده)
    { direction: "INBOUND", type: "برگشت از فروش", allowedGoodsTypes: ["RAW_MATERIAL", "SEMI_FINISHED", "PRODUCT", "TRADE_GOODS", "SUPPLIES"] },
    { direction: "INBOUND", type: "برگشت مصرف مرکز هزینه", allowedGoodsTypes: ["RAW_MATERIAL", "TRADE_GOODS", "SUPPLIES"] },
    { direction: "INBOUND", type: "برگشت مصرف پروژه", allowedGoodsTypes: ["RAW_MATERIAL", "TRADE_GOODS", "SUPPLIES"] },
    { direction: "INBOUND", type: "برگشت مصرف تولید", allowedGoodsTypes: ["RAW_MATERIAL", "TRADE_GOODS", "SUPPLIES"] },
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
    // مثل ۵ ردیف INBOUND بالا — در مستند مبدا نبود، طبق بند ۳۴ اضافه شد
    { direction: "OUTBOUND", type: "برگشت به تامین‌کننده", allowedGoodsTypes: ["RAW_MATERIAL", "PRODUCT", "FIXED_ASSET", "TRADE_GOODS", "SUPPLIES"] },
];
/** برای انتخاب سریع مقادیر معتبر «نوع» به ازای هر ماهیت (مثلاً برای ساخت select در ماژول‌های آینده) */
function listTypesForDirection(direction) {
    return exports.WAREHOUSE_DOC_NATURE_MATRIX.filter((r) => r.direction === direction).map((r) => r.type);
}
/**
 * انواع کالای مجاز برای بارگذاری در سندی با ماهیت/نوع مشخص.
 * اگر چنین ترکیب ماهیت/نوعی در ماتریس تعریف نشده باشد null برمی‌گرداند (یعنی قاعده‌ای برایش نداریم).
 */
function getAllowedGoodsTypes(direction, type) {
    const rule = exports.WAREHOUSE_DOC_NATURE_MATRIX.find((r) => r.direction === direction && r.type === type);
    return rule ? rule.allowedGoodsTypes : null;
}
/** آیا کالایی با این «نوع کالا» مجاز است در سندی با این ماهیت/نوع بارگذاری شود؟ */
function isGoodsTypeAllowedForDoc(direction, type, goodsType) {
    const allowed = getAllowedGoodsTypes(direction, type);
    if (!allowed)
        return false;
    return allowed.includes(goodsType);
}
