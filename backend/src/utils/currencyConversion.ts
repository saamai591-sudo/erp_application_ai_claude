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
  decimalPlaces: number;
}

/** مبلغ را طبق تعداد رقم اعشار تنظیم‌شده‌ی یک ارز گرد می‌کند — هر جای سیستم که مبلغی محاسبه/نمایش داده
 * می‌شود باید از همین تابع عبور کند تا رقم اعشار خام و نامتعارف حاصل از تقسیم اعشاری جاوااسکریپت (مثل
 * ۰٫۰۰۸۸۲۳۵۲۹...) دیده نشود. */
export function roundToCurrencyDecimals(value: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces;
  return Math.round(value * factor) / factor;
}

/** مبلغ ارز فاکتور/سند را به مبلغ معادل به ارز پایه تبدیل می‌کند — نتیجه طبق رقم اعشار ارز پایه گرد
 * می‌شود (طبق تصمیم صریح کاربر: هر جای سیستم که مبلغی محاسبه می‌شود باید گرد شود، نه فقط رسید دریافت) */
export function toBaseCurrencyAmount(currencyAmount: number, fxRate: number, currency: ConversionCurrency, baseCurrency: ConversionCurrency): number {
  const multiplier = currency.rateDirection === "FROM_BASE" ? currency.baseVolume / fxRate : fxRate / currency.baseVolume;
  return roundToCurrencyDecimals(currencyAmount * multiplier, baseCurrency.decimalPlaces);
}

/** مبلغ به ارز پایه را به معادل آن در ارز فاکتور/سند برمی‌گرداند (معکوس toBaseCurrencyAmount) — نتیجه
 * طبق رقم اعشار همان ارز مقصد (currency) گرد می‌شود */
export function fromBaseCurrencyAmount(baseCurrencyAmount: number, fxRate: number, currency: ConversionCurrency): number {
  const multiplier = currency.rateDirection === "FROM_BASE" ? fxRate / currency.baseVolume : currency.baseVolume / fxRate;
  return roundToCurrencyDecimals(baseCurrencyAmount * multiplier, currency.decimalPlaces);
}

export type TasirDocumentType = "RECEIPT" | "PAYMENT";

/**
 * تسعیر ارز (Exchange gain/loss) — طبق Documents/نحوه محاسبه تسعیر ارز.md، تنها محل پیاده‌سازی این
 * فرمول در کل بک‌اند. rowRate و baseRate هر دو نرخِ یک ارزِ واحد در دو لحظه‌ی متفاوت‌اند (نرخ فعلیِ
 * ردیف در برابر نرخِ سندِ مبنا)؛ اختلاف معادل-پایه‌ی یک واحد از آن ارز در این دو نرخ، ضربدر مبلغ ردیف،
 * سود/زیان تسعیر را می‌دهد. علامت با نوع سند برعکس می‌شود (دریافت مثبت، پرداخت منفی).
 */
export function calculateExchangeGainLoss(
  documentType: TasirDocumentType,
  rowPrice: number,
  rowRate: number,
  baseRate: number,
  currency: ConversionCurrency,
  baseCurrency: ConversionCurrency
): number {
  const sign = documentType === "RECEIPT" ? 1 : -1;
  const unitAtRowRate = toBaseCurrencyAmount(1, rowRate, currency, baseCurrency);
  const unitAtBaseRate = toBaseCurrencyAmount(1, baseRate, currency, baseCurrency);
  return roundToCurrencyDecimals(sign * rowPrice * (unitAtRowRate - unitAtBaseRate), baseCurrency.decimalPlaces);
}
