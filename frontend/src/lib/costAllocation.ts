// توابع کمکی سرشکن کردن مبلغ ردیف «سایر هزینه‌ها»/فاکتور خرید خدمات بین ردیف‌های یک رسید انبار —
// دقیقاً هم‌الگوی نسخه‌ی سرورساید approve (مقصدشان یکی نیست: این‌جا فقط برای پیشنهاد اولیه‌ی سمت
// فرانت‌اند است، کاربر می‌تواند نتیجه را از طریق Dialog تسهیم اصلاح کند).

export function round(value: number, decimalPlaces: number): number {
  const factor = Math.pow(10, decimalPlaces);
  return Math.round(value * factor) / factor;
}

// سرشکن‌کردن total بر اساس weights متناسب؛ برای جلوگیری از افت/اضافه‌شدن ریالی به‌خاطر گرد کردن،
// آخرین سطر با وزن مثبت باقیمانده را جذب می‌کند تا مجموع سهم‌ها دقیقاً برابر total شود
export function allocateProportionally(total: number, weights: number[], decimalPlaces: number): number[] {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (sum <= 0) return weights.map(() => 0);
  const shares = weights.map((w) => round((total * w) / sum, decimalPlaces));
  const allocated = shares.reduce((s, v) => s + v, 0);
  const remainder = round(total - allocated, decimalPlaces);
  if (remainder !== 0) {
    const lastPositiveIdx = weights.map((w, i) => (w > 0 ? i : -1)).filter((i) => i >= 0).pop();
    if (lastPositiveIdx !== undefined) shares[lastPositiveIdx] = round(shares[lastPositiveIdx] + remainder, decimalPlaces);
  }
  return shares;
}
