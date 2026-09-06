import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import gregorian from "react-date-object/calendars/gregorian";
import gregorian_en from "react-date-object/locales/gregorian_en";
import { toEnglishDigits } from "./digits";

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

/** تاریخ میلادی ذخیره‌شده در دیتابیس را به سال/ماه شمسی تبدیل می‌کند (برای بازه‌بندی گزارش تحلیلی بر اساس دوره) */
export function toJalaliYearMonth(date: Date): { year: number; month: number } {
  const j = new DateObject({ date, calendar: gregorian, locale: gregorian_en }).convert(persian, persian_fa);
  return { year: j.year, month: j.month.number };
}

/**
 * تاریخ میلادی را به رشته‌ی شمسی YYYY/MM/DD (ارقام انگلیسی، هم‌الگوی بقیه‌ی اعداد داخل پیام‌های خطای
 * بک‌اند) تبدیل می‌کند — برای نمایش تاریخ داخل پیام‌های خطای کاربرپسند (کاربر تاریخ میلادی خام را
 * نمی‌فهمد؛ همیشه با تاریخ شمسی کار می‌کند).
 */
export function formatJalaliDateForMessage(date: Date): string {
  const j = new DateObject({ date, calendar: gregorian, locale: gregorian_en }).convert(persian, persian_fa);
  return `${String(j.year).padStart(4, "0")}/${String(j.month.number).padStart(2, "0")}/${String(j.day).padStart(2, "0")}`;
}
