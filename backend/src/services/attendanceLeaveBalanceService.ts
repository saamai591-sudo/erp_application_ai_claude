import { prisma } from "../lib/prisma";
import { displayDate } from "../utils/dateDisplay";
import { tehranDate } from "../jobs/time";
import { AttendanceError, EMPLOYEE_SELECT, dayStr, parseDay, personName } from "./attendancePunchService";
import { employeeIdsInPeriod, getPeriods, periodContains } from "./employmentStatusService";
import { buildWorksheet } from "./attendanceWorksheetService";
import { getCalendarMonth } from "./workCalendarService";
import { leaveForDay, type ApprovedLeave } from "./attendanceLeaveService";
import { loadMissions, missionForDay } from "./attendanceMissionCalc";

// مدیریت تردد › مانده‌ی مرخصی (مرحله‌ی ۳). تنها محل قواعد؛ هیچ مانده‌ای ذخیره نمی‌شود — همیشه از روی این‌ها مشتق می‌شود:
//   مانده = مانده‌ی دستی (AttendanceLeaveBalanceEntry) + استحقاق ماهانه (AttendanceLeaveEntitlement، به‌ازای نوع × شیفت × ماه اجرا) − مصرف (درخواست‌های غیررد: ثبت‌شده + تاییدشده).
// واحد: نوع «روزانه» ⇒ روز؛ نوع «روزانه و ساعتی» ⇒ دقیقه (در فرم‌ها hhh:mm). فقط نوعی که «دارای مانده مرخصی» دارد مانده دارد.
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
  /** فقط برای مصرف: درخواستِ مبدأ (درخواستِ در حال ثبت = -1) */
  reqKey?: number;
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

function makeDailyMinutes() {
  const cache = new Map<number, number>();
  return async (day: number) => {
    if (cache.has(day)) return cache.get(day)!;
    const m = await prisma.workCalendarMonth.findFirst({ where: { startDate: { lte: fromNum(day) }, endDate: { gte: fromNum(day) } }, include: { calendar: { select: { dailyMinutes: true } } } });
    const v = m?.calendar.dailyMinutes ?? 480;
    cache.set(day, v);
    return v;
  };
}

/**
 * مصرفِ یک درخواست به تفکیک روز (واحد نوع: روز یا دقیقه) — تنها محاسبه‌ی مصرف؛ هم مانده/سقف‌ها و هم «مقدار درخواست» در فهرست/فرم از همین می‌آید.
 * نوع روزانه: ۱ روز برای هر روز کاری (و روز غیرکاری اگر countHolidays)؛ نوع روزانه و ساعتی: دقیقه‌ی مرخصی همان روز (leaveForDay) و روز غیرکاریِ countHolidays = ساعات کاری روزانه‌ی تقویم.
 */
export async function requestConsumption(
  type: { unit: LeaveUnit; key: string; countHolidays: boolean },
  employeeId: number,
  q: { fromDate: Date; toDate: Date; startMinute: number | null; endMinute: number | null },
  rows: Map<number, any[]>,
  dailyMinutesOn: (day: number) => Promise<number>
): Promise<{ day: number; amount: number; holiday?: boolean }[]> {
  const out: { day: number; amount: number; holiday?: boolean }[] = [];
  const f = dayNum(q.fromDate), t = dayNum(q.toDate);
  if (type.unit === "DAY") {
    for (let d = f; d <= t; d++) if ((rows.get(d) ?? []).some(isWorkRow) || type.countHolidays) out.push({ day: d, amount: 1 });
    return out;
  }
  const ap: ApprovedLeave[] = [{ employeeId, typeKey: type.key, fromDay: f, toDay: t, startMinute: q.startMinute, endMinute: q.endMinute }];
  for (let d = f - 1; d <= t; d++) {
    const lv = leaveForDay(ap, employeeId, d, rows.get(d) ?? []);
    if (lv.total > 0) out.push({ day: d, amount: lv.total });
    if (q.startMinute === null && type.countHolidays && d >= f && !(rows.get(d) ?? []).some(isWorkRow)) out.push({ day: d, amount: await dailyMinutesOn(d), holiday: true });
  }
  return out;
}

const AMOUNT_CACHE = new Map<string, { at: number; v: number }>();
const unitOfType = (t: { unit: string }): LeaveUnit => (t.unit === "DAY" ? "DAY" : "BOTH");

