import { prisma } from "../lib/prisma";
import { displayDate } from "../utils/dateDisplay";
import { tehranDate } from "../jobs/time";
import { AttendanceError, EMPLOYEE_SELECT, dayStr, parseDay, personName } from "./attendancePunchService";
import { getPeriods, periodContains } from "./employmentStatusService";
import { buildWorksheet } from "./attendanceWorksheetService";
import { getCalendarMonth } from "./workCalendarService";
import { leaveForDay, type ApprovedLeave } from "./attendanceLeaveService";

// مدیریت تردد › مانده‌ی مرخصی (مرحله‌ی ۳). تنها محل قواعد؛ هیچ مانده‌ای ذخیره نمی‌شود — همیشه از روی این‌ها مشتق می‌شود:
//   مانده = مانده‌ی دستی (AttendanceLeaveBalanceEntry) + استحقاق ماهانه (AttendanceLeaveEntitlement، به‌ازای نوع × شیفت × ماه اجرا) − مصرف (درخواست‌های غیررد: ثبت‌شده + تاییدشده).
// واحد: نوع «روزانه» ⇒ روز؛ نوع «روزانه و ساعتی» ⇒ دقیقه (در فرم‌ها hhh:mm). فقط نوعی که «از مانده کم شود» دارد مانده دارد.
// استحقاق ماه M: شیفتِ کارمند در اولین روز ماه (وگرنه اولین انتسابی که داخل ماه شروع می‌شود)؛ قاعده = آخرین «ماه اجرا» ≤ M برای (نوع، شیفت).
//   NONE = مقدار کامل؛ STANDARD = مقدار × (روزهای ماه که کارمند در همکاری و دارای همان شیفت بوده ÷ روز استاندارد ماه تقویم، حداکثر ۱)؛
//   ACTUAL = مقدار × (روزهای کاریِ برنامه‌ریزی‌شده که حضور یا مرخصیِ غیررد داشته ÷ روزهای کاریِ برنامه‌ریزی‌شده‌ی کارمند در ماه)، فقط «پایان ماه».
//   زمان تخصیص: اول یا آخر ماه (ACTUAL همیشه آخر ماه). ماه بدون هیچ روز همکاری استحقاق ندارد.
// مصرف: نوع روزانه ⇒ ۱ روز برای هر روز کاری مرخصی (و روز غیرکاری هم اگر نوع «روز تعطیل وسط مرخصی جزو مرخصی» داشته باشد)؛
//   نوع روزانه و ساعتی ⇒ دقیقه‌ی مرخصی همان روز (leaveForDay؛ تمام‌روز = ساعت مرخصیِ روز شیفت) و روز غیرکاریِ countHolidays = ساعات کاری روزانه‌ی تقویم.
// کنترل منفی: در ثبت/ویرایش و تایید درخواست، مانده‌ی پایان هر روزِ مصرفِ (از روز شروع درخواست به بعد) نباید منفی شود، مگر «مرخصی منفی» برای (نوع، شیفتِ کارمند در آن روز) از آن تاریخ مجاز باشد.
// سقف سالانه / انتقال به سال بعد / تفکیک مانده به سال / متغیر فرمول از مانده فعلاً ساخته نشده است.

const DAY = 1440;
const DAY_MS = 86400000;
const EPS = 1e-6;
const dayNum = (d: Date) => Math.floor(d.getTime() / DAY_MS);
const fromNum = (n: number) => new Date(n * DAY_MS);
const isoOf = (n: number) => fromNum(n).toISOString().slice(0, 10);
const MONTHS_FA = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
const LOCK_KEY = 7100013;

export type LeaveUnit = "DAY" | "BOTH";

export const todayNum = () => dayNum(new Date(`${tehranDate()}T00:00:00Z`));

const round4 = (v: number) => Math.round(v * 10000) / 10000;
const roundFor = (unit: LeaveUnit, v: number) => (unit === "DAY" ? round4(v) : Math.round(v));

/** نمایش مقدار: روز یا ساعت:دقیقه */
export function fmtAmount(unit: LeaveUnit, v: number): string {
  const neg = v < -EPS;
  const a = Math.abs(v);
  if (unit === "DAY") return `${neg ? "-" : ""}${String(Math.round(a * 100) / 100)} روز`;
  const m = Math.round(a);
  return `${neg ? "-" : ""}${Math.trunc(m / 60)}:${String(m % 60).padStart(2, "0")} ساعت`;
}

