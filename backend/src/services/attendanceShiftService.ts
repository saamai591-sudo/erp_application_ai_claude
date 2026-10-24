import { prisma } from "../lib/prisma";
import { DAY_TYPE_FA, type AttDayType } from "./attendanceFormulaDefs";
import { AttendanceError, minuteText } from "./attendancePunchService";

// مدیریت تردد › شیفت: تنها نویسنده‌ی AttendanceShift/Day/Segment. شیفت = الگوی تناوبی روزها (هفتگی ۷روزه هم‌تراز هفته، یا چرخشی N روزه).
// هر روز: کاری/غیرکاری؛ دست‌کم یک بازه‌ی کاری (شروع/پایان، پایان می‌تواند روز بعد باشد)؛ «استراحت» (مثلاً ناهار) که جزو ساعت کاری نیست؛ و
// «ساعت مرخصی» = مقداری که اگر فرد آن روز را مرخصی بگیرد از مانده‌ی مرخصی‌اش کم می‌شود (خالی = ساعت کاری خالص = مجموع بازه‌ها − استراحت؛
// مثلاً شیفت ۹ ساعته با ۳۰ دقیقه ناهار ⇒ ۸:۳۰). انتساب شیفت به افراد (با نقطه‌ی شروع چرخه‌ی چرخشی) در فرم جداگانه‌ی بعدی است.
//
// «پنجره‌ی حضور» (کارکرد روزانه، فاز بعد): هر ردیف شیفت = هر بازه‌ی کاری (و برای روز استراحت یک ردیف خالی) پنجره‌ی خودش را دارد و ترددهای هر پنجره
// داخل همان پنجره جفت می‌شوند؛ پس یک روز می‌تواند چند پنجره داشته باشد (مثلاً ۰۰:۰۰–۰۶:۰۰ و ۱۸:۰۰–۲۴:۰۰). برای هر ردیف فقط «شروع پنجره» ذخیره می‌شود و پایانش
// خودکار «شروع پنجره‌ی ردیف بعدی در خط زمانی چرخه» است (ردیف آخر به اولِ چرخه‌ی بعد وصل می‌شود) ⇒ پنجره‌ها هم‌پوشانی و فاصله ندارند. پنجره‌ی هر بازه باید
// خودِ آن بازه را بپوشاند. ورودی «شروع پنجره» ساعت روی ساعت است و تنها نقطه‌ی تبدیلش resolveWindowStart است: «آخرین ساعتِ هم‌نامِ نه دیرتر از شروع بازه» (پس شروع
// پنجره‌ی یک بازه‌ی ۰۰:۰۰ می‌تواند ۲۰:۰۰ روز قبل باشد)؛ برای روز استراحت ساعتِ همان روز. خالی = پیش‌فرض: ۴ ساعت قبل از شروع بازه (روز استراحت ۰۴:۰۰) ولی نه زودتر از
// پایان ردیف قبل. استثنا: ترددِ مبهم را کاربر با «روز کاری + ردیف» روی خود تردد (AttendancePunch.workDate/workRowNo) دستی به یک پنجره اختصاص می‌دهد.
// زمان‌ها در پایگاه داده «دقیقه از ابتدای روز شیفت» است و پایان می‌تواند بیش از ۱۴۴۰ باشد؛ ورودی/خروجی فرم «ساعت روی ساعت» (۰ تا ۱۴۳۹) است
// و بازه‌ی عبور از نیمه‌شب را همین سرویس محاسبه می‌کند (تنها نقطه‌ی این قاعده).

const DAY = 1440;
const WEEKLY_LEN = 7;
const MAX_ROTATION = 62;
export const DEFAULT_WINDOW_LEAD = 240;
export const MAX_SEGMENTS = 6;

