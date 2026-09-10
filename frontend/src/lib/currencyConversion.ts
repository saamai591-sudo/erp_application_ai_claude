/**
 * تبدیل مبلغ ارز فاکتور/سند ↔ ارز پایه — دقیقاً هم‌فرمول backend/src/utils/currencyConversion.ts (باید
 * هم‌زمان با آن به‌روز بماند؛ بک‌اند مقدار نهایی/ذخیره‌شده را همان‌جا محاسبه می‌کند، این نسخه فقط برای
 * نمایش زنده در فرم است). طبق Documents/تبدیل ارز.md، تنها محل این فرمول در فرانت‌اند است.
 *
 * نرخ ارز (CurrencyRate) = fxRate ورودی کاربر؛ نسبت مبادله (ExchangeRate) = Currency.baseVolume؛
 * روش ثبت نرخ ارز (ExchangeMethod) = Currency.rateDirection:
 *   TO_BASE   («از ارز جاری به ارز پایه»): مبلغ پایه = مبلغ ارز × (fxRate ÷ baseVolume)
 *   FROM_BASE («از ارز پایه به ارز جاری»): مبلغ پایه = مبلغ ارز × (baseVolume ÷ fxRate)
 */
export interface ConversionCurrency {
  baseVolume: number;
  rateDirection: "TO_BASE" | "FROM_BASE" | null;
}

/** مبلغ ارز فاکتور/سند را به مبلغ معادل به ارز پایه تبدیل می‌کند */
export function toBaseCurrencyAmount(currencyAmount: number, fxRate: number, currency: ConversionCurrency): number {
  const multiplier = currency.rateDirection === "FROM_BASE" ? currency.baseVolume / fxRate : fxRate / currency.baseVolume;
  return currencyAmount * multiplier;
}
