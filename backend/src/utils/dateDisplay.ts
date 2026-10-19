import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import gregorian from "react-date-object/calendars/gregorian";
import gregorian_en from "react-date-object/locales/gregorian_en";

/**
 * «تنها نقطه‌ی نمایش تاریخ داخل متن» در بک‌اند (پیام خطا، توضیح ردیف، متن گزارش، …).
 * تاریخ‌ها در دیتابیس و API همیشه میلادی (ISO) می‌مانند؛ فقط وقتی تاریخ به متنِ قابل‌خواندن برای کاربر تبدیل می‌شود از این تابع می‌گذرد.
 * برای عرضه‌ی سیستم با تقویم میلادی کافی است تقویمِ نمایش عوض شود (env `DISPLAY_CALENDAR=GREGORIAN` یا آرگومان دوم)؛
 * هیچ پیام/ماژولی جداگانه تغییر نمی‌کند. هیچ جای دیگری نباید `toISOString().slice(0, 10)` را داخل پیام بگذارد.
 */
export type DisplayCalendar = "JALALI" | "GREGORIAN";

export const DISPLAY_CALENDAR: DisplayCalendar = String(process.env.DISPLAY_CALENDAR ?? "").toUpperCase() === "GREGORIAN" ? "GREGORIAN" : "JALALI";

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

/** Date یا رشته‌ی ISO (YYYY-MM-DD…) → «YYYY/MM/DD» در تقویم نمایش (ارقام انگلیسی، هم‌الگوی بقیه‌ی اعداد پیام‌ها)؛ مقدار تهی → «» */
export function displayDate(value: Date | string | null | undefined, calendar: DisplayCalendar = DISPLAY_CALENDAR): string {
  if (!value) return "";
  let date: Date;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    date = value;
  } else {
    const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return String(value);
    date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  }
  // روزِ ذخیره‌شده = روز UTC (تاریخ‌های سیستم نیمه‌شب UTC‌اند)
  const g = new DateObject({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), calendar: gregorian, locale: gregorian_en });
  if (calendar === "GREGORIAN") return `${pad(g.year, 4)}/${pad(g.month.number)}/${pad(g.day)}`;
  const j = g.convert(persian, persian_fa);
  return `${pad(j.year, 4)}/${pad(j.month.number)}/${pad(j.day)}`;
}
