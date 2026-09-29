"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roundToCurrencyDecimals = roundToCurrencyDecimals;
exports.toBaseCurrencyAmount = toBaseCurrencyAmount;
exports.fromBaseCurrencyAmount = fromBaseCurrencyAmount;
exports.calculateExchangeGainLoss = calculateExchangeGainLoss;
/** مبلغ را طبق تعداد رقم اعشار تنظیم‌شده‌ی یک ارز گرد می‌کند — هر جای سیستم که مبلغی محاسبه/نمایش داده
 * می‌شود باید از همین تابع عبور کند تا رقم اعشار خام و نامتعارف حاصل از تقسیم اعشاری جاوااسکریپت (مثل
 * ۰٫۰۰۸۸۲۳۵۲۹...) دیده نشود. */
function roundToCurrencyDecimals(value, decimalPlaces) {
    const factor = 10 ** decimalPlaces;
    return Math.round(value * factor) / factor;
}
/** مبلغ ارز فاکتور/سند را به مبلغ معادل به ارز پایه تبدیل می‌کند — نتیجه طبق رقم اعشار ارز پایه گرد
 * می‌شود (طبق تصمیم صریح کاربر: هر جای سیستم که مبلغی محاسبه می‌شود باید گرد شود، نه فقط رسید دریافت) */
function toBaseCurrencyAmount(currencyAmount, fxRate, currency, baseCurrency) {
    const multiplier = currency.rateDirection === "FROM_BASE" ? currency.baseVolume / fxRate : fxRate / currency.baseVolume;
    return roundToCurrencyDecimals(currencyAmount * multiplier, baseCurrency.decimalPlaces);
}
/** مبلغ به ارز پایه را به معادل آن در ارز فاکتور/سند برمی‌گرداند (معکوس toBaseCurrencyAmount) — نتیجه
 * طبق رقم اعشار همان ارز مقصد (currency) گرد می‌شود */
function fromBaseCurrencyAmount(baseCurrencyAmount, fxRate, currency) {
    const multiplier = currency.rateDirection === "FROM_BASE" ? fxRate / currency.baseVolume : currency.baseVolume / fxRate;
    return roundToCurrencyDecimals(baseCurrencyAmount * multiplier, currency.decimalPlaces);
}
/**
 * تسعیر ارز (Exchange gain/loss) — طبق Documents/نحوه محاسبه تسعیر ارز.md، تنها محل پیاده‌سازی این
 * فرمول در کل بک‌اند. rowRate و baseRate هر دو نرخِ یک ارزِ واحد در دو لحظه‌ی متفاوت‌اند (نرخ فعلیِ
 * ردیف در برابر نرخِ سندِ مبنا)؛ اختلاف معادل-پایه‌ی یک واحد از آن ارز در این دو نرخ، ضربدر مبلغ ردیف،
 * سود/زیان تسعیر را می‌دهد. علامت با نوع سند برعکس می‌شود (دریافت مثبت، پرداخت منفی).
 */
function calculateExchangeGainLoss(documentType, rowPrice, rowRate, baseRate, currency, baseCurrency) {
    const sign = documentType === "RECEIPT" ? 1 : -1;
    const unitAtRowRate = toBaseCurrencyAmount(1, rowRate, currency, baseCurrency);
    const unitAtBaseRate = toBaseCurrencyAmount(1, baseRate, currency, baseCurrency);
    return roundToCurrencyDecimals(sign * rowPrice * (unitAtRowRate - unitAtBaseRate), baseCurrency.decimalPlaces);
}
