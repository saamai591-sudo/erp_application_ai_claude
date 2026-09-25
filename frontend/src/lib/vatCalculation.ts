/**
 * محاسبه‌ی پایه‌ی «مالیات بر ارزش افزوده» یک ردیف سند — دقیقاً هم‌فرمول
 * backend/src/utils/vatCalculation.ts (باید هم‌زمان با آن به‌روز بماند؛ بک‌اند مقدار نهایی/ذخیره‌شده
 * را همان‌جا محاسبه می‌کند، این نسخه فقط برای نمایش زنده در فرم است). طبق تصمیم صریح کاربر، این تنها
 * محل این فرمول در فرانت‌اند است؛ هر فرمی که نیاز به نمایش زنده‌ی مالیات دارد (فاکتور خرید، فاکتور
 * فروش، فروش فروشگاهی/POS و آینده) باید از همین دو تابع استفاده کند.
 *
 * فرمول: مالیات = (مبلغ − تخفیف) × نرخ مالیات
 * نرخ مالیات: اگر کالا «خاص» باشد (isSpecial) و نرخ اختصاصی تعریف‌شده داشته باشد (taxRate)، همان نرخ
 * استفاده می‌شود؛ در غیر این صورت نرخ پیش‌فرضِ تاریخ‌محور سیستم (از «رویه‌ها و تنظیمات حسابداری»؛ نگاه کنید به lib/useVatRates.ts:
 * vatRateForDate(نرخ‌ها، تاریخ سند)). ثابت ۱۰٪ فقط پیش‌فرضِ نمایش تا لحظه‌ی بارگذاری نرخ‌ها از سرور است؛ مقدار نهایی را بک‌اند محاسبه می‌کند.
 */
export const DEFAULT_VAT_RATE_PERCENT = 10;

export interface VatRateGoodsItem {
  isSpecial: boolean;
  /** درصد (مثلاً ۹ یعنی ۹٪)، نه کسر اعشاری */
  taxRate: number | string | null | undefined;
}

/** نرخ مالیات بر ارزش افزوده‌ی قابل‌اعمال روی یک کالای مشخص (درصد، نه کسر اعشاری) */
export function resolveVatRatePercent(goodsItem: VatRateGoodsItem | null | undefined, defaultRatePercent: number = DEFAULT_VAT_RATE_PERCENT): number {
  const specificRate = goodsItem?.isSpecial && goodsItem.taxRate != null && goodsItem.taxRate !== "" ? Number(goodsItem.taxRate) : null;
  return specificRate ?? defaultRatePercent;
}

/** مالیات بر ارزش افزوده‌ی یک ردیف سند: (مبلغ − تخفیف) × نرخ مالیات٪ */
export function computeLineVat(amount: number, discount: number, vatRatePercent: number): number {
  const base = Math.max(0, (Number(amount) || 0) - (Number(discount) || 0));
  return Math.round(base * (vatRatePercent / 100) * 100) / 100;
}
