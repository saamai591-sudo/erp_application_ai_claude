"use strict";
/**
 * محاسبه‌ی پایه‌ی «مالیات بر ارزش افزوده» یک ردیف سند — طبق تصمیم صریح کاربر، این تنها محل پیاده‌سازی
 * این فرمول در کل بک‌اند است؛ هر ماژولی که نیاز به محاسبه‌ی مالیات یک ردیف دارد (فاکتور خرید، فاکتور
 * فروش، فروش فروشگاهی/POS و هر بخش آینده‌ای) باید از همین دو تابع استفاده کند، نه پیاده‌سازی جداگانه.
 *
 * فرمول: مالیات = (مبلغ − تخفیف) × نرخ مالیات
 * نرخ مالیات: اگر کالا «خاص» باشد (GoodsItem.isSpecial) و نرخ اختصاصی تعریف‌شده داشته باشد
 * (GoodsItem.taxRate)، همان نرخ استفاده می‌شود؛ در غیر این صورت نرخ پیش‌فرض سیستم اعمال می‌شود.
 *
 * نرخ پیش‌فرض تاریخ‌محور است و از «رویه‌ها و تنظیمات حسابداری» می‌آید: فراخوان‌کننده آن را با
 * getVatRatePercentForDate(تاریخ سند) (services/accountingSettingsService.ts) می‌گیرد و به resolveVatRatePercent می‌دهد؛
 * این تابع فقط نرخ اختصاصی کالای «خاص» را بر آن مقدم می‌کند.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveVatRatePercent = resolveVatRatePercent;
exports.computeLineVat = computeLineVat;
function toPlainNumber(value) {
    if (value === null || value === undefined)
        return null;
    return typeof value === "number" ? value : value.toNumber();
}
/** نرخ مالیات بر ارزش افزوده‌ی قابل‌اعمال روی یک کالای مشخص (درصد، نه کسر اعشاری) */
function resolveVatRatePercent(goodsItem, defaultRatePercent) {
    const specificRate = goodsItem?.isSpecial ? toPlainNumber(goodsItem.taxRate) : null;
    return specificRate ?? defaultRatePercent;
}
/** مالیات بر ارزش افزوده‌ی یک ردیف سند: (مبلغ − تخفیف) × نرخ مالیات٪ */
function computeLineVat(amount, discount, vatRatePercent, decimalPlaces = 2) {
    const base = Math.max(0, (Number(amount) || 0) - (Number(discount) || 0));
    const vat = base * (vatRatePercent / 100);
    const factor = Math.pow(10, decimalPlaces);
    return Math.round(vat * factor) / factor;
}
