import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import gregorian from "react-date-object/calendars/gregorian";
import gregorian_en from "react-date-object/locales/gregorian_en";
import { toFaDigits } from "./formatAmount";

/**
 * «امروز» به تقویم محلیِ مرورگر به‌صورت YYYY-MM-DD. `new Date().toISOString().slice(0, 10)` روز را به وقت UTC
 * می‌گیرد و بین ۰۰:۰۰ تا ۰۳:۳۰ بامداد تهران یک روز عقب است (پیش‌فرض تاریخ سند «دیروز» می‌شد و اسناد مبنای
 * همان روز در انتخابگر مبنا دیده نمی‌شدند).
 */
export function localTodayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * تقویمِ نمایشِ تاریخ در متن/جدول/برچسب‌ها — تنها نقطه‌ی تصمیم در فرانت‌اند (معادلِ `DISPLAY_CALENDAR` در بک‌اند `utils/dateDisplay.ts`).
 * داده و API همیشه ISO میلادی‌اند؛ برای عرضه با تقویم میلادی کافی است این مقدار (یا env ساخت `VITE_DISPLAY_CALENDAR=GREGORIAN`) عوض شود.
 */
const DISPLAY_CALENDAR: "JALALI" | "GREGORIAN" = String(import.meta.env.VITE_DISPLAY_CALENDAR ?? "").toUpperCase() === "GREGORIAN" ? "GREGORIAN" : "JALALI";

/** هر تاریخِ ISO که قرار است به‌صورت متن به کاربر نشان داده شود باید از این تابع بگذرد (نام قدیمی `formatJalaliDate` همین را صدا می‌زند) */
export function formatDisplayDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const iso = isoDate.slice(0, 10);
  try {
    const g = new DateObject({ date: iso, format: "YYYY-MM-DD", calendar: gregorian, locale: gregorian_en });
    const j = DISPLAY_CALENDAR === "GREGORIAN" ? g : g.convert(persian, persian_fa);
    const formatted = `${String(j.year).padStart(4, "0")}/${String(j.month.number).padStart(2, "0")}/${String(j.day).padStart(2, "0")}`;
    return toFaDigits(formatted);
  } catch {
    return "—";
  }
}

export const formatJalaliDate = formatDisplayDate;
