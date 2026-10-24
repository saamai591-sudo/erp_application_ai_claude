import { prisma } from "../lib/prisma";
import { AttendanceError, minuteText } from "./attendancePunchService";

// مدیریت تردد › شیفت: تنها نویسنده‌ی AttendanceShift/Day/Segment. شیفت = الگوی تناوبی روزها (هفتگی ۷روزه هم‌تراز هفته، یا چرخشی N روزه).
// هر روز: کاری/غیرکاری؛ دست‌کم یک بازه‌ی کاری (شروع/پایان، پایان می‌تواند روز بعد باشد)؛ «استراحت» (مثلاً ناهار) که جزو ساعت کاری نیست؛ و
// «ساعت مرخصی» = مقداری که اگر فرد آن روز را مرخصی بگیرد از مانده‌ی مرخصی‌اش کم می‌شود (خالی = ساعت کاری خالص = مجموع بازه‌ها − استراحت؛
// مثلاً شیفت ۹ ساعته با ۳۰ دقیقه ناهار ⇒ ۸:۳۰). انتساب شیفت به افراد (با نقطه‌ی شروع چرخه‌ی چرخشی) در فرم جداگانه‌ی بعدی است.
// «پنجره‌ی حضور» هر روز: ترددِ هر روزِ تقویمی با پنجره‌ی ردیف شیفت همان روز به «روز کاری» نسبت داده می‌شود (کارکرد روزانه، فاز بعد). برای هر روز فقط «شروع پنجره» ذخیره می‌شود و پایانش
// خودکار «شروع پنجره‌ی روز بعد در چرخه + ۲۴ ساعت» است (روز آخر چرخه به روز اول وصل می‌شود)؛ پس پنجره‌ها هم‌پوشانی و فاصله ندارند و ترددی بی‌صاحب نمی‌ماند.
// پنجره‌ی هر روز باید همه‌ی بازه‌های کاری همان روز را بپوشاند. شروع خالی = پیش‌فرض (روز کاری: ۴ ساعت قبل از شروع اولین بازه، حداقل ۰۰:۰۰؛ روز استراحت: ۰۴:۰۰).
// استثنا: ترددِ مبهم/خارج از پنجره را کاربر با فیلد «روز کاری» روی تردد دستی به یک روز اختصاص می‌دهد (AttendancePunch.workDate).
// زمان‌ها در پایگاه داده «دقیقه از ابتدای روز شیفت» است و پایان می‌تواند بیش از ۱۴۴۰ باشد؛ ورودی/خروجی فرم «ساعت روی ساعت» (۰ تا ۱۴۳۹) است
// و بازه‌ی عبور از نیمه‌شب را همین سرویس محاسبه می‌کند (تنها نقطه‌ی این قاعده).

const DAY = 1440;
const WEEKLY_LEN = 7;
const MAX_ROTATION = 62;

export interface SegmentInput {
  startClock: number;
  endClock: number;
}
export interface DayInput {
  dayNo: number;
  isWorkDay: boolean;
  breakMinutes: number;
  leaveMinutes: number | null;
  /** شروع پنجره‌ی حضور (دقیقه‌ی روز، ۰..۱۴۳۹) */
  windowStartMinute: number;
  segments: { startMinute: number; endMinute: number }[];
}

export const DEFAULT_WINDOW_LEAD = 240;
/** نشانه‌ی «شروع پنجره خالی» تا دور دوم (پیش‌فرض‌ها) */
const AUTO_WINDOW = -1;
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

/** بازه‌های «ساعت روی ساعت» یک روز → دقیقه‌های مطلق (پایان کوچک‌تر/مساوی شروع ⇒ روز بعد؛ هر بازه‌ی بعدی بعد از پایان قبلی) */
export function resolveSegments(raw: SegmentInput[], label: string): { startMinute: number; endMinute: number }[] {
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
  const days: DayInput[] = rawDays.map((d, i) => {
    const dayNo = int(d?.dayNo, "شماره‌ی روز", 1, cycleLength);
    if (seen.has(dayNo)) throw new AttendanceError(`روز ${dayNo} تکراری است`);
    seen.add(dayNo);
    const label = `روز ${dayNo}`;
    const isWorkDay = !!d?.isWorkDay;
    const wRaw = d?.windowStartClock;
    const explicitWindow = wRaw === undefined || wRaw === null || wRaw === "" ? null : int(wRaw, `${label}: شروع پنجره‌ی حضور`, 0, DAY - 1);
    if (!isWorkDay) return { dayNo, isWorkDay: false, breakMinutes: 0, leaveMinutes: null, windowStartMinute: explicitWindow ?? AUTO_WINDOW, segments: [] };
    const segInput: SegmentInput[] = Array.isArray(d?.segments) ? d.segments : [];
    if (segInput.length === 0) throw new AttendanceError(`${label}: روز کاری دست‌کم یک بازه‌ی کاری لازم دارد`);
    if (segInput.length > 6) throw new AttendanceError(`${label}: حداکثر ۶ بازه`);
    const segments = resolveSegments(segInput, label);
    const total = totalMinutesOf(segments);
    const breakMinutes = d?.breakMinutes === undefined || d?.breakMinutes === null || d?.breakMinutes === "" ? 0 : int(d.breakMinutes, `${label}: استراحت`, 0, DAY);
    if (breakMinutes >= total) throw new AttendanceError(`${label}: استراحت (${minuteText(breakMinutes)}) باید کمتر از مجموع بازه‌ها (${minuteText(total)}) باشد`);
    const leaveMinutes = d?.leaveMinutes === undefined || d?.leaveMinutes === null || d?.leaveMinutes === "" ? null : int(d.leaveMinutes, `${label}: ساعت مرخصی`, 0, DAY);
    void i;
    return { dayNo, isWorkDay: true, breakMinutes, leaveMinutes, windowStartMinute: explicitWindow ?? AUTO_WINDOW, segments };
  });
  for (let n = 1; n <= cycleLength; n++) if (!seen.has(n)) throw new AttendanceError(`روز ${n} تعریف نشده است`);
  if (!days.some((d) => d.isWorkDay)) throw new AttendanceError("دست‌کم یک روز کاری لازم است");
  days.sort((a, c) => a.dayNo - c.dayNo);
  resolveDefaultWindows(days);
  assertWindowsCover(days);
  return { code, title, isActive: b?.isActive === undefined ? true : !!b.isActive, cycleType, cycleLength, description: typeof b?.description === "string" && b.description.trim() ? b.description.trim() : null, days: days.sort((a, c) => a.dayNo - c.dayNo) };
}