// ───────────────────────── محاسبه‌ی مانده ─────────────────────────

export interface ReqLike {
  id?: number | null;
  number?: number | null;
  leaveTypeId: number;
  fromDate: Date;
  toDate: Date;
  startMinute: number | null;
  endMinute: number | null;
}

export interface LedgerEvent {
  day: number;
  date: string;
  delta: number;
  kind: "MANUAL" | "ACCRUAL" | "CONSUME";
  text: string;
}

interface Asg {
  fromDay: number;
  shiftId: number;
}

const shiftAt = (asgs: Asg[], day: number): number | null => {
  let s: number | null = null;
  for (const a of asgs) if (a.fromDay <= day) s = a.shiftId;
  return s;
};

/** سطرهای «کارکرد روزانه» کارمند، به تفکیک روز کاری (بازه‌ی طولانی در تکه‌های ≤ ۶۲ روز) */
async function loadDayRows(employeeId: number, fromDay: number, toDay: number): Promise<Map<number, any[]>> {
  const out = new Map<number, any[]>();
  for (let s = fromDay; s <= toDay; s += 62) {
    const e = Math.min(toDay, s + 61);
    const ws = await buildWorksheet({ from: fromNum(s), to: fromNum(e), employeeIds: [employeeId], includeRest: true });
    for (const r of ws.rows) {
      const d = dayNum(new Date(`${r.workDate}T00:00:00Z`));
      (out.get(d) ?? out.set(d, []).get(d)!).push(r);
    }
  }
  return out;
}

const isWorkRow = (r: any) => !r.rest && r.dayType === "WORK";

export interface Ledger {
  unit: LeaveUnit;
  typeTitle: string;
  events: LedgerEvent[];
  /** مانده‌ی پایان روز (شامل همه‌ی رویدادهای تا آن روز) */
  balanceAt: (day: number) => number;
}

