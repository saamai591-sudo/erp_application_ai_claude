import { prisma } from "../lib/prisma";
import { displayDate } from "../utils/dateDisplay";
import { AttendanceError, EMPLOYEE_SELECT, assertDayOpen, assertEmployeeWorking, assertMonthFromOpen, dayStr, parseDay, personName } from "./attendancePunchService";
import { employeeIdsInPeriod } from "./employmentStatusService";

// مدیریت تردد › عملیات › «مجوزها» — تنها نویسنده‌ی AttendancePermitValue. مقدارِ «عامل مجوز» (AttendanceFactor.source = PERMIT) برای یک کارمند:
//  • عامل روزانه: مقدار برای یک «تاریخ» (مثلاً مجوز ۳ ساعت اضافه‌کار در آن روز)؛ در فرمول روزانه با [F:عامل] خوانده می‌شود، ثبت‌نشده = ۰.
//  • عامل ماهانه: مقدار از یک «ماه» (تقویم کاری) تا مقدار بعدی ادامه دارد (مقدار هر ماه = آخرین ردیف تا آن ماه)؛ در فرمول ماهانه با [M:عامل] خوانده می‌شود، ثبت‌نشده = ۰ (سقف صفر).
//  • برای هر کارمند و عامل در هر تاریخ/ماه فقط یک مقدار هست (تکراری رد می‌شود؛ همان را ویرایش کنید). کارمند، عامل و تاریخ/ماهِ یک مقدار بعد از ثبت عوض نمی‌شود (حذف و دوباره ثبت)؛ فقط «مقدار».
//  • قالب مقدار از نوع مقدارِ عامل می‌آید: TIME به «دقیقه»، DAYS و NUMBER عدد. مقدار منفی نیست.
//  • قفل «محاسبات تردد»: روزانه با assertDayOpen؛ ماهانه با assertMonthFromOpen (ردیفی از ماه M به بعد اثر دارد، پس اگر برای کارمند ماهِ M یا بعدش محاسبه شده باشد رد می‌شود).
// فیلدهای ثبت‌کننده/زمان عمداً ندارد (زیرساخت Auditing جداگانه می‌آید).

const MONTHS_FA = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
const DAY_MS = 86400000;

export const PERMIT_INCLUDE = { employee: { select: EMPLOYEE_SELECT }, factor: true, calendarMonth: true };

const hm = (m: number) => `${Math.trunc(m / 60)}:${String(Math.round(m % 60)).padStart(2, "0")}`;

export function valueText(valueType: string, v: number): string {
  if (valueType === "TIME") return `${hm(v)} ساعت`;
  if (valueType === "DAYS") return `${v} روز`;
  return String(v);
}

export function permitShape(r: any) {
  const v = Number(r.value);
  const m = r.calendarMonth;
  return {
    id: r.id,
    employeeId: r.employeeId,
    personnelCode: r.employee?.personnelCode ?? "",
    employeeName: r.employee ? personName(r.employee.party) : "",
    factorId: r.factorId,
    factorTitle: r.factor?.title ?? "",
    level: r.factor?.level as "DAY" | "MONTH",
    valueType: r.factor?.valueType as "NUMBER" | "TIME" | "DAYS",
    date: dayStr(r.date),
    year: m?.year ?? null,
    month: m?.month ?? null,
    periodText: m ? `${MONTHS_FA[m.month - 1] ?? m.month} ${m.year}` : "",
    value: v,
    valueText: valueText(r.factor?.valueType, v),
    updatedAt: r.updatedAt,
  };
}

async function loadPermitFactor(factorId: unknown) {
  const id = Number(factorId);
  const f = id ? await prisma.attendanceFactor.findUnique({ where: { id } }) : null;
  if (!f) throw new AttendanceError("عامل مجوز را انتخاب کنید");
  if (f.source !== "PERMIT") throw new AttendanceError(`عامل «${f.title}» از نوع مجوز نیست`);
  if (!f.isActive) throw new AttendanceError(`عامل «${f.title}» غیرفعال است`);
  return f;
}

/** مقدار ورودی (متناسب با نوع مقدار و سطح عامل) → عدد معتبر؛ monthDays فقط برای عامل ماهانه */
function parseValue(f: { valueType: string; level: string }, raw: unknown, monthDays?: number): number {
  if (raw === null || raw === undefined || raw === "") throw new AttendanceError("مقدار را وارد کنید");
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) throw new AttendanceError("مقدار باید عددی و بزرگ‌تر یا مساوی صفر باشد");
  if (f.valueType === "TIME") {
    if (!Number.isInteger(n)) throw new AttendanceError("مقدار زمان باید به دقیقه‌ی کامل باشد");
    const max = (f.level === "DAY" ? 1 : monthDays ?? 31) * 1440;
    if (n > max) throw new AttendanceError(`مقدار زمان نمی‌تواند از ${hm(max)} ساعت بیشتر باشد`);
    return n;
  }
  if (f.valueType === "DAYS") {
    if (!Number.isInteger(n)) throw new AttendanceError("تعداد روز باید عدد صحیح باشد");
    const max = f.level === "DAY" ? 1 : monthDays ?? 31;
    if (n > max) throw new AttendanceError(`تعداد روز نمی‌تواند از ${max} بیشتر باشد`);
    return n;
  }
  if (n > 1e9) throw new AttendanceError("مقدار بیش از حد بزرگ است");
  if (Math.abs(n * 10000 - Math.round(n * 10000)) > 1e-6) throw new AttendanceError("مقدار حداکثر ۴ رقم اعشار دارد");
  return n;
}

