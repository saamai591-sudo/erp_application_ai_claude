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

export interface VatRateGoodsItem {
  isSpecial: boolean;
  /** درصد (مثلاً ۹ یعنی ۹٪)، نه کسر اعشاری؛ Prisma Decimal یا عدد ساده هر دو پذیرفته می‌شوند */
  taxRate: number | { toNumber(): number } | null;
}

function toPlainNumber(value: number | { toNumber(): number } | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === "number" ? value : value.toNumber();
}

/** نرخ مالیات بر ارزش افزوده‌ی قابل‌اعمال روی یک کالای مشخص (درصد، نه کسر اعشاری) */
export function resolveVatRatePercent(goodsItem: VatRateGoodsItem | null | undefined, defaultRatePercent: number): number {
  const specificRate = goodsItem?.isSpecial ? toPlainNumber(goodsItem.taxRate) : null;
  return specificRate ?? defaultRatePercent;
}

/** مالیات بر ارزش افزوده‌ی یک ردیف سند: (مبلغ − تخفیف) × نرخ مالیات٪ */
export function computeLineVat(amount: number, discount: number, vatRatePercent: number, decimalPlaces = 2): number {
  const base = Math.max(0, (Number(amount) || 0) - (Number(discount) || 0));
  const vat = base * (vatRatePercent / 100);
  const factor = Math.pow(10, decimalPlaces);
  return Math.round(vat * factor) / factor;
}