export interface SegmentInput {
  startClock: number;
  endClock: number;
  /** شروع پنجره‌ی حضور (ساعت روی ساعت)؛ خالی = پیش‌فرض */
  windowStartClock?: number | null;
}
export interface SegmentData {
  startMinute: number;
  endMinute: number;
  /** شروع پنجره نسبت به ابتدای روز شیفت (می‌تواند منفی = روز قبل) */
  windowStartMinute: number;
}
export interface DayInput {
  dayNo: number;
  dayType: AttDayType;
  breakMinutes: number;
  leaveMinutes: number | null;
  /** فقط روز غیرکاری: شروع پنجره‌ی آن روز نسبت به ابتدای روز */
  windowStartMinute: number;
  segments: SegmentData[];
}
export interface ShiftData {
  code: number | null;
  title: string;
  isActive: boolean;
  cycleType: "WEEKLY" | "ROTATING";
  cycleLength: number;
  description: string | null;
  days: DayInput[];
}

const int = (v: unknown, label: string, min: number, max: number): number => {
  const n = Number(v);
  if (v === null || v === undefined || v === "" || !Number.isInteger(n) || n < min || n > max) throw new AttendanceError(`${label} نامعتبر است`);
  return n;
};
const mod = (a: number, n: number) => ((a % n) + n) % n;

/** بازه‌های «ساعت روی ساعت» یک روز → دقیقه‌های مطلق (پایان کوچک‌تر/مساوی شروع ⇒ روز بعد؛ هر بازه‌ی بعدی بعد از پایان قبلی) */
export function resolveSegments(raw: { startClock: number; endClock: number }[], label: string): { startMinute: number; endMinute: number }[] {
  const out: { startMinute: number; endMinute: number }[] = [];
  let prevEnd = -1;
  for (const [i, s] of raw.entries()) {
    const sc = int(s.startClock, `${label}: شروع بازه ${i + 1}`, 0, DAY - 1);
    const ec = int(s.endClock, `${label}: پایان بازه ${i + 1}`, 0, DAY - 1);
    const start = prevEnd < 0 ? sc : sc + Math.max(0, Math.ceil((prevEnd - sc) / DAY)) * DAY;
    const end = ec + (Math.floor((start - ec) / DAY) + 1) * DAY;
    if (end - start >= DAY) throw new AttendanceError(`${label}: طول بازه ${i + 1} باید کمتر از ۲۴ ساعت باشد`);
    if (prevEnd >= 0 && start < prevEnd) throw new AttendanceError(`${label}: بازه ${i + 1} با بازه‌ی قبل هم‌پوشانی دارد`);
    out.push({ startMinute: start, endMinute: end });
    prevEnd = end;
  }
  if (out.length && out[out.length - 1].endMinute - out[0].startMinute > DAY) throw new AttendanceError(`${label}: مجموع بازه‌های یک روز نباید از ۲۴ ساعت بیشتر باشد (بازه‌ها باید پشت‌سرهم و بدون هم‌پوشانی باشند)`);
  return out;
}

export const totalMinutesOf = (segs: { startMinute: number; endMinute: number }[]) => segs.reduce((s, x) => s + (x.endMinute - x.startMinute), 0);

/** ساعتِ ورودیِ شروع پنجره → دقیقه نسبت به ابتدای روز: بازه‌ی کاری: آخرین ساعتِ هم‌نام که دیرتر از شروع بازه نباشد؛ روز استراحت: ساعتِ همان روز */
export function resolveWindowStart(clock: number, segStart: number | null): number {
  return segStart === null ? clock : segStart - mod(segStart - clock, DAY);
}

// ── خط زمانی ردیف‌ها (برای پنجره‌ها) ──

interface Row {
  day: DayInput;
  seg: SegmentData | null;
  /** ابتدای روز شیفت در خط زمانی چرخه */
  base: number;
  startAbs: number | null;
  endAbs: number | null;
  /** شروع پنجره (مطلق در خط زمانی)؛ NaN = هنوز تعیین نشده */
  ws: number;
  label: string;
}

function buildRows(days: DayInput[]): Row[] {
  const rows: Row[] = [];
  days.forEach((d, i) => {
    const base = i * DAY;
    if (d.dayType !== "WORK" || d.segments.length === 0) rows.push({ day: d, seg: null, base, startAbs: null, endAbs: null, ws: base + d.windowStartMinute, label: `روز ${d.dayNo}` });
    else d.segments.forEach((s, k) => rows.push({ day: d, seg: s, base, startAbs: base + s.startMinute, endAbs: base + s.endMinute, ws: base + s.windowStartMinute, label: d.segments.length > 1 ? `روز ${d.dayNo} بازه ${k + 1}` : `روز ${d.dayNo}` }));
  });
  return rows;
}

