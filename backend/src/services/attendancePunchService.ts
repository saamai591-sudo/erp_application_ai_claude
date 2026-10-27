import { prisma } from "../lib/prisma";
import { displayDate } from "../utils/dateDisplay";
import { getPeriods, periodContains } from "./employmentStatusService";

// مدیریت تردد › تردد خام: تنها نویسنده‌ی AttendancePunch و AttendanceCorrectionRequest/Line (فرم‌های «ورود و خروج» و «درخواست اصلاح تردد»).
//  • تردد = کارمند + روز + دقیقه از ۰۰:۰۰ (وقت تهران) + منبع (MANUAL/IMPORT/DEVICE/CORRECTION). جهت ورود/خروج ذخیره نمی‌شود (جفت‌سازی بعداً در کارکرد روزانه). برای هر کارمند در هر روز و دقیقه فقط یک تردد.
//  • ترددِ ساخته‌شده با تایید درخواست اصلاح (منبع CORRECTION) مستقیماً ویرایش/حذف نمی‌شود؛ فقط با «برگشت از تایید» همان درخواست حذف می‌شود.
//  • روزِ تردد باید داخل یکی از دوره‌های همکاری کارمند باشد (ورود قبل از شروع یا بعد از خاتمه همکاری رد می‌شود).
//  • قفل «محاسبات تردد»: وقتی برای کارمند در ماهی «محاسبه» زده شده (AttendanceCalculation)، همه‌ی اطلاعات تردد آن کارمند در بازه‌ی تردد همان ماه قفل است. تنها نقطه‌ی کنترل
//    همین چند تابع است (assertDayOpen / assertDaysOpen / assertFromDateOpen / assertDateOpenForAll) و همه‌ی نویسنده‌ها (تردد، درخواست‌ها، انتساب شیفت، استثنای روز، مجوز) فقط آن‌ها را صدا می‌زنند.

export class AttendanceError extends Error {}

export const SOURCE_FA: Record<string, string> = { MANUAL: "ورود دستی", IMPORT: "ورود از فایل", DEVICE: "دستگاه", CORRECTION: "درخواست اصلاح" };

export const dayStr = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

export function parseDay(v: unknown, label = "تاریخ"): Date {
  if (!v || typeof v !== "string") throw new AttendanceError(`${label} الزامی است`);
  const d = new Date(`${v.slice(0, 10)}T00:00:00.000Z`);
  if (isNaN(d.getTime())) throw new AttendanceError(`${label} نامعتبر است`);
  return d;
}

/** دقیقه‌ی روز (۰ تا ۱۴۳۹) */
export function parseMinute(v: unknown, label = "ساعت"): number {
  const n = Number(v);
  if (v === null || v === undefined || v === "" || !Number.isInteger(n) || n < 0 || n > 1439) throw new AttendanceError(`${label} نامعتبر است`);
  return n;
}

export const minuteText = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export const personName = (p: { firstName: string | null; lastName: string | null; name: string | null }) => [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "";

export const EMPLOYEE_SELECT = { id: true, personnelCode: true, party: { select: { firstName: true, lastName: true, name: true } } } as const;

/** روز باید داخل یک دوره‌ی همکاری کارمند باشد */
export async function assertEmployeeWorking(employeeId: number, date: Date) {
  const emp = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } });
  if (!emp) throw new AttendanceError("کارمند یافت نشد");
  if (!periodContains(await getPeriods(employeeId), date)) throw new AttendanceError(`کارمند در تاریخ ${displayDate(date)} در دوره‌ی همکاری نیست`);
}

const MONTHS_FA = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
const calcLabel = (c: { calendarMonth: { year: number; month: number } }) => `${MONTHS_FA[c.calendarMonth.month - 1] ?? c.calendarMonth.month} ${c.calendarMonth.year}`;
const LOCK_HINT = "برای تغییر، ابتدا «حذف محاسبه»ی آن ماه را در «محاسبه تردد» بزنید";

/** قفل محاسبات تردد برای بازه‌ی روزهای یک کارمند: اگر بازه با بازه‌ی تردد ماهِ محاسبه‌شده‌ی او هم‌پوشان باشد رد می‌شود */
export async function assertDaysOpen(employeeId: number, from: Date, to: Date = from) {
  const lo = from <= to ? from : to, hi = from <= to ? to : from;
  const c = await prisma.attendanceCalculation.findFirst({
    where: { employeeId, calendarMonth: { trafficStartDate: { lte: hi }, trafficEndDate: { gte: lo } } },
    select: { calendarMonth: { select: { year: true, month: true } } },
  });
  if (c) throw new AttendanceError(`محاسبات تردد «${calcLabel(c)}» برای این کارمند انجام شده و ${lo.getTime() === hi.getTime() ? `روز ${displayDate(lo)}` : `بازه‌ی ${displayDate(lo)} تا ${displayDate(hi)}`} قفل است؛ ${LOCK_HINT}`);
}

export const assertDayOpen = (employeeId: number, date: Date) => assertDaysOpen(employeeId, date, date);

/** تغییری که روزِ «از تاریخ» و همه‌ی روزهای بعدش را عوض می‌کند (مثل انتساب شیفت): ماه محاسبه‌شده‌ای که پایانش ≥ آن تاریخ است قفل می‌کند */
export async function assertFromDateOpen(employeeId: number, from: Date) {
  const c = await prisma.attendanceCalculation.findFirst({
    where: { employeeId, calendarMonth: { trafficEndDate: { gte: from } } },
    select: { calendarMonth: { select: { year: true, month: true } } },
  });
  if (c) throw new AttendanceError(`محاسبات تردد «${calcLabel(c)}» برای این کارمند انجام شده و روزهای بعد از ${displayDate(from)} را شامل می‌شود؛ ${LOCK_HINT}`);
}

