import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import gregorian from "react-date-object/calendars/gregorian";
import gregorian_en from "react-date-object/locales/gregorian_en";

const FA_DIGIT_MAP: Record<string, string> = { "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9" };
function toEnglishDigits(s: string): string {
  return s.replace(/[۰-۹]/g, (d) => FA_DIGIT_MAP[d] ?? d);
}

/**
 * تشخیص خودکار و تبدیل یک رشته تاریخ (شمسی با هر جداکننده و ارقام فارسی/انگلیسی، یا میلادی ایزو)
 * به فرمت میلادی YYYY-MM-DD. برای مقادیر نامعتبر، همان مقدار ورودی را برمی‌گرداند (اعتبارسنجی
 * بعدی در ساخت Date مسئول رد کردنش خواهد بود).
 */
export function resolveDateString(raw: string): string {
  if (!raw) return raw;
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch && Number(isoMatch[1]) >= 1700) return raw;

  const normalized = toEnglishDigits(raw).trim();
  const digitsOnlyStr = normalized.replace(/[^\d]/g, "");
  let year: number, month: number, day: number;
  if (digitsOnlyStr.length === 8) {
    year = Number(digitsOnlyStr.slice(0, 4));
    month = Number(digitsOnlyStr.slice(4, 6));
    day = Number(digitsOnlyStr.slice(6, 8));
  } else {
    const parts = normalized.split(/[\/\-.]/).map((p) => p.trim()).filter(Boolean);
    if (parts.length !== 3) return raw;
    year = Number(parts[0]);
    month = Number(parts[1]);
    day = Number(parts[2]);
  }
  if (!year || !month || !day || month < 1 || month > 12 || day < 1 || day > 31) return raw;
  try {
    const j = new DateObject({ year, month, day, calendar: persian, locale: persian_fa });
    return j.convert(gregorian, gregorian_en).format("YYYY-MM-DD");
  } catch {
    return raw;
  }
}
