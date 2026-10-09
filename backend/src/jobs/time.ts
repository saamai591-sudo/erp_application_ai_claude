// ابزار زمان به وقت تهران برای زمان‌بند. ایران ساعت تابستانی ندارد؛ آفست ثابت +۰۳:۳۰ است.

export const TEHRAN_OFFSET_MINUTES = 210;
const MS_MINUTE = 60_000;
const MS_DAY = 86_400_000;

/** اجزای تقویم میلادیِ «ساعت دیواری تهران» برای یک لحظه (weekdayJs: ۰=یکشنبه … ۶=شنبه مثل Date.getUTCDay) */
export function tehranParts(date: Date) {
  const shifted = new Date(date.getTime() + TEHRAN_OFFSET_MINUTES * MS_MINUTE);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekdayJs: shifted.getUTCDay(),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** تاریخ امروز (یا تاریخ لحظه‌ی داده‌شده) به وقت تهران، به‌صورت YYYY-MM-DD */
export function tehranDate(date: Date = new Date()): string {
  const p = tehranParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** روز هفته‌ی تهران با مبدأ شنبه: ۰=شنبه … ۶=جمعه */
export function jalaliWeekday(date: Date): number {
  return (tehranParts(date).weekdayJs + 1) % 7;
}

/** ساعت دیواری تهران (تاریخ میلادی + ساعت و دقیقه) → لحظه‌ی UTC */
export function tehranWallToUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - TEHRAN_OFFSET_MINUTES * MS_MINUTE);
}

/** جمع/تفریق روز روی یک تاریخ YYYY-MM-DD (بدون وابستگی به منطقه‌ی زمانی) */
export function addDaysIso(iso: string, deltaDays: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + deltaDays * MS_DAY);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** رشته‌ی YYYY-MM-DD → Date در نیمه‌شب UTC (همان‌گونه که ستون‌های @db.Date در Prisma خوانده/نوشته می‌شوند) */
export function isoToDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export const ISO_DATE_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
export const WEEKDAY_TITLES_FA = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