function autoStart(row: Row, prev: { ws: number; endAbs: number | null } | null): number {
  const cand = row.seg ? row.startAbs! - DEFAULT_WINDOW_LEAD : row.base + DEFAULT_WINDOW_LEAD;
  const lower = prev ? Math.max(prev.ws + 1, prev.endAbs ?? prev.ws + 1) : -Infinity;
  return Math.max(cand, lower);
}

/** شروع خالیِ پنجره (NaN) ⇒ پیش‌فرض؛ سپس خط زمانی: پنجره‌ها پشت‌سرهم، و هر پنجره خودِ بازه‌اش را بپوشاند */
function resolveAndValidateWindows(days: DayInput[]) {
  const rows = buildRows(days);
  const N = days.length * DAY;
  // ردیف‌های «خودکار»: ابتدا پیش‌فرضِ ساده، سپس تا ثبات (هر ردیف نه زودتر از پایان ردیف قبل؛ ردیف اول به ردیف آخرِ چرخه‌ی قبل وصل است)
  const auto = rows.map((r) => Number.isNaN(r.ws));
  rows.forEach((r, k) => {
    if (auto[k]) r.ws = r.seg ? r.startAbs! - DEFAULT_WINDOW_LEAD : r.base + DEFAULT_WINDOW_LEAD;
  });
  for (let pass = 0; pass < rows.length + 2; pass++) {
    let changed = false;
    rows.forEach((r, k) => {
      if (!auto[k]) return;
      const wrap = k === 0;
      const prev = rows[(k - 1 + rows.length) % rows.length];
      const w = autoStart(r, { ws: prev.ws - (wrap ? N : 0), endAbs: prev.endAbs === null ? null : prev.endAbs - (wrap ? N : 0) });
      if (w !== r.ws) {
        r.ws = w;
        changed = true;
      }
    });
    if (!changed) break;
  }
  rows.forEach((r, k) => {
    const wrap = k + 1 === rows.length;
    const next = rows[(k + 1) % rows.length];
    const nextWs = next.ws + (wrap ? N : 0);
    if (!(r.ws < nextWs)) throw new AttendanceError(`${r.label}: پنجره‌های حضور باید پشت‌سرهم و بدون هم‌پوشانی باشند؛ شروع پنجره‌ی ${r.label} باید قبل از شروع پنجره‌ی ${next.label} باشد`);
    if (r.seg) {
      if (r.ws > r.startAbs!) throw new AttendanceError(`${r.label}: شروع پنجره‌ی حضور باید قبل از شروع بازه‌ی کاری (${minuteText(r.seg.startMinute % DAY)}) باشد`);
      if (nextWs < r.endAbs!) throw new AttendanceError(`${r.label}: پنجره‌ی حضور باید تا پایان بازه‌ی کاری (${minuteText(r.seg.endMinute % DAY)}${r.seg.endMinute >= DAY ? " روز بعد" : ""}) ادامه داشته باشد؛ شروع پنجره‌ی ${next.label} را دیرتر بگذارید`);
    }
  });
  // نتیجه به ساختار روزها برمی‌گردد (نسبت به ابتدای روز)
  rows.forEach((r) => {
    if (r.seg) r.seg.windowStartMinute = r.ws - r.base;
    else r.day.windowStartMinute = r.ws - r.base;
  });
}