export async function computeLedger(employeeId: number, leaveTypeId: number, opts: { untilDay?: number; extra?: ReqLike; excludeRequestId?: number } = {}): Promise<Ledger> {
  const type = await prisma.attendanceLeaveType.findUnique({ where: { id: leaveTypeId } });
  if (!type) throw new AttendanceError("نوع مرخصی یافت نشد");
  const unit: LeaveUnit = type.unit === "DAY" ? "DAY" : "BOTH";
  const events: LedgerEvent[] = [];
  const push = (day: number, delta: number, kind: LedgerEvent["kind"], text: string) => events.push({ day, date: isoOf(day), delta, kind, text });

  // مانده‌ی دستی
  const entries = await prisma.attendanceLeaveBalanceEntry.findMany({ where: { employeeId, leaveTypeId } });
  for (const e of entries) push(dayNum(e.date), Number(e.amount), "MANUAL", e.reason);

  // مصرف: درخواست‌های غیررد
  const active: ReqLike[] = (
    await prisma.attendanceLeaveRequest.findMany({
      where: { employeeId, status: { in: ["PENDING", "APPROVED"] }, ...(opts.excludeRequestId ? { id: { not: opts.excludeRequestId } } : {}) },
      select: { id: true, number: true, leaveTypeId: true, fromDate: true, toDate: true, startMinute: true, endMinute: true },
    })
  ).map((r) => ({ ...r }));
  if (opts.extra) active.push(opts.extra);
  const mine = active.filter((r) => r.leaveTypeId === leaveTypeId);

  let maxDay = opts.untilDay ?? todayNum();
  const monthCache = new Map<number, number>();
  const dailyMinutesOn = async (day: number) => {
    if (monthCache.has(day)) return monthCache.get(day)!;
    const m = await prisma.workCalendarMonth.findFirst({ where: { startDate: { lte: fromNum(day) }, endDate: { gte: fromNum(day) } }, include: { calendar: { select: { dailyMinutes: true } } } });
    const v = m?.calendar.dailyMinutes ?? 480;
    monthCache.set(day, v);
    return v;
  };
  for (const q of mine) {
    const f = dayNum(q.fromDate), t = dayNum(q.toDate);
    const rows = await loadDayRows(employeeId, f - 1, t);
    const label = q.number ? `مرخصی شماره ${q.number}` : "مرخصی (درخواست جاری)";
    if (unit === "DAY") {
      for (let d = f; d <= t; d++) {
        const work = (rows.get(d) ?? []).some(isWorkRow);
        if (work || type.countHolidays) push(d, -1, "CONSUME", label);
        maxDay = Math.max(maxDay, d);
      }
    } else {
      const ap: ApprovedLeave[] = [{ employeeId, typeKey: type.key, fromDay: f, toDay: t, startMinute: q.startMinute, endMinute: q.endMinute }];
      for (let d = f - 1; d <= t; d++) {
        const lv = leaveForDay(ap, employeeId, d, rows.get(d) ?? []);
        if (lv.total > 0) push(d, -lv.total, "CONSUME", label);
        if (q.startMinute === null && type.countHolidays && d >= f && !(rows.get(d) ?? []).some(isWorkRow)) push(d, -(await dailyMinutesOn(d)), "CONSUME", `${label} (روز غیرکاری)`);
        maxDay = Math.max(maxDay, d);
      }
    }
  }

  // استحقاق ماهانه
  const rules = await prisma.attendanceLeaveEntitlement.findMany({ where: { leaveTypeId }, include: { execMonth: { select: { startDate: true } } } });
  if (rules.length) {
    const periods = await getPeriods(employeeId);
    const asgRows = await prisma.attendanceShiftAssignment.findMany({ where: { employeeId }, orderBy: { fromDate: "asc" }, select: { fromDate: true, shiftId: true } });
    const asgs: Asg[] = asgRows.map((a) => ({ fromDay: dayNum(a.fromDate), shiftId: a.shiftId }));
    if (periods.length && asgs.length) {
      const firstCoop = Math.min(...periods.map((p) => dayNum(p.startDate)));
      const months = await prisma.workCalendarMonth.findMany({ where: { startDate: { lte: fromNum(maxDay) }, endDate: { gte: fromNum(firstCoop) } }, orderBy: { startDate: "asc" } });
      const allActive = active; // برای ACTUAL: مرخصی هر نوعِ غیررد روز را «حاضر» می‌کند
      const typeKeys = new Map<number, string>();
      for (const t of await prisma.attendanceLeaveType.findMany({ select: { id: true, key: true } })) typeKeys.set(t.id, t.key);
      for (const m of months) {
        const s = dayNum(m.startDate), e = dayNum(m.endDate);
        let shiftId = shiftAt(asgs, s);
        if (shiftId === null) shiftId = asgs.find((a) => a.fromDay >= s && a.fromDay <= e)?.shiftId ?? null;
        if (shiftId === null) continue;
        let best: (typeof rules)[number] | undefined;
        for (const r of rules) if (r.shiftId === shiftId && dayNum(r.execMonth.startDate) <= s && (!best || dayNum(r.execMonth.startDate) > dayNum(best.execMonth.startDate))) best = r;
        if (!best) continue;
        let coop = 0, sameShiftCoop = 0;
        for (let d = s; d <= e; d++) {
          if (!periodContains(periods, fromNum(d))) continue;
          coop++;
          if (shiftAt(asgs, d) === shiftId) sameShiftCoop++;
        }
        if (coop === 0) continue;
        const amount = Number(best.amount);
        let ratio = 1;
        let note = "";
        if (best.basis === "STANDARD") {
          ratio = m.standardDays > 0 ? Math.min(1, sameShiftCoop / m.standardDays) : 0;
          note = ` (متناسب با ${sameShiftCoop} روز از ${m.standardDays} روز استاندارد)`;
        } else if (best.basis === "ACTUAL") {
          const rows = await loadDayRows(employeeId, s, e);
          const lv: ApprovedLeave[] = allActive.map((r) => ({ employeeId, typeKey: typeKeys.get(r.leaveTypeId) ?? "", fromDay: dayNum(r.fromDate), toDay: dayNum(r.toDate), startMinute: r.startMinute, endMinute: r.endMinute }));
          let scheduled = 0, present = 0;
          for (const [d, rs] of rows) {
            if (d < s || d > e || !rs.some(isWorkRow)) continue;
            scheduled++;
            const hasPunch = rs.some((r) => (r.punches?.length ?? 0) > 0);
            const l = leaveForDay(lv, employeeId, d, rs);
            if (hasPunch || l.hasDaily || l.total > 0) present++;
          }
          ratio = scheduled > 0 ? Math.min(1, present / scheduled) : 0;
          note = ` (حضور/مرخصی ${present} روز از ${scheduled} روز کاری)`;
        }
        const val = roundFor(unit, amount * ratio);
        if (val === 0) continue;
        const day = best.basis === "ACTUAL" || best.timing === "END_OF_MONTH" ? e : s;
        push(day, val, "ACCRUAL", `استحقاق ${MONTHS_FA[m.month - 1]} ${m.year}${note}`);
      }
    }
  }

  events.sort((a, b) => a.day - b.day || (a.kind === "CONSUME" ? 1 : 0) - (b.kind === "CONSUME" ? 1 : 0));
  return { unit, typeTitle: type.title, events, balanceAt: (day) => events.reduce((n, e) => (e.day <= day ? n + e.delta : n), 0) };
}