const monthLabel = (m: { year: number; month: number }) => `${MONTHS_FA[m.month - 1] ?? m.month} ${m.year}`;

interface Target {
  factor: Awaited<ReturnType<typeof loadPermitFactor>>;
  employeeId: number;
  date: Date | null;
  month: { id: number; year: number; month: number; startDate: Date; endDate: Date; trafficStartDate: Date; trafficEndDate: Date } | null;
  value: number;
}

/** اعتبارسنجی هدف (کارمند + عامل + تاریخ یا ماه) و مقدار */
async function cleanTarget(b: any): Promise<Target> {
  const employeeId = Number(b?.employeeId);
  if (!employeeId) throw new AttendanceError("کارمند الزامی است");
  const factor = await loadPermitFactor(b?.factorId);
  if (factor.level === "DAY") {
    const date = parseDay(b?.date, "تاریخ");
    await assertEmployeeWorking(employeeId, date);
    await assertDayOpen(employeeId, date);
    return { factor, employeeId, date, month: null, value: parseValue(factor, b?.value) };
  }
  const year = Number(b?.year), monthNo = Number(b?.month);
  const month = await prisma.workCalendarMonth.findFirst({ where: { year, month: monthNo } });
  if (!month) throw new AttendanceError(`ماه ${monthNo} سال ${year} در «تقویم کاری» تعریف نشده است`);
  if ((await employeeIdsInPeriod(month.trafficStartDate, month.trafficEndDate, [employeeId])).length === 0) throw new AttendanceError(`کارمند در بازه‌ی تردد ${monthLabel(month)} همکاری ندارد`);
  await assertMonthFromOpen(employeeId, month.startDate);
  const monthDays = Math.round((month.endDate.getTime() - month.startDate.getTime()) / DAY_MS) + 1;
  return { factor, employeeId, date: null, month, value: parseValue(factor, b?.value, monthDays) };
}

const dupMessage = (t: Target) => `برای این کارمند و عامل «${t.factor.title}» در ${t.date ? `تاریخ ${displayDate(t.date)}` : monthLabel(t.month!)} قبلاً مقدار ثبت شده است؛ همان را ویرایش کنید`;

export async function createPermit(body: any) {
  const t = await cleanTarget(body);
  try {
    return await prisma.attendancePermitValue.create({
      data: { employeeId: t.employeeId, factorId: t.factor.id, date: t.date, calendarMonthId: t.month?.id ?? null, value: t.value },
      include: PERMIT_INCLUDE,
    });
  } catch (e: any) {
    if (e?.code === "P2002") throw new AttendanceError(dupMessage(t));
    throw e;
  }
}

/** فقط «مقدار» ویرایش می‌شود؛ قفل برای همان تاریخ/ماه بررسی می‌شود */
export async function updatePermit(id: number, body: any) {
  const ex = await prisma.attendancePermitValue.findUnique({ where: { id }, include: { factor: true, calendarMonth: true } });
  if (!ex) throw new AttendanceError("مقدار مجوز یافت نشد");
  await assertLocked(ex);
  const monthDays = ex.calendarMonth ? Math.round((ex.calendarMonth.endDate.getTime() - ex.calendarMonth.startDate.getTime()) / DAY_MS) + 1 : undefined;
  const value = parseValue(ex.factor, body?.value, monthDays);
  return prisma.attendancePermitValue.update({ where: { id }, data: { value }, include: PERMIT_INCLUDE });
}

export async function deletePermit(id: number) {
  const ex = await prisma.attendancePermitValue.findUnique({ where: { id }, include: { factor: true, calendarMonth: true } });
  if (!ex) throw new AttendanceError("مقدار مجوز یافت نشد");
  await assertLocked(ex);
  await prisma.attendancePermitValue.delete({ where: { id } });
}

async function assertLocked(ex: { employeeId: number; date: Date | null; calendarMonth: { startDate: Date } | null }) {
  if (ex.date) await assertDayOpen(ex.employeeId, ex.date);
  else if (ex.calendarMonth) await assertMonthFromOpen(ex.employeeId, ex.calendarMonth.startDate);
}
