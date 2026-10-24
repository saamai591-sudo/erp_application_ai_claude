import { prisma } from "../lib/prisma";
import { AttendanceError, dayStr, minuteText, parseDay } from "./attendancePunchService";
import type { TimelineRow } from "./attendanceShiftService";
import { DAY_TYPE_FA, type AttDayType } from "./attendanceFormulaDefs";

// مدیریت تردد › عملیات › «استثنای روز» (مثلاً چهارشنبه‌سوری: پایان شیفت ساعت ۱۵ / بارندگی: شروع ساعت ۱۰ / اعلام تعطیلی): برای فقط «یک تاریخ» و دامنه‌ی «همه‌ی شیفت‌ها»
// یا «شیفت‌های انتخابی»، یکی از پنج اثر: تغییر شروع / تغییر پایان / تغییر شروع و پایان (ساعتِ شروعِ اولین و پایانِ آخرین بازه‌ی کاری) یا اعلام تعطیلی شیفت / تعطیلی رسمی. شیفت دست نمی‌خورد؛
// اثر فقط هنگام ساختن برنامه‌ی هر روز (کارکرد روزانه و انتخابگر پنجره) روی ردیف‌های همان روز اعمال می‌شود (applyToDay = تنها نقطه‌ی اعمال). پنجره‌ی حضور عوض نمی‌شود:
// ساعت جدید باید داخل همان پنجره بماند، وگرنه استثنا برای آن کارمند/روز اعمال نمی‌شود و علتش کنار «ردیف شیفت» می‌آید. استراحت می‌ماند و «ساعت مرخصی» اگر دستی تعیین
// نشده باشد از طول جدید حساب می‌شود. اگر یک روز هم استثنای «همه‌ی شیفت‌ها» و هم استثنای «همان شیفت» داشته باشد، خاص‌تر (شیفت) مقدم است.

const DAY = 1440;
const DAY_MS = 86400000;
const MAX_RANGE_DAYS = 366;
const dayNum = (d: Date) => Math.floor(d.getTime() / DAY_MS);

export interface DayExc {
  id: number;
  title: string;
  day: number;
  allShifts: boolean;
  shiftIds: Set<number>;
  newStartMinute: number | null;
  newEndMinute: number | null;
  dayType: AttDayType | null;
}

export async function loadExceptions(fromDay: number, toDay: number): Promise<DayExc[]> {
  const rows = await prisma.attendanceDayException.findMany({
    where: { date: { gte: new Date(fromDay * DAY_MS), lte: new Date(toDay * DAY_MS) } },
    include: { shifts: { select: { shiftId: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    day: dayNum(r.date),
    allShifts: r.allShifts,
    shiftIds: new Set(r.shifts.map((s) => s.shiftId)),
    newStartMinute: r.newStartMinute,
    newEndMinute: r.newEndMinute,
    dayType: r.effect === "SHIFT_OFF" ? "SHIFT_OFF" : r.effect === "OFFICIAL_HOLIDAY" ? "OFFICIAL_HOLIDAY" : null,
  }));
}

/** استثنای مؤثر برای یک روز و یک شیفت: استثنای مخصوص همان شیفت بر «همه‌ی شیفت‌ها» مقدم است */
export function pickException(excs: DayExc[], day: number, shiftId: number): DayExc | undefined {
  const hit = excs.filter((e) => e.day === day);
  return hit.find((e) => !e.allShifts && e.shiftIds.has(shiftId)) ?? hit.find((e) => e.allShifts);
}

export interface Applied {
  rows: TimelineRow[];
  /** نوع روز بعد از اعمال (فقط وقتی استثنا نوع روز را عوض کرده) */
  dayType?: AttDayType;
  note: string;
  skipped?: string;
}

/**
 * اعمال یک استثنا روی ردیف‌های یک روز از خط زمانی شیفت (dayRows: ردیف‌های همان روز به ترتیب). خروجی ردیف‌های جدید، یا skipped با علت.
 * ساعت‌ها نسبت به ابتدای همان روز شیفت‌اند؛ پایانِ ≤ شروع یعنی روز بعد (مثل تعریف شیفت).
 */
export function applyToDay(dayRows: TimelineRow[], ex: DayExc): Applied {
  const note = `اصلاح‌شده: ${ex.title}`;
  if (dayRows.length === 0) return { rows: dayRows, note, skipped: "روزی برای اصلاح نیست" };
  if (ex.dayType) {
    if (dayRows.every((r) => r.seq === null)) return { rows: dayRows, dayType: ex.dayType, note };
    const first = dayRows[0], last = dayRows[dayRows.length - 1];
    return { rows: [{ dayIdx: first.dayIdx, dayNo: first.dayNo, seq: null, segStart: null, segEnd: null, wsRel: first.wsRel, weRel: last.weRel }], dayType: ex.dayType, note };
  }
  const work = dayRows.filter((r) => r.seq !== null);
  if (work.length === 0) return { rows: dayRows, note, skipped: "آن روز در شیفت کاری نیست" };
  const rows = dayRows.map((r) => ({ ...r }));
  const firstW = rows.find((r) => r.seq !== null)!;
  const lastW = [...rows].reverse().find((r) => r.seq !== null)!;
  if (ex.newStartMinute !== null) {
    const s = ex.newStartMinute;
    if (s < firstW.wsRel || s >= (firstW.segEnd as number)) return { rows: dayRows, note, skipped: `شروع ${minuteText(s)} بیرون از پنجره‌ی حضور یا بعد از پایان بازه است` };
    firstW.segStart = s;
  }
  if (ex.newEndMinute !== null) {
    let e = ex.newEndMinute;
    const st = lastW.segStart as number;
    if (e <= st) e += DAY;
    if (e > lastW.weRel) return { rows: dayRows, note, skipped: `پایان ${minuteText(ex.newEndMinute)} بیرون از پنجره‌ی حضور است` };
    if (e - st >= DAY) return { rows: dayRows, note, skipped: "طول بازه‌ی کاری باید کمتر از ۲۴ ساعت باشد" };
    lastW.segEnd = e;
  }
  return { rows, note };
}

// ───────────────────────── CRUD ─────────────────────────

export const EFFECT_FA: Record<string, string> = { START: "تغییر ساعت شروع", END: "تغییر ساعت پایان", START_END: "تغییر ساعت شروع/پایان", SHIFT_OFF: "اعلام تعطیلی شیفت", OFFICIAL_HOLIDAY: "اعلام تعطیلی رسمی" };

export function effectText(e: { effect: string; newStartMinute: number | null; newEndMinute: number | null }): string {
  if (e.effect === "SHIFT_OFF" || e.effect === "OFFICIAL_HOLIDAY") return EFFECT_FA[e.effect];
  const parts: string[] = [];
  if (e.newStartMinute !== null) parts.push(`شروع ${minuteText(e.newStartMinute)}`);
  if (e.newEndMinute !== null) parts.push(`پایان ${minuteText(e.newEndMinute)}`);
  return parts.join(" و ");
}

export function exceptionShape(r: any) {
  return {
    id: r.id,
    title: r.title,
    date: dayStr(r.date),
    allShifts: r.allShifts,
    shiftIds: (r.shifts ?? []).map((s: any) => s.shiftId),
    shiftTitles: (r.shifts ?? []).map((s: any) => s.shift?.title).filter(Boolean),
    newStartMinute: r.newStartMinute,
    newEndMinute: r.newEndMinute,
    effect: r.effect,
    effectText: effectText(r),
    description: r.description ?? "",
    updatedAt: r.updatedAt,
  };
}

function cleanMinute(v: unknown, label: string): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n >= DAY) throw new AttendanceError(`${label} نامعتبر است`);
  return n;
}

