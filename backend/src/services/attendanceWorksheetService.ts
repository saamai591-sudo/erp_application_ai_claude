import { prisma } from "../lib/prisma";
import { AttendanceError, EMPLOYEE_SELECT, dayStr, minuteText, personName } from "./attendancePunchService";
import { getPeriods, periodContains } from "./employmentStatusService";
import { shiftTimeline, type TimelineRow } from "./attendanceShiftService";
import { cycleDayIndex } from "./attendanceWindowService";

// مدیریت تردد › «کارکرد روزانه»: مشتق است و ذخیره نمی‌شود (با تغییر تردد/انتساب/شیفت دوباره محاسبه می‌شود؛ ذخیره‌ی نتیجه با «بستن ماه تردد» می‌آید).
// برای هر کارمند و هر روز، ردیف‌های شیفتِ منتسب (هر بازه‌ی کاری؛ روز استراحت = یک ردیف) هر کدام پنجره‌ی حضور دارند؛ هر تردد با زمان مطلقش به پنجره‌ای می‌خورد که در آن می‌افتد
// (پنجره‌ها پشت‌سرهم‌اند؛ مرز دو انتسابِ متوالی: پنجره‌ی انتسابِ تازه‌تر مقدم است) یا با اختصاص دستی (workDate + workRowNo) به پنجره‌ی مشخص می‌رود.
// ترددهای داخل هر پنجره به ترتیب زمان جفت می‌شوند (۱ با ۲، ۳ با ۴ …): تعداد زوج ⇒ «کامل»، تعداد فرد ⇒ «ناقص» (نیازمند رسیدگی)، صفر ⇒ «بدون تردد».
// جهت ورود/خروج ذخیره نمی‌شود؛ همین جفت‌سازی آن را تعیین می‌کند. متغیرهای هر ردیف (حضور، تاخیر، تعجیل، اضافه‌کار قبل/بعد از بازه) ورودی «عوامل و فرمول»‌های تردد در فاز بعد است.
// ترددی که در هیچ پنجره‌ای نمی‌افتد (یا شیفتی منتسب نیست، یا اختصاص دستیِ نامعتبر دارد) در فهرست «نیازمند رسیدگی» می‌آید.

const DAY = 1440;
const DAY_MS = 86400000;
const MAX_DAYS = 62;
const dayNum = (d: Date) => Math.floor(d.getTime() / DAY_MS);
const fromNum = (n: number) => new Date(n * DAY_MS);
const mod = (a: number, n: number) => ((a % n) + n) % n;
const clockOf = (abs: number) => mod(abs, DAY);

export type RowStatus = "OK" | "INCOMPLETE" | "NO_PUNCH" | "WORK_ON_REST";
export const STATUS_FA: Record<RowStatus, string> = { OK: "کامل", INCOMPLETE: "ناقص (تعداد فرد)", NO_PUNCH: "بدون تردد", WORK_ON_REST: "کار در روز استراحت" };

interface Win {
  employeeId: number;
  workDay: number;
  rowNo: number;
  rest: boolean;
  shiftTitle: string;
  dayNo: number;
  segStartAbs: number | null;
  segEndAbs: number | null;
  wsAbs: number;
  weAbs: number;
  /** برنامه‌ی همان روز شیفت: استراحت، ساعت مرخصی و ساعت کاری خالص (مجموع بازه‌ها − استراحت) */
  dayBreak: number;
  dayLeave: number;
  dayNet: number;
  dayGross: number;
  /** تاریخ شروع انتسابِ مؤثر (برای تقدمِ انتساب تازه‌تر در مرز) */
  asgFrom: number;
  punches: { id: number; abs: number; manual: boolean }[];
}

interface Asg {
  employeeId: number;
  fromDate: Date;
  cycleStartDate: Date | null;
  shift: any;
}