/** تغییری که روی همه‌ی کارمندان اثر دارد (مثل استثنای روز): اگر برای هر کارمندی ماهِ شامل آن تاریخ محاسبه شده باشد رد می‌شود */
export async function assertDateOpenForAll(date: Date) {
  const c = await prisma.attendanceCalculation.findFirst({
    where: { calendarMonth: { trafficStartDate: { lte: date }, trafficEndDate: { gte: date } } },
    select: { calendarMonth: { select: { year: true, month: true } } },
  });
  if (c) throw new AttendanceError(`محاسبات تردد «${calcLabel(c)}» دست‌کم برای یک کارمند انجام شده و روز ${displayDate(date)} قفل است؛ ${LOCK_HINT}`);
}

export interface PunchInput {
  minute: number;
  description?: string | null;
}

/** ردیف‌های ورودی فرم → ترددهای معتبر؛ دقیقه‌ی تکراری در یک درخواست رد می‌شود */
export function cleanPunchRows(raw: unknown): PunchInput[] {
  const rows = Array.isArray(raw) ? raw : [];
  if (rows.length === 0) throw new AttendanceError("دست‌کم یک تردد لازم است");
  const seen = new Set<number>();
  return rows.map((r: any, i) => {
    const minute = parseMinute(r?.minute, `ساعت ردیف ${i + 1}`);
    if (seen.has(minute)) throw new AttendanceError(`ساعت ${minuteText(minute)} در چند ردیف تکرار شده است`);
    seen.add(minute);
    return { minute, description: typeof r?.description === "string" && r.description.trim() ? r.description.trim() : null };
  });
}

/** ترددهای موجودِ هم‌دقیقه (برای پیام «قبلاً ثبت شده») */
export async function assertNoDuplicatePunches(employeeId: number, date: Date, minutes: number[], excludeId?: number) {
  const dup = await prisma.attendancePunch.findMany({ where: { employeeId, date, minute: { in: minutes }, ...(excludeId ? { NOT: { id: excludeId } } : {}) }, select: { minute: true } });
  if (dup.length) throw new AttendanceError(`برای این کارمند در تاریخ ${displayDate(date)} ترددی در ساعت ${dup.map((d) => minuteText(d.minute)).join("، ")} قبلاً ثبت شده است`);
}

// ── درخواست اصلاح ──

export async function nextRequestNumber(tx: any): Promise<number> {
  const last = await tx.attendanceCorrectionRequest.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
  return (last?.number ?? 0) + 1;
}

/** تایید: ترددهای درخواستی با منبع CORRECTION ساخته می‌شوند (همه یا هیچ) */
export async function approveCorrection(id: number, userId: number | null) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(7100011, ${Number(id)})`);
    const r = await tx.attendanceCorrectionRequest.findUnique({ where: { id }, include: { lines: true } });
    if (!r) throw new AttendanceError("درخواست یافت نشد");
    if (r.status !== "PENDING") throw new AttendanceError("فقط درخواست در وضعیت «ثبت‌شده» قابل تایید است");
    await assertEmployeeWorking(r.employeeId, r.date);
    await assertDayOpen(r.employeeId, r.date);
    const dup = await tx.attendancePunch.findMany({ where: { employeeId: r.employeeId, date: r.date, minute: { in: r.lines.map((l) => l.minute) } }, select: { minute: true } });
    if (dup.length) throw new AttendanceError(`ترددی در ساعت ${dup.map((d) => minuteText(d.minute)).join("، ")} برای این روز قبلاً ثبت شده است`);
    await tx.attendancePunch.createMany({
      data: r.lines.map((l) => ({ employeeId: r.employeeId, date: r.date, minute: l.minute, source: "CORRECTION" as const, correctionRequestId: r.id, description: `درخواست اصلاح شماره ${r.number}`, createdById: userId })),
    });
    await tx.attendanceCorrectionRequest.update({ where: { id }, data: { status: "APPROVED", decidedById: userId, decidedAt: new Date() } });
  });
}

export async function rejectCorrection(id: number, userId: number | null, note: unknown) {
  const text = typeof note === "string" ? note.trim() : "";
  if (!text) throw new AttendanceError("دلیل رد الزامی است");
  const r = await prisma.attendanceCorrectionRequest.updateMany({ where: { id, status: "PENDING" }, data: { status: "REJECTED", decidedById: userId, decidedAt: new Date(), decisionNote: text } });
  if (r.count === 0) throw new AttendanceError("فقط درخواست در وضعیت «ثبت‌شده» قابل رد است");
}

/** برگشت از تایید یا رد ⇒ دوباره «ثبت‌شده»؛ ترددهای ساخته‌شده حذف می‌شوند (مگر ماه بسته باشد) */
export async function unapproveCorrection(id: number) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(7100011, ${Number(id)})`);
    const r = await tx.attendanceCorrectionRequest.findUnique({ where: { id }, select: { status: true, employeeId: true, date: true } });
    if (!r) throw new AttendanceError("درخواست یافت نشد");
    if (r.status === "PENDING") throw new AttendanceError("درخواست در وضعیت «ثبت‌شده» است");
    if (r.status === "APPROVED") await assertDayOpen(r.employeeId, r.date);
    await tx.attendancePunch.deleteMany({ where: { correctionRequestId: id } });
    await tx.attendanceCorrectionRequest.update({ where: { id }, data: { status: "PENDING", decidedById: null, decidedAt: null, decisionNote: null } });
  });
}