/** مانده‌ی کارمند برای یک نوع در پایان یک روز (پیش‌فرض امروز) */
export async function balanceOn(employeeId: number, leaveTypeId: number, day: number | undefined, excludeRequestId?: number) {
  const d = day ?? todayNum();
  const L = await computeLedger(employeeId, leaveTypeId, { untilDay: d, excludeRequestId });
  const v = L.balanceAt(d);
  return { unit: L.unit, typeTitle: L.typeTitle, date: isoOf(d), balance: v, text: fmtAmount(L.unit, v) };
}

export async function ledgerOf(employeeId: number, leaveTypeId: number) {
  const L = await computeLedger(employeeId, leaveTypeId, {});
  let run = 0;
  return {
    unit: L.unit,
    typeTitle: L.typeTitle,
    today: isoOf(todayNum()),
    todayBalance: fmtAmount(L.unit, L.balanceAt(todayNum())),
    events: L.events.map((e) => {
      run += e.delta;
      return { date: e.date, kind: e.kind, text: e.text, delta: e.delta, deltaText: fmtAmount(L.unit, e.delta), balanceText: fmtAmount(L.unit, run), future: e.day > todayNum() };
    }),
  };
}

// ───────────────────────── مرخصی منفی و کنترل ─────────────────────────

async function policiesOf(leaveTypeId: number) {
  const rows = await prisma.attendanceLeaveNegativePolicy.findMany({ where: { leaveTypeId }, orderBy: { fromDate: "asc" } });
  const by = new Map<number, { day: number; allowed: boolean }[]>();
  for (const r of rows) (by.get(r.shiftId) ?? by.set(r.shiftId, []).get(r.shiftId)!).push({ day: dayNum(r.fromDate), allowed: r.allowed });
  return (shiftId: number | null, day: number) => {
    if (shiftId === null) return false;
    let v = false;
    for (const p of by.get(shiftId) ?? []) if (p.day <= day) v = p.allowed;
    return v;
  };
}

/**
 * مانده‌ی پایان هر روزِ مصرف (از روز شروع درخواست به بعد) منفی نشود، مگر مرخصی منفی برای شیفتِ کارمند در آن روز مجاز باشد.
 * extra = درخواستِ در حال ثبت/ویرایش (excludeRequestId = خودش در حالت ویرایش)؛ بدون extra درخواستِ موجود (تایید) در پایگاه داده است.
 */
export async function assertBalanceAllowed(p: { employeeId: number; leaveTypeId: number; fromDate: Date; extra?: ReqLike; excludeRequestId?: number }) {
  const type = await prisma.attendanceLeaveType.findUnique({ where: { id: p.leaveTypeId } });
  if (!type || !type.deductsBalance) return;
  const L = await computeLedger(p.employeeId, p.leaveTypeId, { extra: p.extra, excludeRequestId: p.excludeRequestId });
  const from = dayNum(p.fromDate) - 1;
  const days = [...new Set(L.events.filter((e) => e.kind === "CONSUME" && e.day >= from).map((e) => e.day))].sort((a, b) => a - b);
  if (days.length === 0) return;
  const allowedOn = await policiesOf(p.leaveTypeId);
  const asgs: Asg[] = (await prisma.attendanceShiftAssignment.findMany({ where: { employeeId: p.employeeId }, orderBy: { fromDate: "asc" }, select: { fromDate: true, shiftId: true } })).map((a) => ({ fromDay: dayNum(a.fromDate), shiftId: a.shiftId }));
  for (const d of days) {
    const bal = L.balanceAt(d);
    if (bal < -EPS && !allowedOn(shiftAt(asgs, d), d)) {
      throw new AttendanceError(`مانده‌ی مرخصی «${type.title}» تا تاریخ ${displayDate(fromNum(d))} به ${fmtAmount(L.unit, bal)} می‌رسد و مرخصی منفی برای شیفت کارمند در این تاریخ مجاز نیست`);
    }
  }
}