export async function normalizeShift(b: any, excludeId?: number): Promise<ShiftData> {
  const title = typeof b?.title === "string" ? b.title.trim().replace(/\s+/g, " ") : "";
  if (!title) throw new AttendanceError("عنوان شیفت الزامی است");
  if (await prisma.attendanceShift.findFirst({ where: { title, ...(excludeId ? { NOT: { id: excludeId } } : {}) } })) throw new AttendanceError("شیفت دیگری با همین عنوان وجود دارد");
  const cycleType = b?.cycleType === "ROTATING" ? "ROTATING" : "WEEKLY";
  const cycleLength = cycleType === "WEEKLY" ? WEEKLY_LEN : int(b?.cycleLength, "طول چرخه", 2, MAX_ROTATION);
  let code: number | null = null;
  if (b?.code !== undefined && b?.code !== null && b?.code !== "") {
    code = int(b.code, "کد", 1, 999999);
    if (await prisma.attendanceShift.findFirst({ where: { code, ...(excludeId ? { NOT: { id: excludeId } } : {}) } })) throw new AttendanceError("این کد قبلاً استفاده شده است");
  }
  const rawDays: any[] = Array.isArray(b?.days) ? b.days : [];
  if (rawDays.length !== cycleLength) throw new AttendanceError(`تعریف همه‌ی ${cycleLength} روز چرخه لازم است`);
  const seen = new Set<number>();
  const days: DayInput[] = rawDays.map((d) => {
    const dayNo = int(d?.dayNo, "شماره‌ی روز", 1, cycleLength);
    if (seen.has(dayNo)) throw new AttendanceError(`روز ${dayNo} تکراری است`);
    seen.add(dayNo);
    const label = `روز ${dayNo}`;
    // نوع روز: dayType؛ کلاینت‌های قدیمی فقط isWorkDay (بولی) می‌فرستادند
    const dayType: AttDayType = d?.dayType === "WORK" || d?.dayType === "SHIFT_OFF" || d?.dayType === "OFFICIAL_HOLIDAY" ? d.dayType : d?.dayType === undefined && d?.isWorkDay !== undefined ? (d.isWorkDay ? "WORK" : "SHIFT_OFF") : (() => { throw new AttendanceError(`روز ${dayNo}: نوع روز نامعتبر است`); })();
    const isWorkDay = dayType === "WORK";
    const clockOrNull = (v: unknown, what: string): number | null => (v === undefined || v === null || v === "" ? null : int(v, `${label}: ${what}`, 0, DAY - 1));
    if (!isWorkDay) {
      const c = clockOrNull(d?.windowStartClock, "شروع پنجره‌ی حضور");
      return { dayNo, dayType, breakMinutes: 0, leaveMinutes: null, windowStartMinute: c === null ? NaN : resolveWindowStart(c, null), segments: [] };
    }
    const segInput: SegmentInput[] = Array.isArray(d?.segments) ? d.segments : [];
    if (segInput.length === 0) throw new AttendanceError(`${label}: روز کاری دست‌کم یک بازه‌ی کاری لازم دارد`);
    if (segInput.length > MAX_SEGMENTS) throw new AttendanceError(`${label}: حداکثر ${MAX_SEGMENTS} بازه`);
    const resolved = resolveSegments(segInput, label);
    const segments: SegmentData[] = resolved.map((r, i) => {
      const c = clockOrNull(segInput[i].windowStartClock, `شروع پنجره‌ی بازه ${i + 1}`);
      return { ...r, windowStartMinute: c === null ? NaN : resolveWindowStart(c, r.startMinute) };
    });
    const total = totalMinutesOf(segments);
    const breakMinutes = d?.breakMinutes === undefined || d?.breakMinutes === null || d?.breakMinutes === "" ? 0 : int(d.breakMinutes, `${label}: استراحت`, 0, DAY);
    if (breakMinutes >= total) throw new AttendanceError(`${label}: استراحت (${minuteText(breakMinutes)}) باید کمتر از مجموع بازه‌ها (${minuteText(total)}) باشد`);
    const leaveMinutes = d?.leaveMinutes === undefined || d?.leaveMinutes === null || d?.leaveMinutes === "" ? null : int(d.leaveMinutes, `${label}: ساعت مرخصی`, 0, DAY);
    return { dayNo, dayType, breakMinutes, leaveMinutes, windowStartMinute: 0, segments };
  });
  for (let n = 1; n <= cycleLength; n++) if (!seen.has(n)) throw new AttendanceError(`روز ${n} تعریف نشده است`);
  if (!days.some((d) => d.dayType === "WORK")) throw new AttendanceError("دست‌کم یک روز کاری لازم است");
  days.sort((a, c) => a.dayNo - c.dayNo);
  resolveAndValidateWindows(days);
  return { code, title, isActive: b?.isActive === undefined ? true : !!b.isActive, cycleType, cycleLength, description: typeof b?.description === "string" && b.description.trim() ? b.description.trim() : null, days };
}

