// تبدیل عدد به حروف فارسی (برای «مبلغ کل به حروف» در چاپ اسناد). اعداد صحیح تا ۱۰^۲۷ پشتیبانی می‌شود؛ بخش اعشاری (اگر ارز اعشار داشته باشد)
// به‌صورت «… و ۲۵ صدم» می‌آید.

const ONES = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
const TEENS = ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];
const TENS = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
const HUNDREDS = ["", "صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
const SCALES = ["", "هزار", "میلیون", "میلیارد", "تریلیون", "کوادریلیون", "کوینتیلیون", "سکستیلیون", "سپتیلیون"];
const FRACTION_SCALES = ["", "دهم", "صدم", "هزارم", "ده‌هزارم", "صدهزارم", "میلیونیم"];

/** عدد ۰ تا ۹۹۹ */
function below1000(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h) parts.push(HUNDREDS[h]);
  if (rest >= 10 && rest < 20) {
    parts.push(TEENS[rest - 10]);
  } else {
    const t = Math.floor(rest / 10);
    const o = rest % 10;
    if (t) parts.push(TENS[t]);
    if (o) parts.push(ONES[o]);
  }
  return parts.join(" و ");
}

/** عدد صحیح نامنفی به حروف («صفر» برای ۰) */
export function integerToPersianWords(value: bigint): string {
  if (value === 0n) return "صفر";
  const groups: number[] = [];
  let v = value;
  while (v > 0n) {
    groups.push(Number(v % 1000n));
    v /= 1000n;
  }
  const out: string[] = [];
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    if (groups[i] === 0) continue;
    if (i >= SCALES.length) return value.toString();
    const words = below1000(groups[i]);
    // «هزار» بدون «یک» (هزار، نه «یک هزار») — فقط وقتی گروه دقیقاً ۱ است
    out.push(i === 1 && groups[i] === 1 ? SCALES[i] : SCALES[i] ? `${words} ${SCALES[i]}` : words);
  }
  return out.join(" و ");
}

/**
 * مبلغ به حروف با واحد پول، مثلاً «هفت میلیارد و … ریال». decimals = تعداد رقم اعشار ارز؛ اگر بخش اعشاری صفر باشد نمی‌آید.
 */
export function amountInWords(value: number, decimals: number, unit: string): string {
  if (!Number.isFinite(value)) return "";
  const negative = value < 0;
  const d = Math.max(0, Math.min(Math.trunc(decimals) || 0, 6));
  const [intPart, fracPartRaw = ""] = Math.abs(value).toFixed(d).split(".");
  const fracPart = fracPartRaw.replace(/0+$/, "");
  let text = integerToPersianWords(BigInt(intPart));
  if (fracPart) text += ` و ${integerToPersianWords(BigInt(fracPart))} ${FRACTION_SCALES[fracPart.length] ?? ""}`.trimEnd();
  return `${negative ? "منفی " : ""}${text}${unit ? ` ${unit}` : ""}`.trim();
}
