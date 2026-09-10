import { RateDirection } from "@prisma/client";

/**
 * تبدیل مبلغ ارز فاکتور/سند ↔ ارز پایه — طبق Documents/تبدیل ارز.md، تنها محل پیاده‌سازی این فرمول در
 * کل بک‌اند؛ هر ماژولی که نیاز به این تبدیل دارد (صدور سند حسابداری، فاکتور خرید و هر بخش آینده‌ای) باید
 * از همین دو تابع استفاده کند، نه پیاده‌سازی جداگانه.
 *
 * نرخ ارز (CurrencyRate) = fxRate ورودی کاربر/سند؛ نسبت مبادله (ExchangeRate) = Currency.baseVolume؛
 * روش ثبت نرخ ارز (ExchangeMethod) = Currency.rateDirection:
 *   TO_BASE   («از ارز جاری به ارز پایه»، ExchangeMethod=1): مبلغ پایه = مبلغ ارز × (fxRate ÷ baseVolume)
 *   FROM_BASE («از ارز پایه به ارز جاری»، ExchangeMethod=2): مبلغ پایه = مبلغ ارز × (baseVolume ÷ fxRate)
 * این دو فرمول معکوس هم نیستند با جابه‌جایی ساده‌ی fxRate/baseVolume — دقیقاً طبق سند، نه یک حدس متقارن.
 */
export interface ConversionCurrency {
  baseVolume: number;
  rateDirection: RateDirection | null;
}

/** مبلغ ارز فاکتور/سند را به مبلغ معادل به ارز پایه تبدیل می‌کند */
export function toBaseCurrencyAmount(currencyAmount: number, fxRate: number, currency: ConversionCurrency): number {
  const multiplier = currency.rateDirection === "FROM_BASE" ? currency.baseVolume / fxRate : fxRate / currency.baseVolume;
  return currencyAmount * multiplier;
}

/** مبلغ به ارز پایه را به معادل آن در ارز فاکتور/سند برمی‌گرداند (معکوس toBaseCurrencyAmount) */
export function fromBaseCurrencyAmount(baseCurrencyAmount: number, fxRate: number, currency: ConversionCurrency): number {
  const multiplier = currency.rateDirection === "FROM_BASE" ? fxRate / currency.baseVolume : currency.baseVolume / fxRate;
  return baseCurrencyAmount * multiplier;
}
