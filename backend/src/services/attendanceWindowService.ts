import { prisma } from "../lib/prisma";
import { displayDate } from "../utils/dateDisplay";
import { AttendanceError, assertEmployeeWorking, dayStr, parseDay } from "./attendancePunchService";
import { shiftTimeline } from "./attendanceShiftService";
import { WEEKLY_ANCHOR } from "./attendanceFormulaDefs";
import { applyToDay, loadExceptions, pickException } from "./attendanceDayExceptionService";

// مدیریت تردد › پنجره‌های حضورِ یک کارمند در یک تاریخ: شیفتِ مؤثر (آخرین انتساب با تاریخ شروع ≤ آن روز) + روزِ چرخه + ردیف‌های آن روز با پنجره‌شان.
// انتخابگر «اختصاص دستی به پنجره» در فرم ورود و خروج و کنترل ترددِ اختصاص‌داده‌شده از همین‌جا می‌آید (تنها نقطه‌ی محاسبه‌ی روزِ چرخه).

const DAY = 1440;
const DAY_MS = 86400000;
const mod = (a: number, n: number) => ((a % n) + n) % n;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);

export interface WindowOption {
  /** روز کاری (تاریخ روز شیفت) */
  workDate: string;
  /** شماره‌ی ردیف همان روز (۱ = اولین بازه؛ روز استراحت = ۱) */
  rowNo: number;
  rest: boolean;
  shiftTitle: string;
  dayNo: number;
  segStartClock: number | null;
  segEndClock: number | null;
  segEndsNextDay: boolean;
  windowStart: { date: string; clock: number };
  windowEnd: { date: string; clock: number };
}

/** شماره‌ی روز در چرخه (۰..N−۱) برای یک تاریخ: فرمول واحد برای هفتگی و چرخشی = (تاریخ − تاریخ مرجع) mod طول چرخه */
export function cycleDayIndex(cycleType: string, cycleLength: number, cycleStartDate: Date | null, date: Date): number {
  // مرجع: تاریخ مؤثر (انتساب یا شیفت)؛ شیفت هفتگیِ بی‌تاریخ از شنبه‌ی ثابت، چرخشیِ بی‌تاریخ (داده‌ی قدیمی) از خودِ آن تاریخ
  const anchor = cycleStartDate ?? (cycleType === "WEEKLY" ? WEEKLY_ANCHOR : date);
  return mod(Math.round((date.getTime() - anchor.getTime()) / DAY_MS), cycleLength);
}

export async function effectiveAssignmentOn(employeeId: number, date: Date) {
  return prisma.attendanceShiftAssignment.findFirst({
    where: { employeeId, fromDate: { lte: date } },
    orderBy: { fromDate: "desc" },
    include: { shift: { include: { days: { include: { segments: true } } } } },
  });
}

/** ردیف‌ها/پنجره‌های یک روز کاری برای کارمند؛ null = شیفتی منتسب نیست */
export async function windowRowsOn(employeeId: number, date: Date): Promise<WindowOption[] | null> {
  const a = await effectiveAssignmentOn(employeeId, date);
  if (!a) return null;
  const idx = cycleDayIndex(a.shift.cycleType, a.shift.cycleLength, a.cycleStartDate ?? a.shift.cycleStartDate, date);
  let rows = shiftTimeline(a.shift).filter((t) => t.dayIdx === idx);
  // استثنای روز (ساعت شروع/پایان اصلاح‌شده یا تعطیلی) همان‌طور که کارکرد روزانه می‌بیند
  const dn = Math.floor(date.getTime() / DAY_MS);
  const ex = pickException(await loadExceptions(dn, dn), dn, a.shift.id);
  if (ex) {
    const r = applyToDay(rows, ex);
    if (!r.skipped) rows = r.rows;
  }
  return rows
    .map((t) => ({
      workDate: dayStr(date)!,
      rowNo: t.seq ?? 1,
      rest: t.seq === null,
      shiftTitle: a.shift.title,
      dayNo: t.dayNo,
      segStartClock: t.segStart === null ? null : t.segStart % DAY,
      segEndClock: t.segEnd === null ? null : t.segEnd % DAY,
      segEndsNextDay: t.segEnd !== null && t.segEnd >= DAY,
      windowStart: { date: dayStr(addDays(date, Math.floor(t.wsRel / DAY)))!, clock: mod(t.wsRel, DAY) },
      windowEnd: { date: dayStr(addDays(date, Math.floor(t.weRel / DAY)))!, clock: mod(t.weRel, DAY) },
    }));
}

/** گزینه‌های انتخابگر «اختصاص دستی به پنجره» برای ترددی در تاریخ date: ردیف‌های روز قبل، همان روز و روز بعد (فقط روزهایی که کارمند در همکاری و شیفتِ منتسب دارد) */
export async function windowOptionsFor(employeeId: number, date: Date): Promise<WindowOption[]> {
  const out: WindowOption[] = [];
  for (const off of [-1, 0, 1]) {
    const d = addDays(date, off);
    try {
      await assertEmployeeWorking(employeeId, d);
    } catch {
      continue;
    }
    const rows = await windowRowsOn(employeeId, d);
    if (rows) out.push(...rows);
  }
  return out;
}

/**
 * اختصاص دستی ترددِ مبهم به یک پنجره‌ی حضور (روز کاری + شماره‌ی ردیف همان روز). هر دو خالی = پنجره از روی ساعت تردد.
 * روز کاری حداکثر یک روز با تاریخ تردد فاصله دارد، کارمند آن روز در همکاری است و باید شیفتی منتسب و ردیفی با آن شماره داشته باشد.
 */
export async function cleanWorkAssignment(employeeId: number, date: Date, rawDate: unknown, rawRow: unknown): Promise<{ workDate: Date | null; workRowNo: number | null }> {
  const hasRow = rawRow !== undefined && rawRow !== null && rawRow !== "";
  if (rawDate === undefined || rawDate === null || rawDate === "") {
    if (hasRow) throw new AttendanceError("برای اختصاص به پنجره، روز کاری را هم مشخص کنید");
    return { workDate: null, workRowNo: null };
  }
  const wd = parseDay(rawDate, "روز کاری");
  if (Math.abs(wd.getTime() - date.getTime()) > DAY_MS) throw new AttendanceError("روز کاری حداکثر یک روز با تاریخ تردد فاصله دارد");
  await assertEmployeeWorking(employeeId, wd);
  const row = hasRow ? Number(rawRow) : 1;
  if (!Number.isInteger(row) || row < 1) throw new AttendanceError("شماره‌ی ردیف شیفت نامعتبر است");
  const rows = await windowRowsOn(employeeId, wd);
  if (!rows) throw new AttendanceError(`برای این کارمند در تاریخ ${displayDate(wd)} شیفتی منتسب نیست؛ ابتدا شیفت را به او منتسب کنید`);
  if (!rows.some((r) => r.rowNo === row)) throw new AttendanceError(`در شیفت این کارمند برای ${displayDate(wd)} ردیف ${row} وجود ندارد`);
  return { workDate: wd, workRowNo: row };
}
