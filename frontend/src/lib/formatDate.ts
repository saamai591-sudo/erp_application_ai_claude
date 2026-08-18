import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import gregorian from "react-date-object/calendars/gregorian";
import gregorian_en from "react-date-object/locales/gregorian_en";
import { toEnglishDigits } from "./digits";

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
function toFaDigits(value: string): string {
  return value.replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

/**
 * یک رشته تاریخ شمسی با هر جداکننده‌ای (/ یا - یا بدون جداکننده) و با ارقام فارسی یا انگلیسی
 * را به فرمت میلادی YYYY-MM-DD تبدیل می‌کند. برای مقادیر نامعتبر null برمی‌گرداند.
 * (کاربرد اصلی: ستون‌های تاریخ در ورود اطلاعات از اکسل، که کاربر عادت دارد شمسی وارد کند)
 */
export function jalaliToGregorianIso(input: string): string | null {
  if (!input) return null;
  const normalized = toEnglishDigits(input).trim();
  const digitsOnlyStr = normalized.replace(/[^\d]/g, "");
  let year: number, month: number, day: number;
  if (digitsOnlyStr.length === 8) {
    year = Number(digitsOnlyStr.slice(0, 4));
    month = Number(digitsOnlyStr.slice(4, 6));
    day = Number(digitsOnlyStr.slice(6, 8));
  } else {
    const parts = normalized.split(/[\/\-.]/).map((p) => p.trim()).filter(Boolean);
    if (parts.length !== 3) return null;
    year = Number(parts[0]);
    month = Number(parts[1]);
    day = Number(parts[2]);
  }
  if (!year || !month || !day || month < 1 || month > 12 || day < 1 || day > 31) return null;
  try {
    const j = new DateObject({ year, month, day, calendar: persian, locale: persian_fa });
    return j.convert(gregorian, gregorian_en).format("YYYY-MM-DD");
  } catch {
    return null;
  }
}
export function formatJalaliDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const iso = isoDate.slice(0, 10);
  try {
    const j = new DateObject({ date: iso, format: "YYYY-MM-DD", calendar: gregorian, locale: gregorian_en }).convert(
      persian,
      persian_fa
    );
    const formatted = `${String(j.year).padStart(4, "0")}/${String(j.month.number).padStart(2, "0")}/${String(j.day).padStart(2, "0")}`;
    return toFaDigits(formatted);
  } catch {
    return "—";
  }
}