const dayCreate = (days: DayInput[]) =>
  days.map((d) => ({
    dayNo: d.dayNo,
    dayType: d.dayType,
    breakMinutes: d.breakMinutes,
    leaveMinutes: d.leaveMinutes,
    windowStartMinute: d.windowStartMinute,
    segments: { create: d.segments.map((s, i) => ({ seq: i + 1, startMinute: s.startMinute, endMinute: s.endMinute, windowStartMinute: s.windowStartMinute })) },
  }));

export async function createShift(d: ShiftData): Promise<{ id: number }> {
  for (let attempt = 0; ; attempt++) {
    try {
      const code = d.code ?? ((await prisma.attendanceShift.findFirst({ orderBy: { code: "desc" }, select: { code: true } }))?.code ?? 0) + 1;
      const s = await prisma.attendanceShift.create({ data: { code, title: d.title, isActive: d.isActive, cycleType: d.cycleType, cycleLength: d.cycleLength, description: d.description, days: { create: dayCreate(d.days) } } });
      return { id: s.id };
    } catch (e: any) {
      if (e?.code === "P2002" && attempt < 3 && d.code === null) continue;
      throw e;
    }
  }
}

export async function updateShift(id: number, d: ShiftData): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.attendanceShiftDay.deleteMany({ where: { shiftId: id } });
    await tx.attendanceShift.update({ where: { id }, data: { ...(d.code !== null ? { code: d.code } : {}), title: d.title, isActive: d.isActive, cycleType: d.cycleType, cycleLength: d.cycleLength, description: d.description, days: { create: dayCreate(d.days) } } });
  });
}

/** شیفتِ منتسب‌شده به کارمند ویرایش/حذف نمی‌شود (پنجره‌ها و روزهای کاریِ گذشته‌ی او را عوض می‌کند)؛ برای تغییر، شیفت تازه بسازید و انتساب جدید ثبت کنید */
export async function shiftUsageMessage(id: number): Promise<string | null> {
  const rows = await prisma.attendanceShiftAssignment.findMany({ where: { shiftId: id }, take: 5, orderBy: { id: "asc" }, select: { employee: { select: { personnelCode: true } } } });
  if (rows.length === 0) return null;
  const total = await prisma.attendanceShiftAssignment.count({ where: { shiftId: id } });
  return `این شیفت به ${total} انتساب (کارمند ${rows.map((r) => r.employee.personnelCode).join("، ")}${total > rows.length ? " و …" : ""}) وصل است و تغییر نمی‌کند؛ برای تغییر، شیفت تازه بسازید و انتساب جدید ثبت کنید`;
}

export interface TimelineRow {
  dayIdx: number;
  dayNo: number;
  /** شماره‌ی ردیف همان روز (۱ = اولین بازه؛ روز استراحت = null) */
  seq: number | null;
  segStart: number | null;
  segEnd: number | null;
  /** شروع/پایان پنجره نسبت به ابتدای همین روز شیفت (می‌تواند منفی یا بیش از ۱۴۴۰ باشد) */
  wsRel: number;
  weRel: number;
}