export async function saveException(body: any, userId: number | null, id?: number) {
  const title = String(body?.title ?? "").trim().replace(/\s+/g, " ");
  if (!title) throw new AttendanceError("عنوان استثنا الزامی است");
  const date = parseDay(body?.date, "تاریخ");
  const allShifts = body?.allShifts === true;
  const shiftIds: number[] = allShifts ? [] : [...new Set<number>((Array.isArray(body?.shiftIds) ? body.shiftIds : []).map(Number).filter((n: number) => Number.isInteger(n) && n > 0))];
  if (!allShifts && shiftIds.length === 0) throw new AttendanceError("«همه‌ی شیفت‌ها» را بزنید یا دست‌کم یک شیفت انتخاب کنید");
  if (shiftIds.length) {
    const found = await prisma.attendanceShift.count({ where: { id: { in: shiftIds } } });
    if (found !== shiftIds.length) throw new AttendanceError("شیفت انتخاب‌شده یافت نشد");
  }
  const effect = String(body?.effect ?? "");
  if (!EFFECT_FA[effect]) throw new AttendanceError("اثر استثنا را انتخاب کنید");
  const isHoliday = effect === "SHIFT_OFF" || effect === "OFFICIAL_HOLIDAY";
  const needStart = effect === "START" || effect === "START_END";
  const needEnd = effect === "END" || effect === "START_END";
  let newStartMinute = cleanMinute(body?.newStartMinute, "ساعت شروع جدید");
  let newEndMinute = cleanMinute(body?.newEndMinute, "ساعت پایان جدید");
  if (needStart && newStartMinute === null) throw new AttendanceError("ساعت شروع جدید را وارد کنید");
  if (needEnd && newEndMinute === null) throw new AttendanceError("ساعت پایان جدید را وارد کنید");
  // ساعتِ اضافه‌ی نامربوط به اثر انتخابی نادیده گرفته می‌شود
  if (!needStart) newStartMinute = null;
  if (!needEnd) newEndMinute = null;
  void isHoliday;
  // هم‌پوشانیِ هم‌سطح: دو استثنای «همه‌ی شیفت‌ها» یا دو استثنا با شیفتِ مشترک روی یک روز
  const others = await prisma.attendanceDayException.findMany({
    where: { date, ...(id ? { id: { not: id } } : {}) },
    include: { shifts: { select: { shiftId: true } } },
  });
  for (const o of others) {
    if ((allShifts && o.allShifts) || o.shifts.some((s) => shiftIds.includes(s.shiftId))) throw new AttendanceError(`با استثنای «${o.title}» روی همان تاریخ و همان شیفت هم‌پوشانی دارد`);
  }
  const data = { title, date, allShifts, effect: effect as any, newStartMinute, newEndMinute, description: String(body?.description ?? "").trim() || null };
  if (!id) return prisma.attendanceDayException.create({ data: { ...data, createdById: userId, shifts: { create: shiftIds.map((shiftId) => ({ shiftId })) } }, include: { shifts: { include: { shift: { select: { title: true } } } } } });
  if (!(await prisma.attendanceDayException.findUnique({ where: { id } }))) throw new AttendanceError("استثنا یافت نشد");
  return prisma.$transaction(async (tx) => {
    await tx.attendanceDayExceptionShift.deleteMany({ where: { exceptionId: id } });
    return tx.attendanceDayException.update({ where: { id }, data: { ...data, shifts: { create: shiftIds.map((shiftId) => ({ shiftId })) } }, include: { shifts: { include: { shift: { select: { title: true } } } } } });
  });
}
