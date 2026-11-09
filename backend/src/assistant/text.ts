// نرمال‌سازی متن فارسی برای تشخیص دستور و جستجوی موجودیت‌ها

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** ی/ک عربی ← فارسی، ارقام فارسی/عربی ← انگلیسی، حذف اعراب و کشیده، فشرده‌کردن فاصله‌ها */
export function norm(s: string): string {
  return String(s ?? "")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[ً-ٟـ]/g, "")
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .replace(/٬|،/g, (m) => (m === "٬" ? "," : "،"))
    .replace(/\s+/g, " ")
    .trim();
}

/** شکل «بدون فاصله و نیم‌فاصله» برای مقایسه‌ی نام‌ها (فن‌آوران = فن آوران = فنآوران) */
export const loose = (s: string): string => norm(s).replace(/[‌\s]/g, "").toLowerCase();

/** شماره‌ی داخل متن (۱٬۲۰۰ و ۱٫۵ هم پذیرفته می‌شود)؛ NaN اگر نبود */
export function toNumber(s: string): number {
  const t = norm(s).replace(/[,٬]/g, "").replace(/٫/g, ".");
  return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
}

export const tokens = (s: string): string[] => norm(s).split(/[\s‌]+/).filter(Boolean);
