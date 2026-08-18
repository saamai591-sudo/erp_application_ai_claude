const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/**
 * ارقام فارسی یا عربی وارد شده توسط کاربر (مثلا از صفحه‌کلید فارسی) را
 * به ارقام انگلیسی (لاتین) تبدیل می‌کند تا اعتبارسنجی‌ها (regex عددی) درست کار کنند.
 */
export function toEnglishDigits(value: string): string {
  return value
    .split("")
    .map((ch) => {
      const pIndex = PERSIAN_DIGITS.indexOf(ch);
      if (pIndex > -1) return String(pIndex);
      const aIndex = ARABIC_DIGITS.indexOf(ch);
      if (aIndex > -1) return String(aIndex);
      return ch;
    })
    .join("");
}

/** فقط رقم انگلیسی را نگه می‌دارد (برای فیلدهای عددی/موبایل/کد) */
export function digitsOnly(value: string): string {
  return toEnglishDigits(value).replace(/[^\d]/g, "");
}