/** «مقدار» هر درخواست برای فهرست (روز یا دقیقه به واحد نوع)؛ کش کوتاه‌مدت بر پایه‌ی شناسه+زمان ویرایش+وضعیت، با همزمانیِ محدود */
export async function requestAmounts(reqs: any[]): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  const dm = makeDailyMinutes();
  const todo: any[] = [];
  const now = Date.now();
  for (const r of reqs) {
    const c = AMOUNT_CACHE.get(`${r.id}:${new Date(r.updatedAt).getTime()}`);
    if (c && now - c.at < 120000) out.set(r.id, c.v);
    else todo.push(r);
  }
  let i = 0;
  const worker = async () => {
    while (i < todo.length) {
      const r = todo[i++];
      try {
        const rows = await loadDayRows(r.employeeId, dayNum(r.fromDate) - 1, dayNum(r.toDate));
        const parts = await requestConsumption({ unit: unitOfType(r.leaveType), key: r.leaveType.key, countHolidays: r.leaveType.countHolidays }, r.employeeId, r, rows, dm);
        const v = parts.reduce((n, x) => n + x.amount, 0);
        out.set(r.id, v);
        AMOUNT_CACHE.set(`${r.id}:${new Date(r.updatedAt).getTime()}`, { at: Date.now(), v });
      } catch {
        // محاسبه‌ی مقدار نباید فهرست را خراب کند
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, todo.length) }, worker));
  return out;
}

/** مقدار یک درخواستِ هنوز ذخیره‌نشده (پیش‌نمایش فرم) */
export async function previewRequestAmount(leaveTypeId: number, employeeId: number, q: { fromDate: Date; toDate: Date; startMinute: number | null; endMinute: number | null }) {
  const type = await prisma.attendanceLeaveType.findUnique({ where: { id: leaveTypeId } });
  if (!type) return null;
  const unit = unitOfType(type);
  const rows = await loadDayRows(employeeId, dayNum(q.fromDate) - 1, dayNum(q.toDate));
  const parts = await requestConsumption({ unit, key: type.key, countHolidays: type.countHolidays }, employeeId, q, rows, makeDailyMinutes());
  const amount = parts.reduce((n, x) => n + x.amount, 0);
  return { unit, amount, text: fmtAmount(unit, amount) };
}

