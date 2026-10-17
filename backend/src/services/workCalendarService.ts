import { prisma } from "../lib/prisma";
import { jalaliMonthRange } from "../utils/jalaliDate";

// تقویم کاری (حقوق و دستمزد): یک تقویم برای هر سال شمسی با ساعات کاری روزانه و ۱۲ ماه (روز/ساعت استاندارد و مجاز، بازه‌ی تردد).
// ماه در همه‌ی فرم‌های حقوق فقط از همین تقویم انتخاب می‌شود (missingMonthMessage در سرور هم اعمال می‌شود). ماهی «استفاده‌شده» است که برای آن
// فیش محاسبه‌شده، ورودی ماهانه یا روش محاسبه (با ماه صدور/اجرا) وجود داشته باشد؛ مقدار مجاز آن ماه قفل می‌شود و تقویمی که ماه استفاده‌شده دارد حذف نمی‌شود.

export class WorkCalendarError extends Error {}

export const MAX_DAILY_MINUTES = 23 * 60 + 59;
const MAX_MONTH_MINUTES = 31 * 24 * 60;

export interface MonthRow {
  month: number;
  startDate: Date;
  endDate: Date;
  standardDays: number;
  allowedDays: number;
  standardMinutes: number;
  allowedMinutes: number;
  trafficStartDate: Date;
  trafficEndDate: Date;
}

export function checkYear(year: number) {
  if (!Number.isInteger(year) || year < 1300 || year > 1600) throw new WorkCalendarError("سال باید عدد چهاررقمی معتبر باشد");
}

/** «۰۷:۲۰» / «7:20» → دقیقه؛ بیش از ۲۳:۵۹ یا صفر نامعتبر است */
export function parseDailyTime(v: unknown): number {
  const t = String(v ?? "")
    .trim()
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
  const m = /^(\d{1,2}):([0-5]?\d)$/.exec(t);
  if (!m) throw new WorkCalendarError("ساعات روزانه باید به‌صورت ساعت:دقیقه (حداکثر ۲۳:۵۹) باشد");
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  if (minutes <= 0 || minutes > MAX_DAILY_MINUTES) throw new WorkCalendarError("ساعات روزانه باید بین ۰۰:۰۱ و ۲۳:۵۹ باشد");
  return minutes;
}

/** ۱۲ ماه شمسی یک سال با مقادیر پیش‌فرض (روز مجاز = روز استاندارد) */
export function buildMonthRows(year: number, dailyMinutes: number): MonthRow[] {
  const out: MonthRow[] = [];
  for (let month = 1; month <= 12; month++) {
    const r = jalaliMonthRange(year, month);
    out.push({
      month,
      startDate: r.start,
      endDate: r.end,
      standardDays: r.days,
      allowedDays: r.days,
      standardMinutes: r.days * dailyMinutes,
      allowedMinutes: r.days * dailyMinutes,
      trafficStartDate: r.start,
      trafficEndDate: r.end,
    });
  }
  return out;
}

export const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

export function parseDay(v: unknown, label: string): Date {
  const d = new Date(`${String(v ?? "")}T00:00:00.000Z`);
  if (!v || isNaN(d.getTime())) throw new WorkCalendarError(`${label} نامعتبر است`);
  return d;
}

/** مقدارهای قابل ویرایش یک ماه از بدنه (روز مجاز، ساعت مجاز به دقیقه، بازه‌ی تردد) با اعتبارسنجی */
export function editableFields(input: any, label: string): { allowedDays: number; allowedMinutes: number; trafficStartDate: Date; trafficEndDate: Date } {
  const allowedDays = Number(input.allowedDays);
  if (!Number.isInteger(allowedDays) || allowedDays < 0 || allowedDays > 31) throw new WorkCalendarError(`${label}: روز مجاز باید عدد صحیح بین ۰ و ۳۱ باشد`);
  const allowedMinutes = Number(input.allowedMinutes);
  if (!Number.isInteger(allowedMinutes) || allowedMinutes < 0 || allowedMinutes > MAX_MONTH_MINUTES) throw new WorkCalendarError(`${label}: ساعت مجاز نامعتبر است`);
  const trafficStartDate = parseDay(input.trafficStartDate, `${label}: تاریخ شروع تردد`);
  const trafficEndDate = parseDay(input.trafficEndDate, `${label}: تاریخ پایان تردد`);
  if (trafficEndDate < trafficStartDate) throw new WorkCalendarError(`${label}: تاریخ پایان تردد نباید قبل از تاریخ شروع تردد باشد`);
  return { allowedDays, allowedMinutes, trafficStartDate, trafficEndDate };
}

export async function getCalendarMonth(year: number, month: number) {
  return prisma.workCalendarMonth.findFirst({ where: { month, calendar: { year } } });
}

/** پیام خطا اگر این سال/ماه در تقویم کاری نیست، وگرنه null (برای همه‌ی فرم‌های حقوقی که ماه انتخاب می‌کنند) */
export async function missingMonthMessage(year: number, month: number): Promise<string | null> {
  const row = await getCalendarMonth(year, month);
  return row ? null : `ماه ${month} سال ${year} در «تقویم کاری» تعریف نشده است؛ ابتدا تقویم کاری آن سال را بسازید`;
}

/** ماه‌های استفاده‌شده‌ی یک سال: فیش محاسبه‌شده، ورودی ماهانه یا روش محاسبه (ماه صدور یا اجرا) */
export async function usedMonths(year: number): Promise<Set<number>> {
  const [slips, inputs, execs, issues] = await Promise.all([
    prisma.payrollSlip.findMany({ where: { year }, distinct: ["month"], select: { month: true } }),
    prisma.payrollFactorInput.findMany({ where: { year }, distinct: ["month"], select: { month: true } }),
    prisma.payrollFactorMethod.findMany({ where: { execYear: year }, distinct: ["execMonth"], select: { execMonth: true } }),
    prisma.payrollFactorMethod.findMany({ where: { issueYear: year }, distinct: ["issueMonth"], select: { issueMonth: true } }),
  ]);
  return new Set<number>([...slips.map((x) => x.month), ...inputs.map((x) => x.month), ...execs.map((x) => x.execMonth), ...issues.map((x) => x.issueMonth)]);
}
