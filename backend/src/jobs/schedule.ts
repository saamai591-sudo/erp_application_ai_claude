import { jalaliWeekday, tehranParts, tehranWallToUtc } from "./time";

// زمان‌بندی کارها: هر N دقیقه، روزانه، یا روزهای مشخصِ هفته — همه به وقت تهران.

export type ScheduleType = "INTERVAL" | "DAILY" | "WEEKLY";

export interface ScheduleSpec {
  type: ScheduleType;
  intervalMinutes?: number | null;
  /** "HH:mm" به وقت تهران (DAILY/WEEKLY) */
  timeOfDay?: string | null;
  /** WEEKLY: ۰=شنبه … ۶=جمعه */
  weekdays?: number[] | null;
}

const TIME_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const MIN_INTERVAL_MINUTES = 1;
const MAX_INTERVAL_MINUTES = 60 * 24 * 31;

/** پیام خطا (فارسی) یا null اگر معتبر باشد */
export function validateSchedule(s: ScheduleSpec): string | null {
  if (s.type === "INTERVAL") {
    const n = Number(s.intervalMinutes);
    if (!Number.isInteger(n) || n < MIN_INTERVAL_MINUTES || n > MAX_INTERVAL_MINUTES) return `فاصله‌ی اجرا باید عددی صحیح بین ${MIN_INTERVAL_MINUTES} و ${MAX_INTERVAL_MINUTES} دقیقه باشد`;
    return null;
  }
  if (s.type === "DAILY" || s.type === "WEEKLY") {
    if (!s.timeOfDay || !TIME_RE.test(s.timeOfDay)) return "ساعت اجرا را به‌صورت HH:mm وارد کنید";
    if (s.type === "WEEKLY") {
      const days = s.weekdays ?? [];
      if (days.length === 0) return "حداقل یک روز هفته را انتخاب کنید";
      if (days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return "روز هفته نامعتبر است";
    }
    return null;
  }
  return "نوع زمان‌بندی نامعتبر است";
}

/** اولین لحظه‌ی اجرا که اکیداً بعد از `after` است */
export function computeNextRun(s: ScheduleSpec, after: Date): Date {
  if (s.type === "INTERVAL") return new Date(after.getTime() + Number(s.intervalMinutes) * 60_000);
  const [hh, mm] = (s.timeOfDay as string).split(":").map(Number);
  const start = tehranParts(after);
  // حداکثر ۸ روز جلوتر کافی است (هفتگی: حتماً یکی از روزها در ۷ روز بعد می‌آید)
  for (let i = 0; i <= 8; i += 1) {
    const base = tehranWallToUtc(start.year, start.month, start.day + i, hh, mm);
    if (base.getTime() <= after.getTime()) continue;
    if (s.type === "WEEKLY" && !(s.weekdays ?? []).includes(jalaliWeekday(base))) continue;
    return base;
  }
  throw new Error("محاسبه‌ی زمان اجرای بعدی ممکن نشد");
}

/** بیشترین فاصله (به روز) بین دو اجرای پشت‌سرهم — برای تشخیص «شکاف» در بازه‌های تاریخی کارها */
export function maxGapDays(s: ScheduleSpec): number {
  if (s.type === "INTERVAL") return Math.max(1, Math.ceil(Number(s.intervalMinutes) / 1440));
  if (s.type === "DAILY") return 1;
  const days = Array.from(new Set(s.weekdays ?? [])).sort((a, b) => a - b);
  if (days.length <= 1) return 7;
  let gap = 0;
  for (let i = 0; i < days.length; i += 1) {
    const next = i + 1 < days.length ? days[i + 1] : days[0] + 7;
    gap = Math.max(gap, next - days[i]);
  }
  return gap;
}