export async function computeLedger(employeeId: number, leaveTypeId: number, opts: { untilDay?: number; extra?: ReqLike; excludeRequestId?: number } = {}): Promise<Ledger> {
  const type = await prisma.attendanceLeaveType.findUnique({ where: { id: leaveTypeId } });
  if (!type) throw new AttendanceError("نوع مرخصی یافت نشد");
  const unit: LeaveUnit = type.unit === "DAY" ? "DAY" : "BOTH";
  const events: LedgerEvent[] = [];
  const push = (day: number, delta: number, kind: LedgerEvent["kind"], text: string, reqKey?: number) => events.push({ day, date: isoOf(day), delta, kind, text, reqKey });

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
  const dailyMinutesOn = makeDailyMinutes();
  for (const q of mine) {
    const f = dayNum(q.fromDate), t = dayNum(q.toDate);
    const rows = await loadDayRows(employeeId, f - 1, t);
    const label = q.number ? `مرخصی شماره ${q.number}` : "مرخصی (درخواست جاری)";
    for (const c of await requestConsumption({ unit, key: type.key, countHolidays: type.countHolidays }, employeeId, q, rows, dailyMinutesOn)) {
      push(c.day, -c.amount, "CONSUME", c.holiday ? `${label} (روز غیرکاری)` : label, q.id ?? -1);
      maxDay = Math.max(maxDay, c.day);
    }
    maxDay = Math.max(maxDay, t);
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
      if (type.entitlementKind === "ANNUAL") {
        // استحقاق سالانه: یک‌بار در ابتدای هر سالِ تقویم کاری (یا اولین روز همکاری در آن سال اگر دیرتر باشد)؛ مقدار کامل (بدون وابستگی به کارکرد).
        // قاعده‌ی هر سال = آخرین ماه اجرای ≤ ابتدای سال برای شیفتِ کارمند؛ اگر هنوز قاعده‌ای نبود، اولین قاعده‌ای که ماه اجرایش داخل همان سال است (از همان ماه به بعد)
        const years = [...new Set(months.map((m) => m.year))];
        const allMonths = await prisma.workCalendarMonth.findMany({ where: { year: { in: years } }, orderBy: { startDate: "asc" } });
        for (const y of years) {
          const ms = allMonths.filter((m) => m.year === y);
          if (ms.length === 0) continue;
          const ys = dayNum(ms[0].startDate), ye = dayNum(ms[ms.length - 1].endDate);
          let firstCoopInYear: number | null = null;
          for (let d = ys; d <= ye; d++) if (periodContains(periods, fromNum(d))) { firstCoopInYear = d; break; }
          if (firstCoopInYear === null) continue;
          let credit = Math.max(ys, firstCoopInYear);
          let shiftId = shiftAt(asgs, credit);
          if (shiftId === null) shiftId = asgs.find((a) => a.fromDay >= credit && a.fromDay <= ye)?.shiftId ?? null;
          if (shiftId === null) continue;
          let best: (typeof rules)[number] | undefined;
          for (const r of rules) if (r.shiftId === shiftId && dayNum(r.execMonth.startDate) <= ys && (!best || dayNum(r.execMonth.startDate) > dayNum(best.execMonth.startDate))) best = r;
          if (!best) {
            for (const r of rules) if (r.shiftId === shiftId && dayNum(r.execMonth.startDate) > ys && dayNum(r.execMonth.startDate) <= ye && (!best || dayNum(r.execMonth.startDate) < dayNum(best.execMonth.startDate))) best = r;
            if (best) credit = Math.max(credit, dayNum(best.execMonth.startDate));
          }
          if (!best) continue;
          const val = roundFor(unit, Number(best.amount));
          if (val !== 0) push(credit, val, "ACCRUAL", `استحقاق سالانه ${y}`);
        }
      } else
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
          const ms = await loadMissions([employeeId], s, e);
          const lv: ApprovedLeave[] = allActive.map((r) => ({ employeeId, typeKey: typeKeys.get(r.leaveTypeId) ?? "", fromDay: dayNum(r.fromDate), toDay: dayNum(r.toDate), startMinute: r.startMinute, endMinute: r.endMinute }));
          let scheduled = 0, present = 0;
          for (const [d, rs] of rows) {
            if (d < s || d > e || !rs.some(isWorkRow)) continue;
            scheduled++;
            const hasPunch = rs.some((r) => (r.punches?.length ?? 0) > 0);
            const l = leaveForDay(lv, employeeId, d, rs);
            const m = missionForDay(ms, employeeId, d, rs);
            if (hasPunch || l.hasDaily || l.total > 0 || m.hasDaily || m.total > 0) present++;
          }
          ratio = scheduled > 0 ? Math.min(1, present / scheduled) : 0;
          note = ` (حضور/مرخصی/ماموریت ${present} روز از ${scheduled} روز کاری)`;
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
  const by = new Map<number, { day: number; allowed: boolean; limit: number | null }[]>();
  for (const r of rows) (by.get(r.shiftId) ?? by.set(r.shiftId, []).get(r.shiftId)!).push({ day: dayNum(r.fromDate), allowed: r.allowed, limit: r.limit === null ? null : Number(r.limit) });
  /** سیاست مؤثر آن روز: مجاز بودن و سقف (null = بدون سقف) */
  return (shiftId: number | null, day: number): { allowed: boolean; limit: number | null } => {
    let v = { allowed: false, limit: null as number | null };
    if (shiftId === null) return v;
    for (const p of by.get(shiftId) ?? []) if (p.day <= day) v = { allowed: p.allowed, limit: p.allowed ? p.limit : null };
    return v;
  };
}

/**
 * مانده‌ی پایان هر روزِ مصرف (از روز شروع درخواست به بعد) منفی نشود، مگر مرخصی منفی برای شیفتِ کارمند در آن روز مجاز باشد.
 * extra = درخواستِ در حال ثبت/ویرایش (excludeRequestId = خودش در حالت ویرایش)؛ بدون extra درخواستِ موجود (تایید) در پایگاه داده است.
 */
export async function assertBalanceAllowed(p: { employeeId: number; leaveTypeId: number; fromDate: Date; extra?: ReqLike; excludeRequestId?: number; requestId?: number }) {
  const type = await prisma.attendanceLeaveType.findUnique({ where: { id: p.leaveTypeId } });
  if (!type || !type.deductsBalance) return;
  const L = await computeLedger(p.employeeId, p.leaveTypeId, { extra: p.extra, excludeRequestId: p.excludeRequestId });
  await assertUsageLimits(type, L, p);
  const from = dayNum(p.fromDate) - 1;
  const days = [...new Set(L.events.filter((e) => e.kind === "CONSUME" && e.day >= from).map((e) => e.day))].sort((a, b) => a - b);
  if (days.length === 0) return;
  const allowedOn = await policiesOf(p.leaveTypeId);
  const asgs: Asg[] = (await prisma.attendanceShiftAssignment.findMany({ where: { employeeId: p.employeeId }, orderBy: { fromDate: "asc" }, select: { fromDate: true, shiftId: true } })).map((a) => ({ fromDay: dayNum(a.fromDate), shiftId: a.shiftId }));
  for (const d of days) {
    const bal = L.balanceAt(d);
    if (bal < -EPS) {
      const pol = allowedOn(shiftAt(asgs, d), d);
      if (!pol.allowed) throw new AttendanceError(`مانده‌ی مرخصی «${type.title}» تا تاریخ ${displayDate(fromNum(d))} به ${fmtAmount(L.unit, bal)} می‌رسد و مرخصی منفی برای شیفت کارمند در این تاریخ مجاز نیست`);
      if (pol.limit !== null && bal < -pol.limit - EPS) throw new AttendanceError(`مانده‌ی مرخصی «${type.title}» تا تاریخ ${displayDate(fromNum(d))} به ${fmtAmount(L.unit, bal)} می‌رسد و از سقف مرخصی منفی (${fmtAmount(L.unit, pol.limit)}) بیشتر است`);
    }
  }
}

/**
 * سقف‌های استفاده (فقط نوعی که «سقف در هر درخواست / هر ماه» دارد): مقدارشان از «قاعده‌ی استحقاق» شیفتِ کارمند می‌آید (آخرین ماه اجرای ≤ همان تاریخ/ماه).
 *  • هر درخواست: مجموع مصرفِ خودِ درخواست ≤ سقف (قاعده‌ی روزِ شروع درخواست)؛
 *  • هر ماه: مجموع مصرفِ همه‌ی درخواست‌های غیررد آن نوع در هر ماهِ تقویم کاری که درخواست به آن می‌خورد ≤ سقف همان ماه.
 * قاعده یا سقفِ تعریف‌نشده = بدون کنترل. مصرف واحد نوع مرخصی است (روز یا دقیقه).
 */
async function assertUsageLimits(type: { id: number; title: string; hasPerRequestLimit: boolean; hasPerMonthLimit: boolean }, L: Ledger, p: { employeeId: number; leaveTypeId: number; fromDate: Date; extra?: ReqLike; requestId?: number }) {
  if (!type.hasPerRequestLimit && !type.hasPerMonthLimit) return;
  const key = p.extra ? (p.extra.id ?? -1) : p.requestId;
  if (key === undefined) return;
  const mine = L.events.filter((e) => e.kind === "CONSUME" && e.reqKey === key);
  if (mine.length === 0) return;
  const rules = await prisma.attendanceLeaveEntitlement.findMany({ where: { leaveTypeId: type.id }, include: { execMonth: { select: { startDate: true } } } });
  const asgs: Asg[] = (await prisma.attendanceShiftAssignment.findMany({ where: { employeeId: p.employeeId }, orderBy: { fromDate: "asc" }, select: { fromDate: true, shiftId: true } })).map((a) => ({ fromDay: dayNum(a.fromDate), shiftId: a.shiftId }));
  const ruleOn = (shiftId: number | null, day: number) => {
    let best: (typeof rules)[number] | undefined;
    if (shiftId === null) return undefined;
    for (const r of rules) if (r.shiftId === shiftId && dayNum(r.execMonth.startDate) <= day && (!best || dayNum(r.execMonth.startDate) > dayNum(best.execMonth.startDate))) best = r;
    return best;
  };
  const unit = L.unit;
  if (type.hasPerRequestLimit) {
    const f = dayNum(p.fromDate);
    const rule = ruleOn(shiftAt(asgs, f), f);
    if (!rule) throw new AttendanceError(`برای «${type.title}» و شیفتِ کارمند در تاریخ ${displayDate(p.fromDate)} قاعده‌ی استحقاق (با سقف استفاده) تعریف نشده است؛ ابتدا در «قاعده‌ی استحقاق مرخصی» تعریف کنید`);
    const cap = rule.perRequestLimit;
    if (cap !== null && cap !== undefined) {
      const total = mine.reduce((n, e) => n - e.delta, 0);
      if (total > Number(cap) + EPS) throw new AttendanceError(`مصرف این درخواست (${fmtAmount(unit, total)}) از سقف استفاده در هر درخواست «${type.title}» (${fmtAmount(unit, Number(cap))}) بیشتر است`);
    }
  }
  if (type.hasPerMonthLimit) {
    const months = await prisma.workCalendarMonth.findMany({ orderBy: { startDate: "asc" } });
    const monthOf = (day: number) => months.find((m) => dayNum(m.startDate) <= day && day <= dayNum(m.endDate));
    const touched = new Map<number, (typeof months)[number]>();
    for (const e of mine) { const m = monthOf(e.day); if (m) touched.set(m.id, m); }
    for (const m of touched.values()) {
      const s = dayNum(m.startDate), e = dayNum(m.endDate);
      const shiftId = shiftAt(asgs, s) ?? asgs.find((a) => a.fromDay >= s && a.fromDay <= e)?.shiftId ?? null;
      const rule = ruleOn(shiftId, s);
      if (!rule) throw new AttendanceError(`برای «${type.title}» و شیفتِ کارمند در ${MONTHS_FA[m.month - 1]} ${m.year} قاعده‌ی استحقاق (با سقف استفاده) تعریف نشده است؛ ابتدا در «قاعده‌ی استحقاق مرخصی» تعریف کنید`);
      const cap = rule.perMonthLimit;
      if (cap === null || cap === undefined) continue;
      const total = L.events.filter((x) => x.kind === "CONSUME" && x.day >= s && x.day <= e).reduce((n, x) => n - x.delta, 0);
      if (total > Number(cap) + EPS) throw new AttendanceError(`مصرف «${type.title}» در ${MONTHS_FA[m.month - 1]} ${m.year} (${fmtAmount(unit, total)}) از سقف استفاده در هر ماه (${fmtAmount(unit, Number(cap))}) بیشتر می‌شود`);
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
  if (!type.deductsBalance) throw new AttendanceError(`نوع مرخصی «${type.title}» «دارای مانده مرخصی» نیست و مانده ندارد؛ گزینه‌ی «دارای مانده مرخصی» را در تعریف نوع فعال کنید`);
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
    timing: r.timing as "START_OF_MONTH" | "END_OF_MONTH" | "START_OF_YEAR",
    kind: (r.leaveType?.entitlementKind ?? "MONTHLY") as "ANNUAL" | "MONTHLY",
    perRequestLimit: r.perRequestLimit === null || r.perRequestLimit === undefined ? null : Number(r.perRequestLimit),
    perMonthLimit: r.perMonthLimit === null || r.perMonthLimit === undefined ? null : Number(r.perMonthLimit),
    perRequestLimitText: r.perRequestLimit === null || r.perRequestLimit === undefined ? "" : fmtAmount(unit, Number(r.perRequestLimit)),
    perMonthLimitText: r.perMonthLimit === null || r.perMonthLimit === undefined ? "" : fmtAmount(unit, Number(r.perMonthLimit)),
    updatedAt: r.updatedAt,
  };
}

export const ENTITLEMENT_INCLUDE = { leaveType: { select: { title: true, unit: true, entitlementKind: true } }, shift: { select: { title: true } }, execMonth: { select: { year: true, month: true } } };

export async function cleanEntitlement(b: any) {
  const { type, unit } = await balanceType(b?.leaveTypeId);
  const shift = Number(b?.shiftId) ? await prisma.attendanceShift.findUnique({ where: { id: Number(b.shiftId) } }) : null;
  if (!shift) throw new AttendanceError("شیفت را انتخاب کنید");
  const cal = await getCalendarMonth(Number(b?.execYear), Number(b?.execMonth));
  if (!cal) throw new AttendanceError("ماه اجرا در «تقویم کاری» تعریف نشده است؛ ابتدا تقویم کاری آن سال را بسازید");
  const annual = type.entitlementKind === "ANNUAL";
  let basis = String(b?.basis ?? "NONE");
  if (basis !== "NONE" && basis !== "STANDARD" && basis !== "ACTUAL") throw new AttendanceError("وابستگی به کارکرد نامعتبر است");
  let timing = String(b?.timing ?? "END_OF_MONTH");
  if (annual) {
    // استحقاق سالانه: مقدار کامل در ابتدای سال؛ وابستگی به کارکرد و زمان تخصیص قابل انتخاب نیست
    basis = "NONE";
    timing = "START_OF_YEAR";
  } else {
    if (timing !== "START_OF_MONTH" && timing !== "END_OF_MONTH") throw new AttendanceError("زمان تخصیص نامعتبر است");
  }
  if (!annual && basis === "ACTUAL") {
    if (b?.timing === "START_OF_MONTH") throw new AttendanceError("برای استحقاقِ وابسته به کارکردِ واقعی، زمان تخصیص فقط «آخر ماه» است");
    timing = "END_OF_MONTH";
  }
  const amount = parseAmount(unit, b?.amount, annual ? "مقدار استحقاق سالانه" : "مقدار استحقاق ماهانه", annual ? MAX_MANUAL[unit] : MAX_MONTHLY[unit]);
  // سقف‌های استفاده: برای نوعی که تیکشان را دارد الزامی (مقدار هر آیتم گرفته می‌شود)، وگرنه خالی
  const perRequestLimit = type.hasPerRequestLimit ? parseAmount(unit, b?.perRequestLimit, "سقف استفاده در هر درخواست", MAX_MANUAL[unit]) : null;
  const perMonthLimit = type.hasPerMonthLimit ? parseAmount(unit, b?.perMonthLimit, "سقف استفاده در هر ماه", MAX_MANUAL[unit]) : null;
  return { leaveTypeId: type.id, shiftId: shift.id, execMonthId: cal.id, amount, basis: basis as any, timing: timing as any, perRequestLimit, perMonthLimit };
}

// ───────────────────────── مرخصی منفی ─────────────────────────

export function policyShape(r: any) {
  const unit = (r.leaveType?.unit === "DAY" ? "DAY" : "BOTH") as LeaveUnit;
  return {
    unit,
    limit: r.limit === null || r.limit === undefined ? null : Number(r.limit),
    limitText: r.allowed ? (r.limit === null || r.limit === undefined ? "بدون سقف" : fmtAmount(unit, Number(r.limit))) : "",
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

export const POLICY_INCLUDE = { leaveType: { select: { title: true, unit: true } }, shift: { select: { title: true } } };

export async function cleanPolicy(b: any) {
  const { type, unit } = await balanceType(b?.leaveTypeId);
  const shift = Number(b?.shiftId) ? await prisma.attendanceShift.findUnique({ where: { id: Number(b.shiftId) } }) : null;
  if (!shift) throw new AttendanceError("شیفت را انتخاب کنید");
  const fromDate = parseDay(b?.fromDate, "از تاریخ");
  if (typeof b?.allowed !== "boolean") throw new AttendanceError("مجاز/غیرمجاز بودن مرخصی منفی را مشخص کنید");
  // سقف: فقط وقتی مجاز است؛ خالی = بدون سقف. به روز (نوع روزانه) یا دقیقه (نوع روزانه و ساعتی)
  let limit: number | null = null;
  if (b.allowed === true && b?.limit !== undefined && b?.limit !== null && String(b.limit).trim() !== "") limit = parseAmount(unit, b.limit, "سقف مرخصی منفی", MAX_MANUAL[unit]);
  return { leaveTypeId: type.id, shiftId: shift.id, fromDate, allowed: b.allowed as boolean, limit };
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

// ───────────────────────── گزارش مانده‌ی مرخصی همه‌ی کارمندان ─────────────────────────

/**
 * ردیف به‌ازای (کارمند × نوع مرخصیِ دارای مانده) برای کارمندانی که در بازه‌ی [fromDay, toDay] در دوره‌ی همکاری‌اند و برای آن نوع «داده‌ای» دارند
 * (مانده‌ی دستی، درخواست غیررد، یا شیفتی که قاعده‌ی استحقاق دارد). ستون‌ها: «مانده‌ی اول دوره» = مجموعِ همه‌ی رویدادها از ازل تا قبل از fromDay (انباشته)؛
 * مانده‌ی دستی / استحقاق / مصرف فقط رویدادهای داخل بازه‌اند (مصرف منفی)؛ مانده = جمع همه‌ی این ستون‌ها. همان محاسبه‌ی computeLedger است.
 */
export async function balanceReport(fromDay: number, toDay: number, leaveTypeId?: number) {
  const asOfDay = toDay;
  const types = await prisma.attendanceLeaveType.findMany({ where: { deductsBalance: true, ...(leaveTypeId ? { id: leaveTypeId } : {}) }, orderBy: { id: "asc" } });
  if (types.length === 0) return { rows: [], from: isoOf(fromDay), asOf: isoOf(asOfDay) };
  const inCoop = new Set(await employeeIdsInPeriod(fromNum(fromDay), fromNum(toDay)));
  if (inCoop.size === 0) return { rows: [], from: isoOf(fromDay), asOf: isoOf(asOfDay) };
  const emps = await prisma.employee.findMany({ where: { id: { in: [...inCoop] } }, select: EMPLOYEE_SELECT, orderBy: { personnelCode: "asc" } });
  const asgs = await prisma.attendanceShiftAssignment.findMany({ where: { employeeId: { in: [...inCoop] } }, select: { employeeId: true, shiftId: true } });
  const shiftsOf = new Map<number, Set<number>>();
  for (const a of asgs) (shiftsOf.get(a.employeeId) ?? shiftsOf.set(a.employeeId, new Set()).get(a.employeeId)!).add(a.shiftId);

  const pairs: { emp: (typeof emps)[number]; type: (typeof types)[number] }[] = [];
  for (const t of types) {
    const [entries, reqs, rules] = await Promise.all([
      prisma.attendanceLeaveBalanceEntry.findMany({ where: { leaveTypeId: t.id }, select: { employeeId: true }, distinct: ["employeeId"] }),
      prisma.attendanceLeaveRequest.findMany({ where: { leaveTypeId: t.id, status: { in: ["PENDING", "APPROVED"] } }, select: { employeeId: true }, distinct: ["employeeId"] }),
      prisma.attendanceLeaveEntitlement.findMany({ where: { leaveTypeId: t.id }, select: { shiftId: true }, distinct: ["shiftId"] }),
    ]);
    const hasData = new Set<number>([...entries.map((x) => x.employeeId), ...reqs.map((x) => x.employeeId)]);
    const ruleShifts = new Set(rules.map((x) => x.shiftId));
    for (const e of emps) {
      if (hasData.has(e.id) || [...(shiftsOf.get(e.id) ?? [])].some((s) => ruleShifts.has(s))) pairs.push({ emp: e, type: t });
    }
  }
  const rows: any[] = [];
  const BATCH = 4;
  for (let i = 0; i < pairs.length; i += BATCH) {
    await Promise.all(
      pairs.slice(i, i + BATCH).map(async ({ emp, type }) => {
        const L = await computeLedger(emp.id, type.id, { untilDay: asOfDay });
        let opening = 0, manual = 0, accrual = 0, consumed = 0;
        for (const ev of L.events) {
          if (ev.day > toDay) continue;
          if (ev.day < fromDay) opening += ev.delta;
          else if (ev.kind === "MANUAL") manual += ev.delta;
          else if (ev.kind === "ACCRUAL") accrual += ev.delta;
          else consumed += ev.delta; // مصرف منفی است
        }
        const balance = opening + manual + accrual + consumed;
        rows.push({
          id: `${emp.id}|${type.id}`,
          employeeId: emp.id,
          personnelCode: emp.personnelCode,
          employeeName: personName(emp.party),
          leaveTypeId: type.id,
          leaveTypeTitle: type.title,
          unit: L.unit,
          opening,
          manual,
          accrual,
          consumed,
          balance,
          openingText: fmtAmount(L.unit, opening),
          manualText: fmtAmount(L.unit, manual),
          accrualText: fmtAmount(L.unit, accrual),
          consumedText: fmtAmount(L.unit, consumed),
          balanceText: fmtAmount(L.unit, balance),
        });
      })
    );
  }
  rows.sort((a, b) => (a.personnelCode < b.personnelCode ? -1 : a.personnelCode > b.personnelCode ? 1 : a.leaveTypeId - b.leaveTypeId));
  return { rows, from: isoOf(fromDay), asOf: isoOf(asOfDay) };
}