function windowsOf(asgs: Asg[], timelines: Map<number, TimelineRow[]>, employeeId: number, day: number): Win[] {
  let a: Asg | undefined;
  for (const x of asgs) if (dayNum(x.fromDate) <= day) a = x;
  if (!a) return [];
  const d = fromNum(day);
  const idx = cycleDayIndex(a.shift.cycleType, a.shift.cycleLength, a.cycleStartDate, d);
  let tl = timelines.get(a.shift.id);
  if (!tl) {
    tl = shiftTimeline(a.shift);
    timelines.set(a.shift.id, tl);
  }
  const base = day * DAY;
  const dayDef = (a.shift.days ?? []).find((x: any) => x.dayNo === tl!.find((t) => t.dayIdx === idx)?.dayNo);
  const segTotal = dayDef && dayDef.isWorkDay ? (dayDef.segments ?? []).reduce((n: number, x: any) => n + (x.endMinute - x.startMinute), 0) : 0;
  const dayBreak = dayDef && dayDef.isWorkDay ? dayDef.breakMinutes : 0;
  const dayNet = Math.max(0, segTotal - dayBreak);
  const dayLeave = dayDef && dayDef.isWorkDay ? (dayDef.leaveMinutes ?? dayNet) : 0;
  return tl
    .filter((t) => t.dayIdx === idx)
    .map((t) => ({
      employeeId,
      workDay: day,
      rowNo: t.seq ?? 1,
      rest: t.seq === null,
      shiftTitle: a!.shift.title,
      dayNo: t.dayNo,
      segStartAbs: t.segStart === null ? null : base + t.segStart,
      segEndAbs: t.segEnd === null ? null : base + t.segEnd,
      wsAbs: base + t.wsRel,
      weAbs: base + t.weRel,
      dayBreak,
      dayLeave,
      dayNet,
      dayGross: segTotal,
      asgFrom: dayNum(a!.fromDate),
      punches: [],
    }));
}

const timeText = (abs: number, relDay: number) => {
  const off = Math.floor(abs / DAY) - relDay;
  return `${minuteText(clockOf(abs))}${off === 0 ? "" : off > 0 ? ` (+${off})` : ` (${off})`}`;
};