/** قفل سراسری کارمند برای هم‌زمانیِ کنترل مانده و ثبت درخواست (باید داخل تراکنش صدا زده شود) */
export async function lockEmployeeBalance(tx: { $executeRawUnsafe: (q: string) => Promise<unknown> }, employeeId: number) {
  await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${LOCK_KEY}, ${Number(employeeId)})`);
}

// ───────────────────────── مانده‌ی دستی ─────────────────────────

const MAX_MANUAL = { DAY: 3660, BOTH: 1000000 };
const MAX_MONTHLY = { DAY: 366, BOTH: 527040 };

function parseAmount(unit: LeaveUnit, raw: unknown, label: string, max: number): number {
  const v = Number(raw);
  if (!Number.isFinite(v) || v <= 0) throw new AttendanceError(`${label} باید عددی بزرگ‌تر از صفر باشد`);
  if (unit === "BOTH") {
    if (!Number.isInteger(v)) throw new AttendanceError(`${label} برای این نوع مرخصی باید ساعت:دقیقه (دقیقه‌ی کامل) باشد`);
  } else if (Math.abs(v * 10000 - Math.round(v * 10000)) > 1e-6) throw new AttendanceError(`${label} حداکثر چهار رقم اعشار دارد`);
  if (v > max) throw new AttendanceError(`${label} بیش از حد مجاز است`);
  return v;
}

async function balanceType(id: unknown) {
  const type = Number(id) ? await prisma.attendanceLeaveType.findUnique({ where: { id: Number(id) } }) : null;
  if (!type) throw new AttendanceError("نوع مرخصی را انتخاب کنید");
  if (!type.deductsBalance) throw new AttendanceError(`نوع مرخصی «${type.title}» از مانده کم نمی‌شود و مانده ندارد؛ گزینه‌ی «از مانده کم شود» را در تعریف نوع فعال کنید`);
  return { type, unit: (type.unit === "DAY" ? "DAY" : "BOTH") as LeaveUnit };
}

export function entryShape(e: any) {
  const unit = (e.leaveType?.unit === "DAY" ? "DAY" : "BOTH") as LeaveUnit;
  const amount = Number(e.amount);
  return {
    id: e.id,
    employeeId: e.employeeId,
    personnelCode: e.employee?.personnelCode ?? "",
    employeeName: e.employee ? personName(e.employee.party) : "",
    leaveTypeId: e.leaveTypeId,
    leaveTypeTitle: e.leaveType?.title ?? "",
    unit,
    date: dayStr(e.date),
    direction: amount >= 0 ? "INCREASE" : "DECREASE",
    amount: Math.abs(amount),
    amountText: fmtAmount(unit, amount),
    reason: e.reason,
    updatedAt: e.updatedAt,
  };
}

export const ENTRY_INCLUDE = { employee: { select: EMPLOYEE_SELECT }, leaveType: { select: { title: true, unit: true } } };

export async function cleanEntry(b: any) {
  const employeeId = Number(b?.employeeId);
  if (!employeeId) throw new AttendanceError("کارمند الزامی است");
  const { type, unit } = await balanceType(b?.leaveTypeId);
  const date = parseDay(b?.date, "تاریخ");
  if (!periodContains(await getPeriods(employeeId), date)) throw new AttendanceError(`کارمند در تاریخ ${displayDate(date)} در دوره‌ی همکاری نیست`);
  const reason = typeof b?.reason === "string" ? b.reason.trim() : "";
  if (!reason) throw new AttendanceError("دلیل الزامی است");
  const dir = String(b?.direction ?? "INCREASE");
  if (dir !== "INCREASE" && dir !== "DECREASE") throw new AttendanceError("نوع تغییر (افزایش/کاهش) نامعتبر است");
  const amount = parseAmount(unit, b?.amount, "مقدار", MAX_MANUAL[unit]);
  return { employeeId, leaveTypeId: type.id, date, amount: dir === "DECREASE" ? -amount : amount, reason };
}

export async function createEntry(d: Awaited<ReturnType<typeof cleanEntry>>, userId: number | null) {
  return prisma.attendanceLeaveBalanceEntry.create({ data: { ...d, createdById: userId } });
}

// ───────────────────────── قاعده‌ی استحقاق ─────────────────────────

export function entitlementShape(r: any) {
  const unit = (r.leaveType?.unit === "DAY" ? "DAY" : "BOTH") as LeaveUnit;
  return {
    id: r.id,
    leaveTypeId: r.leaveTypeId,
    leaveTypeTitle: r.leaveType?.title ?? "",
    unit,
    shiftId: r.shiftId,
    shiftTitle: r.shift?.title ?? "",
    execYear: r.execMonth?.year,
    execMonth: r.execMonth?.month,
    amount: Number(r.amount),
    amountText: fmtAmount(unit, Number(r.amount)),
    basis: r.basis as "NONE" | "STANDARD" | "ACTUAL",
    timing: r.timing as "START_OF_MONTH" | "END_OF_MONTH",
    updatedAt: r.updatedAt,
  };
}

export const ENTITLEMENT_INCLUDE = { leaveType: { select: { title: true, unit: true } }, shift: { select: { title: true } }, execMonth: { select: { year: true, month: true } } };

export async function cleanEntitlement(b: any) {
  const { type, unit } = await balanceType(b?.leaveTypeId);
  const shift = Number(b?.shiftId) ? await prisma.attendanceShift.findUnique({ where: { id: Number(b.shiftId) } }) : null;
  if (!shift) throw new AttendanceError("شیفت را انتخاب کنید");
  const cal = await getCalendarMonth(Number(b?.execYear), Number(b?.execMonth));
  if (!cal) throw new AttendanceError("ماه اجرا در «تقویم کاری» تعریف نشده است؛ ابتدا تقویم کاری آن سال را بسازید");
  const basis = String(b?.basis ?? "NONE");
  if (basis !== "NONE" && basis !== "STANDARD" && basis !== "ACTUAL") throw new AttendanceError("وابستگی به کارکرد نامعتبر است");
  let timing = String(b?.timing ?? "END_OF_MONTH");
  if (timing !== "START_OF_MONTH" && timing !== "END_OF_MONTH") throw new AttendanceError("زمان تخصیص نامعتبر است");
  if (basis === "ACTUAL") {
    if (b?.timing === "START_OF_MONTH") throw new AttendanceError("برای استحقاقِ وابسته به کارکردِ واقعی، زمان تخصیص فقط «آخر ماه» است");
    timing = "END_OF_MONTH";
  }
  const amount = parseAmount(unit, b?.amount, "مقدار استحقاق ماهانه", MAX_MONTHLY[unit]);
  return { leaveTypeId: type.id, shiftId: shift.id, execMonthId: cal.id, amount, basis: basis as any, timing: timing as any };
}

// ───────────────────────── مرخصی منفی ─────────────────────────

export function policyShape(r: any) {
  return {
    id: r.id,
    leaveTypeId: r.leaveTypeId,
    leaveTypeTitle: r.leaveType?.title ?? "",
    shiftId: r.shiftId,
    shiftTitle: r.shift?.title ?? "",
    fromDate: dayStr(r.fromDate),
    allowed: r.allowed,
    updatedAt: r.updatedAt,
  };
}

export const POLICY_INCLUDE = { leaveType: { select: { title: true } }, shift: { select: { title: true } } };

export async function cleanPolicy(b: any) {
  const { type } = await balanceType(b?.leaveTypeId);
  const shift = Number(b?.shiftId) ? await prisma.attendanceShift.findUnique({ where: { id: Number(b.shiftId) } }) : null;
  if (!shift) throw new AttendanceError("شیفت را انتخاب کنید");
  const fromDate = parseDay(b?.fromDate, "از تاریخ");
  if (typeof b?.allowed !== "boolean") throw new AttendanceError("مجاز/غیرمجاز بودن مرخصی منفی را مشخص کنید");
  return { leaveTypeId: type.id, shiftId: shift.id, fromDate, allowed: b.allowed as boolean };
}

/** آیا برای این نوع داده‌ی مانده (دستی/استحقاق/مرخصی منفی) وجود دارد؟ (برای قفلِ تغییر واحد) */
export async function typeHasBalanceData(leaveTypeId: number): Promise<boolean> {
  const [a, b, c] = await Promise.all([
    prisma.attendanceLeaveBalanceEntry.count({ where: { leaveTypeId } }),
    prisma.attendanceLeaveEntitlement.count({ where: { leaveTypeId } }),
    prisma.attendanceLeaveNegativePolicy.count({ where: { leaveTypeId } }),
  ]);
  return a + b + c > 0;
}