/** خط زمانی ردیف‌های یک شیفتِ ذخیره‌شده با پنجره‌ی هر ردیف (پایان = شروع ردیف بعدی؛ ردیف آخر به اول چرخه‌ی بعد) */
export function shiftTimeline(s: any): TimelineRow[] {
  const sorted = [...(s.days ?? [])].sort((a: any, b: any) => a.dayNo - b.dayNo);
  const flat: { dayIdx: number; dayNo: number; seq: number | null; segStart: number | null; segEnd: number | null; base: number; ws: number }[] = [];
  sorted.forEach((d: any, i: number) => {
    const segs = [...(d.segments ?? [])].sort((a: any, b: any) => a.seq - b.seq);
    if (d.dayType !== "WORK" || segs.length === 0) flat.push({ dayIdx: i, dayNo: d.dayNo, seq: null, segStart: null, segEnd: null, base: i * DAY, ws: i * DAY + d.windowStartMinute });
    else segs.forEach((x: any) => flat.push({ dayIdx: i, dayNo: d.dayNo, seq: x.seq, segStart: x.startMinute, segEnd: x.endMinute, base: i * DAY, ws: i * DAY + x.windowStartMinute }));
  });
  const N = sorted.length * DAY;
  return flat.map((f, k) => {
    const wrap = k + 1 === flat.length;
    return { dayIdx: f.dayIdx, dayNo: f.dayNo, seq: f.seq, segStart: f.segStart, segEnd: f.segEnd, wsRel: f.ws - f.base, weRel: flat[(k + 1) % flat.length].ws + (wrap ? N : 0) - f.base };
  });
}

/** دقیقه‌ی نسبی (نسبت به ابتدای یک روز) → ساعت روی ساعت + جابه‌جایی روز (−۱ = روز قبل، ۰ = همان روز، ۱ = روز بعد) */
const rel = (m: number) => ({ clock: mod(m, DAY), dayOffset: Math.floor(m / DAY) });

export function shiftShape(s: any) {
  const sorted = [...(s.days ?? [])].sort((a: any, b: any) => a.dayNo - b.dayNo);
  const timeline = shiftTimeline(s);
  const endOf = (dayIdx: number, seq: number | null) => timeline.find((t) => t.dayIdx === dayIdx && t.seq === seq)!.weRel;
  const days = sorted.map((d: any, idx: number) => {
    const segs = [...(d.segments ?? [])].sort((a: any, b: any) => a.seq - b.seq);
    const total = totalMinutesOf(segs);
    const work = Math.max(0, total - d.breakMinutes);
    const restRow = d.dayType !== "WORK" || segs.length === 0;
    const restWin = restRow ? { start: rel(d.windowStartMinute), end: rel(endOf(idx, null)) } : null;
    return {
      dayNo: d.dayNo,
      dayType: d.dayType as AttDayType,
      dayTypeTitle: DAY_TYPE_FA[d.dayType as AttDayType],
      isWorkDay: d.dayType === "WORK",
      breakMinutes: d.breakMinutes,
      leaveMinutes: d.leaveMinutes,
      totalMinutes: total,
      workMinutes: work,
      leaveMinutesEffective: d.dayType === "WORK" ? d.leaveMinutes ?? work : 0,
      /** فقط روز استراحت: پنجره‌ی همان روز */
      windowStartClock: restWin ? restWin.start.clock : null,
      windowStartDayOffset: restWin ? restWin.start.dayOffset : null,
      windowEndClock: restWin ? restWin.end.clock : null,
      windowEndDayOffset: restWin ? restWin.end.dayOffset : null,
      segments: segs.map((x: any) => {
        const ws = rel(x.windowStartMinute);
        const we = rel(endOf(idx, x.seq));
        return {
          startClock: x.startMinute % DAY,
          endClock: x.endMinute % DAY,
          endsNextDay: x.endMinute >= DAY,
          startMinute: x.startMinute,
          endMinute: x.endMinute,
          windowStartClock: ws.clock,
          windowStartDayOffset: ws.dayOffset,
          windowEndClock: we.clock,
          windowEndDayOffset: we.dayOffset,
        };
      }),
    };
  });
  return {
    id: s.id,
    code: s.code,
    title: s.title,
    isActive: s.isActive,
    cycleType: s.cycleType,
    cycleLength: s.cycleLength,
    description: s.description ?? "",
    workDayCount: days.filter((d: any) => d.isWorkDay).length,
    totalWorkMinutes: days.reduce((a: number, d: any) => a + d.workMinutes, 0),
    days,
    updatedAt: s.updatedAt,
  };
}