export async function buildWorksheet(opts: { from: Date; to: Date; employeeId?: number; employeeIds?: number[]; includeRest?: boolean }) {
  const { from, to } = opts;
  const f = dayNum(from), t = dayNum(to);
  if (t < f) throw new AttendanceError("تاریخ پایان قبل از تاریخ شروع است");
  if (t - f + 1 > MAX_DAYS) throw new AttendanceError(`بازه‌ی گزارش حداکثر ${MAX_DAYS} روز است`);

  // کارمندان: مشخص‌شده، یا همه‌ی کارمندانِ دارای انتساب/تردد در بازه
  let ids: number[];
  if (opts.employeeIds) ids = opts.employeeIds;
  else if (opts.employeeId) ids = [opts.employeeId];
  else {
    const [a, p] = await Promise.all([
      prisma.attendanceShiftAssignment.findMany({ where: { fromDate: { lte: to } }, select: { employeeId: true }, distinct: ["employeeId"] }),
      prisma.attendancePunch.findMany({ where: { date: { gte: fromNum(f - 1), lte: fromNum(t + 1) } }, select: { employeeId: true }, distinct: ["employeeId"] }),
    ]);
    ids = [...new Set([...a.map((x) => x.employeeId), ...p.map((x) => x.employeeId)])];
  }
  if (ids.length === 0) return { rows: [], review: [], summary: { employees: 0, rows: 0, incomplete: 0, noPunch: 0, unassigned: 0 } };

  const [emps, asgRows, punches] = await Promise.all([
    prisma.employee.findMany({ where: { id: { in: ids } }, select: EMPLOYEE_SELECT, orderBy: { personnelCode: "asc" } }),
    prisma.attendanceShiftAssignment.findMany({ where: { employeeId: { in: ids } }, orderBy: [{ employeeId: "asc" }, { fromDate: "asc" }], include: { shift: { include: { days: { include: { segments: true } } } } } }),
    prisma.attendancePunch.findMany({ where: { employeeId: { in: ids }, date: { gte: fromNum(f - 1), lte: fromNum(t + 1) } }, orderBy: [{ date: "asc" }, { minute: "asc" }] }),
  ]);
  const asgBy = new Map<number, Asg[]>();
  for (const a of asgRows) (asgBy.get(a.employeeId) ?? asgBy.set(a.employeeId, []).get(a.employeeId)!).push(a);
  const punchBy = new Map<number, typeof punches>();
  for (const p of punches) (punchBy.get(p.employeeId) ?? punchBy.set(p.employeeId, []).get(p.employeeId)!).push(p);
  const timelines = new Map<number, TimelineRow[]>();

  const rows: any[] = [];
  const review: any[] = [];

  for (const emp of emps) {
    const asgs = asgBy.get(emp.id) ?? [];
    const periods = await getPeriods(emp.id);
    const name = personName(emp.party);
    const wins = new Map<string, Win>(); // کلید: روز|ردیف
    const winList: Win[] = [];
    // پنجره‌های روزهای [f−1, t+1] (روزهای کنارِ بازه ممکن است ترددهای ابتدا/انتهای بازه را بگیرند)
    for (let d = f - 1; d <= t + 1; d++) {
      if (!periodContains(periods, fromNum(d))) continue;
      for (const w of windowsOf(asgs, timelines, emp.id, d)) {
        wins.set(`${w.workDay}|${w.rowNo}`, w);
        winList.push(w);
      }
    }
    const reviewBase = { employeeId: emp.id, personnelCode: emp.personnelCode, employeeName: name };
    for (const p of punchBy.get(emp.id) ?? []) {
      const abs = dayNum(p.date) * DAY + p.minute;
      let target: Win | undefined;
      let reason = "";
      if (p.workDate) {
        target = wins.get(`${dayNum(p.workDate)}|${p.workRowNo ?? 1}`);
        if (!target) reason = "اختصاص دستی به پنجره‌ای که دیگر در شیفتِ منتسب وجود ندارد";
      } else {
        for (const w of winList) if (abs >= w.wsAbs && abs < w.weAbs && (!target || w.asgFrom > target.asgFrom)) target = w;
        if (!target) reason = asgs.length === 0 || !asgs.some((a) => dayNum(a.fromDate) <= dayNum(p.date) + 1) ? "برای کارمند شیفتی منتسب نیست" : "در هیچ پنجره‌ی حضوری نمی‌افتد";
      }
      if (target) target.punches.push({ id: p.id, abs, manual: !!p.workDate });
      else if (dayNum(p.date) >= f && dayNum(p.date) <= t) review.push({ ...reviewBase, id: `U${p.id}`, kind: "UNASSIGNED", punchId: p.id, date: dayStr(p.date), time: minuteText(p.minute), reason });
    }
    for (const w of winList) {
      if (w.workDay < f || w.workDay > t) continue;
      w.punches.sort((a, b) => a.abs - b.abs);
      const n = w.punches.length;
      if (w.rest && n === 0 && !opts.includeRest) continue;
      // جفت‌سازی ترتیبی داخل پنجره
      let presence = 0;
      for (let i = 0; i + 1 < n; i += 2) presence += w.punches[i + 1].abs - w.punches[i].abs;
      const even = n % 2 === 0;
      const first = n > 0 ? w.punches[0].abs : null;
      const lastOut = n >= 2 && even ? w.punches[n - 1].abs : null;
      const status: RowStatus = n === 0 ? "NO_PUNCH" : !even ? "INCOMPLETE" : w.rest ? "WORK_ON_REST" : "OK";
      const m = (v: number | null) => (v === null || w.rest ? null : Math.max(0, v));
      const late = first !== null && w.segStartAbs !== null ? m(first - w.segStartAbs) : null;
      // اضافه‌کار قبل/بعد = مدتِ حضورِ واقعی (جفت‌های تردد) بیرون از بازه، نه فاصله‌ی اولین/آخرین تردد با بازه؛ پس خروجِ بینِ دو جفت (مثلاً ۱۷ تا ۲۰) اضافه‌کار حساب نمی‌شود.
      // ردیفِ ناقص (تعداد فرد) جفتِ کامل ندارد: برای قبل همان فاصله‌ی اولین تردد، برای بعد null.
      const pairs: [number, number][] = [];
      if (even) for (let i = 0; i + 1 < n; i += 2) pairs.push([w.punches[i].abs, w.punches[i + 1].abs]);
      const segS = w.segStartAbs, segE = w.segEndAbs;
      const overBefore =
        first === null || segS === null || w.rest ? null : even ? pairs.reduce((a, [i, o]) => a + Math.max(0, Math.min(o, segS) - i), 0) : m(segS - first);
      const early = lastOut !== null && w.segEndAbs !== null ? m(w.segEndAbs - lastOut) : null;
      // حضور داخل بازه‌ی شیفت: اشتراکِ هر جفت‌تردد با [شروع بازه، پایان بازه] (بیرون از بازه حساب نمی‌شود)
      const inShift = even && n >= 2 && segS !== null && segE !== null && !w.rest ? pairs.reduce((a, [i, o]) => a + Math.max(0, Math.min(o, segE) - Math.max(i, segS)), 0) : null;
      const overAfter = lastOut === null || segE === null || w.rest ? null : pairs.reduce((a, [i, o]) => a + Math.max(0, o - Math.max(i, segE)), 0);
      const rel = (abs: number) => ({ date: dayStr(fromNum(Math.floor(abs / DAY)))!, clock: clockOf(abs) });
      const row = {
        id: `${emp.id}|${dayStr(fromNum(w.workDay))}|${w.rowNo}`,
        employeeId: emp.id,
        personnelCode: emp.personnelCode,
        employeeName: name,
        workDate: dayStr(fromNum(w.workDay)),
        rowNo: w.rowNo,
        rest: w.rest,
        shiftTitle: w.shiftTitle,
        dayNo: w.dayNo,
        dayBreakMinutes: w.dayBreak,
        dayLeaveMinutes: w.dayLeave,
        dayNetMinutes: w.dayNet,
        dayGrossMinutes: w.dayGross,
        segStartClock: w.segStartAbs === null ? null : clockOf(w.segStartAbs),
        segEndClock: w.segEndAbs === null ? null : clockOf(w.segEndAbs),
        segEndsNextDay: w.segEndAbs !== null && w.segEndAbs - w.workDay * DAY >= DAY,
        windowStart: rel(w.wsAbs),
        windowEnd: rel(w.weAbs),
        punches: w.punches.map((p) => ({ id: p.id, time: timeText(p.abs, w.workDay), manual: p.manual })),
        firstIn: first === null ? null : timeText(first, w.workDay),
        lastOut: lastOut === null ? null : timeText(lastOut, w.workDay),
        presenceMinutes: n >= 2 ? presence : null,
        presenceInShiftMinutes: inShift,
        lateMinutes: late,
        earlyLeaveMinutes: early,
        overtimeBeforeMinutes: overBefore,
        overtimeAfterMinutes: overAfter,
        status,
        statusTitle: STATUS_FA[status],
      };
      rows.push(row);
      if (status === "INCOMPLETE") review.push({ ...reviewBase, id: `I${row.id}`, kind: "INCOMPLETE", date: row.workDate, rowNo: w.rowNo, time: row.punches.map((p) => p.time).join("، "), reason: `تعداد ترددهای پنجره فرد است (${n})؛ ترددی کم یا اضافه است` });
    }
  }
  rows.sort((a, b) => (a.personnelCode < b.personnelCode ? -1 : a.personnelCode > b.personnelCode ? 1 : a.workDate < b.workDate ? -1 : a.workDate > b.workDate ? 1 : a.rowNo - b.rowNo));
  return {
    rows,
    review,
    summary: {
      employees: emps.length,
      rows: rows.length,
      incomplete: rows.filter((r) => r.status === "INCOMPLETE").length,
      noPunch: rows.filter((r) => r.status === "NO_PUNCH").length,
      unassigned: review.filter((r) => r.kind === "UNASSIGNED").length,
    },
  };
}
