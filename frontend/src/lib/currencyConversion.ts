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
  decimalPlaces: number;
}

/** مبلغ را طبق تعداد رقم اعشار تنظیم‌شده‌ی یک ارز گرد می‌کند — هر جای سیستم که مبلغی محاسبه/نمایش داده
 * می‌شود باید از همین تابع عبور کند تا رقم اعشار خام و نامتعارف حاصل از تقسیم اعشاری جاوااسکریپت (مثل
 * ۰٫۰۰۸۸۲۳۵۲۹...) دیده نشود — هم‌الگوی backend/src/utils/currencyConversion.ts#roundToCurrencyDecimals. */
export function roundToCurrencyDecimals(value: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces;
  return Math.round(value * factor) / factor;
}

/** مبلغ ارز فاکتور/سند را به مبلغ معادل به ارز پایه تبدیل می‌کند — نتیجه طبق رقم اعشار ارز پایه گرد می‌شود */
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

/** تسعیر ارز (Exchange gain/loss) — دقیقاً هم‌فرمول backend/src/utils/currencyConversion.ts —
 * سود/زیان ناشی از اختلاف نرخ ردیف با نرخ سند مبنا، به ارز پایه. */
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