/**
 * شروع خالیِ پنجره ⇒ پیش‌فرض: روز کاری ۴ ساعت قبل از شروع اولین بازه (حداقل ۰۰:۰۰)، روز استراحت ۰۴:۰۰؛ و اگر بازه‌ی روز قبل در چرخه از نیمه‌شب گذشته (شیفت شب)،
 * دیرتر از پایان آن بازه شروع نشود (پنجره‌ی ردیف بعد نباید پایان شیفت شب را ببُرد).
 */
function resolveDefaultWindows(days: DayInput[]) {
  days.forEach((d, i) => {
    if (d.windowStartMinute !== AUTO_WINDOW) return;
    const base = d.isWorkDay && d.segments.length ? Math.max(0, d.segments[0].startMinute - DEFAULT_WINDOW_LEAD) : DEFAULT_WINDOW_LEAD;
    const prev = days[(i - 1 + days.length) % days.length];
    const prevEnd = prev.isWorkDay && prev.segments.length ? prev.segments[prev.segments.length - 1].endMinute : 0;
    const spill = prevEnd > DAY ? prevEnd - DAY : 0;
    d.windowStartMinute = Math.min(DAY - 1, Math.max(base, spill));
  });
}

/** پنجره‌ی هر روز = [شروع همان روز، ۲۴ساعت + شروع روز بعد در چرخه)؛ باید همه‌ی بازه‌های کاری آن روز را بپوشاند */
export function assertWindowsCover(days: DayInput[]) {
  days.forEach((d, i) => {
    if (!d.isWorkDay || d.segments.length === 0) return;
    const next = days[(i + 1) % days.length];
    const end = DAY + next.windowStartMinute;
    const firstStart = d.segments[0].startMinute;
    const lastEnd = d.segments[d.segments.length - 1].endMinute;
    if (d.windowStartMinute > firstStart) throw new AttendanceError(`روز ${d.dayNo}: شروع پنجره‌ی حضور (${minuteText(d.windowStartMinute)}) باید قبل از شروع بازه‌ی کاری (${minuteText(firstStart % DAY)}) باشد`);
    if (end < lastEnd) throw new AttendanceError(`روز ${d.dayNo}: پنجره‌ی حضور باید تا پایان بازه‌ی کاری (${minuteText(lastEnd % DAY)}${lastEnd >= DAY ? " روز بعد" : ""}) ادامه داشته باشد؛ شروع پنجره‌ی روز ${next.dayNo} (${minuteText(next.windowStartMinute)}) را دیرتر بگذارید`);
  });
}

const dayCreate = (days: DayInput[]) =>
  days.map((d) => ({
    dayNo: d.dayNo,
    isWorkDay: d.isWorkDay,
    breakMinutes: d.breakMinutes,
    leaveMinutes: d.leaveMinutes,
    windowStartMinute: d.windowStartMinute,
    segments: { create: d.segments.map((s, i) => ({ seq: i + 1, startMinute: s.startMinute, endMinute: s.endMinute })) },
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

/** «موارد استفاده» ی شیفت؛ انتساب‌ها در فرم بعدی اضافه می‌شود */
export async function shiftUsageMessage(_id: number): Promise<string | null> {
  return null;
}

export function shiftShape(s: any) {
  const sorted = [...(s.days ?? [])].sort((a: any, b: any) => a.dayNo - b.dayNo);
  const days = sorted.map((d: any, idx: number) => {
    const next = sorted[(idx + 1) % sorted.length];
    const segs = [...(d.segments ?? [])].sort((a: any, b: any) => a.seq - b.seq);
    const total = totalMinutesOf(segs);
    const work = Math.max(0, total - d.breakMinutes);
    return {
      dayNo: d.dayNo,
      isWorkDay: d.isWorkDay,
      breakMinutes: d.breakMinutes,
      leaveMinutes: d.leaveMinutes,
      totalMinutes: total,
      workMinutes: work,
      leaveMinutesEffective: d.isWorkDay ? d.leaveMinutes ?? work : 0,
      windowStartClock: d.windowStartMinute,
      /** پایان پنجره: دقیقه‌ی مطلق از ابتدای این روز (بیش از ۱۴۴۰ = روز بعد) */
      windowEndMinute: DAY + next.windowStartMinute,
      segments: segs.map((x: any) => ({ startClock: x.startMinute % DAY, endClock: x.endMinute % DAY, endsNextDay: x.endMinute >= DAY, startMinute: x.startMinute, endMinute: x.endMinute })),
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
