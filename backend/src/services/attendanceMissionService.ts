import { prisma } from "../lib/prisma";
import { displayDate } from "../utils/dateDisplay";
import { AttendanceError, EMPLOYEE_SELECT, assertDayOpen, dayStr, minuteText, parseDay, personName } from "./attendancePunchService";
import { getPeriods, periodContains } from "./employmentStatusService";
import { assertNoRequestConflict, assertShiftAssigned } from "./attendanceLeaveService";
import { lastCalculatedYm } from "./payrollLoanService";

// مدیریت تردد › درخواست ماموریت — تنها محل قواعد. هم‌الگوی درخواست مرخصی (روزانه یا ساعتی؛ ثبت‌شده ← تایید / رد ← برگشت) ولی:
// • کنترل‌ها: دوره‌ی همکاری، «شیفت تخصیص‌یافته تا تاریخ شروع» و عدم هم‌پوشانی با مرخصی/ماموریت دیگر (assertNoRequestConflict دوطرفه). با تردد ثبت‌شده تضاد ندارد
//   (کارمند ممکن است پیش از رفتن تردد زده باشد) و ماموریتِ ساعتی لازم نیست داخل بازه‌ی کاری باشد.
// • پوشش روزانه (فقط تاییدشده): غیبت برداشته می‌شود (متغیر MISSION_MINUTES، services/attendanceMissionCalc.ts).
// • «پایان ماموریت» (فقط روزانه‌ی تاییدشده): تا قبل از آن «تا تاریخ» قابل ویرایش است؛ بعد از آن تاریخ پایان قطعی است و کل بازه در ماهِ پایان به تفکیک نوع احتساب می‌شود
//   (گزارش ماموریت بازه‌هایی را به نوعِ دیگر می‌برد). کنترل: تاریخ پایانِ تازه قبل از آخرین ماهِ محاسبه‌شده‌ی حقوق کارمند نباشد و در آینده نباشد.
// • مانده و سقف ندارد؛ پیوست ندارد.

const DAY_MS = 86400000;
const DAY = 1440;
const MAX_REQUEST_DAYS = 366;
const dayNum = (d: Date) => Math.floor(d.getTime() / DAY_MS);
/** امروز (تهران، UTC+3:30) به‌صورت روزِ UTC */
const todayDate = () => new Date(Math.floor((Date.now() + 12600000) / DAY_MS) * DAY_MS);

export const STATUS_FA = { PENDING: "ثبت‌شده", APPROVED: "تاییدشده", REJECTED: "ردشده" } as const;

const hm = (m: number) => `${Math.trunc(m / 60)}:${String(m % 60).padStart(2, "0")}`;

/** پایانِ آخرین ماهِ محاسبه‌شده‌ی حقوق هر کارمند (تقویم کاری)؛ کارمندِ بدون فیش در نتیجه نیست */
export async function lastCalculatedEnds(employeeIds: number[]): Promise<Map<number, Date>> {
  const out = new Map<number, Date>();
  const last = await lastCalculatedYm([...new Set(employeeIds)]);
  if (last.size === 0) return out;
  const pairs = [...new Set([...last.values()].map((v) => `${v.year}:${v.month}`))].map((s) => ({ year: Number(s.split(":")[0]), month: Number(s.split(":")[1]) }));
  const months = await prisma.workCalendarMonth.findMany({ where: { OR: pairs }, select: { year: true, month: true, endDate: true } });
  const endOf = new Map(months.map((m) => [`${m.year}:${m.month}`, m.endDate]));
  for (const [empId, v] of last) {
    const e = endOf.get(`${v.year}:${v.month}`);
    if (e) out.set(empId, e);
  }
  return out;
}

export async function lastCalculatedEnd(employeeId: number): Promise<Date | null> {
  return (await lastCalculatedEnds([employeeId])).get(employeeId) ?? null;
}

export function missionShape(r: any, lastCalcEnd: Date | null = null) {
  const hourly = r.startMinute !== null && r.startMinute !== undefined;
  const days = dayNum(r.toDate) - dayNum(r.fromDate) + 1;
  const minutes = hourly ? dayNum(r.toDate) * DAY + r.endMinute - (dayNum(r.fromDate) * DAY + r.startMinute) : 0;
  const ended = !!r.endedAt;
  // پایان‌یافته‌ای که ماه پایانش محاسبه‌ی حقوق شده، دیگر تغییر (برگشت پایان، گزارش) نمی‌پذیرد
  const locked = ended && !!lastCalcEnd && lastCalcEnd >= r.toDate;
  return {
    id: r.id,
    number: r.number,
    employeeId: r.employeeId,
    personnelCode: r.employee?.personnelCode ?? "",
    employeeName: r.employee ? personName(r.employee.party) : "",
    typeId: r.typeId,
    typeTitle: r.type?.title ?? "",
    fromDate: dayStr(r.fromDate),
    toDate: dayStr(r.toDate),
    plannedToDate: dayStr(r.plannedToDate),
    hourly,
    startMinute: r.startMinute,
    endMinute: r.endMinute,
    periodText: hourly ? `${minuteText(r.startMinute)} تا ${minuteText(r.endMinute)}${dayNum(r.toDate) > dayNum(r.fromDate) ? " (روز بعد)" : ""}` : "",
    /** مدت: روز تقویمی (روزانه) یا ساعت:دقیقه (ساعتی) */
    amountText: hourly ? `${hm(minutes)} ساعت` : `${days} روز`,
    destination: r.destination,
    reason: r.reason,
    status: r.status as keyof typeof STATUS_FA,
    statusTitle: STATUS_FA[r.status as keyof typeof STATUS_FA],
    decisionNote: r.decisionNote ?? "",
    ended,
    endedAt: r.endedAt ?? null,
    /** «تا تاریخ» فقط برای تاییدشده‌ی روزانه‌ی پایان‌نیافته ویرایش می‌شود */
    canEditEnd: r.status === "APPROVED" && !hourly && !ended,
    locked,
    lastCalcEnd: lastCalcEnd ? dayStr(lastCalcEnd) : null,
    reportCount: r._count?.reports ?? (r.reports ?? []).length,
    updatedAt: r.updatedAt,
  };
}

export const MISSION_INCLUDE = { employee: { select: EMPLOYEE_SELECT }, type: true, _count: { select: { reports: true } } };

export interface CleanMission {
  employeeId: number;
  typeId: number;
  fromDate: Date;
  toDate: Date;
  plannedToDate: Date;
  startMinute: number | null;
  endMinute: number | null;
  destination: string;
  reason: string;
}

async function assertCooperation(employeeId: number, fromDate: Date, toDate: Date) {
  const periods = await getPeriods(employeeId);
  for (let d = dayNum(fromDate); d <= dayNum(toDate); d++) {
    if (!periodContains(periods, new Date(d * DAY_MS))) throw new AttendanceError(`کارمند در تاریخ ${displayDate(new Date(d * DAY_MS))} در دوره‌ی همکاری نیست`);
  }
}

export async function cleanMission(b: any, excludeId?: number): Promise<CleanMission> {
  const employeeId = Number(b?.employeeId);
  if (!employeeId) throw new AttendanceError("کارمند الزامی است");
  let typeId = Number(b?.typeId);
  if (!typeId) typeId = (await prisma.attendanceMissionType.findFirst({ where: { isBase: true }, select: { id: true } }))?.id ?? 0;
  const type = typeId ? await prisma.attendanceMissionType.findUnique({ where: { id: typeId } }) : null;
  if (!type) throw new AttendanceError("نوع ماموریت را انتخاب کنید");
  if (!type.isActive) throw new AttendanceError(`نوع ماموریت «${type.title}» غیرفعال است`);
  const destination = typeof b?.destination === "string" ? b.destination.trim() : "";
  if (!destination) throw new AttendanceError("مقصد ماموریت الزامی است");
  const reason = typeof b?.reason === "string" ? b.reason.trim() : "";
  if (!reason) throw new AttendanceError("شرح ماموریت الزامی است");
  const hourly = b?.hourly === true;
  const fromDate = parseDay(b?.fromDate, "از تاریخ");
  const toDate = !b?.toDate ? fromDate : parseDay(b.toDate, "تا تاریخ");
  if (toDate < fromDate) throw new AttendanceError("تاریخ پایان قبل از تاریخ شروع است");
  let startMinute: number | null = null, endMinute: number | null = null;
  if (hourly) {
    startMinute = Number(b?.startMinute);
    endMinute = Number(b?.endMinute);
    if (!Number.isInteger(startMinute) || !Number.isInteger(endMinute) || startMinute < 0 || startMinute > 1439 || endMinute < 0 || endMinute > 1439) throw new AttendanceError("ساعت شروع و پایان ماموریت ساعتی را کامل وارد کنید");
    const len = dayNum(toDate) * DAY + endMinute - (dayNum(fromDate) * DAY + startMinute);
    if (len <= 0) throw new AttendanceError("پایان ماموریت باید بعد از شروع آن باشد");
    if (len > DAY) throw new AttendanceError("ماموریت ساعتی حداکثر ۲۴ ساعتِ پیوسته است؛ برای مدت بیشتر «ماموریت روزانه» ثبت کنید");
  } else if (dayNum(toDate) - dayNum(fromDate) + 1 > MAX_REQUEST_DAYS) throw new AttendanceError(`ماموریت حداکثر ${MAX_REQUEST_DAYS} روز در هر درخواست است`);
  await assertCooperation(employeeId, fromDate, toDate);
  await assertDayOpen(employeeId, fromDate);
  await assertShiftAssigned(employeeId, fromDate, "ماموریت");
  await assertNoRequestConflict({ employeeId, fromDate, toDate, startMinute, endMinute }, excludeId, ["PENDING", "APPROVED"], "MISSION");
  return { employeeId, typeId, fromDate, toDate, plannedToDate: toDate, startMinute, endMinute, destination, reason };
}

async function nextNumber(tx: any): Promise<number> {
  const last = await tx.attendanceMissionRequest.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
  return (last?.number ?? 0) + 1;
}

export async function createMission(d: CleanMission, userId: number | null) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => tx.attendanceMissionRequest.create({ data: { number: await nextNumber(tx), ...d, createdById: userId } }));
    } catch (e: any) {
      if (e?.code === "P2002" && attempt < 3) continue;
      throw e;
    }
  }
}

/** قفل مشترکِ «یک درخواست ماموریت و گزارش‌هایش» (تایید، پایان، برگشت پایان و ثبت/تایید گزارش همه روی همین کلید سریال می‌شوند) */
export const lockMission = (tx: any, requestId: number) => tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(7100014, ${Number(requestId)})`);

/**
 * کنترل‌های تاریخ پایانِ تازه برای درخواست روزانه‌ی تاییدشده (تغییر «تا تاریخ» یا «پایان ماموریت»): بعد از شروع، حداکثر ۳۶۶ روز،
 * قبل از پایانِ آخرین ماهِ محاسبه‌شده‌ی حقوق کارمند نباشد، کارمند در همه‌ی روزها در همکاری باشد و با درخواست دیگری هم‌پوشان نشود.
 */
async function validateNewEnd(r: { id: number; employeeId: number; fromDate: Date; startMinute: number | null }, newTo: Date) {
  if (r.startMinute !== null) throw new AttendanceError("پایان ماموریت فقط برای ماموریت روزانه است");
  if (newTo < r.fromDate) throw new AttendanceError("تاریخ پایان قبل از تاریخ شروع ماموریت است");
  if (dayNum(newTo) - dayNum(r.fromDate) + 1 > MAX_REQUEST_DAYS) throw new AttendanceError(`ماموریت حداکثر ${MAX_REQUEST_DAYS} روز در هر درخواست است`);
  const lastEnd = await lastCalculatedEnd(r.employeeId);
  if (lastEnd && newTo < lastEnd) throw new AttendanceError(`تاریخ پایان ماموریت نمی‌تواند قبل از آخرین ماهِ محاسبه‌شده‌ی حقوق کارمند (تا ${displayDate(lastEnd)}) باشد`);
  await assertCooperation(r.employeeId, r.fromDate, newTo);
  await assertDayOpen(r.employeeId, newTo);
  await assertNoRequestConflict({ employeeId: r.employeeId, fromDate: r.fromDate, toDate: newTo, startMinute: null, endMinute: null }, r.id, ["PENDING", "APPROVED"], "MISSION");
}

/** تغییر «تا تاریخ» (تمدید/کوتاه‌کردن) درخواست تاییدشده‌ی روزانه‌ی پایان‌نیافته */
export async function changeMissionEnd(id: number, toDateRaw: unknown) {
  const newTo = parseDay(toDateRaw, "تا تاریخ");
  await prisma.$transaction(async (tx) => {
    await lockMission(tx, id);
    const r = await tx.attendanceMissionRequest.findUnique({ where: { id } });
    if (!r) throw new AttendanceError("درخواست یافت نشد");
    if (r.status !== "APPROVED" || r.endedAt) throw new AttendanceError("«تا تاریخ» فقط برای درخواست تاییدشده‌ی پایان‌نیافته تغییر می‌کند");
    await validateNewEnd(r, newTo);
    await tx.attendanceMissionRequest.update({ where: { id }, data: { toDate: newTo } });
  });
}

/** «پایان ماموریت»: تاریخ پایان واقعی (پیش‌فرض همان «تا تاریخ» فعلی) قطعی می‌شود */
export async function finishMission(id: number, endDateRaw: unknown, userId: number | null) {
  await prisma.$transaction(async (tx) => {
    await lockMission(tx, id);
    const r = await tx.attendanceMissionRequest.findUnique({ where: { id } });
    if (!r) throw new AttendanceError("درخواست یافت نشد");
    if (r.status !== "APPROVED") throw new AttendanceError("پایان ماموریت فقط برای درخواست تاییدشده ثبت می‌شود");
    if (r.endedAt) throw new AttendanceError("پایان این ماموریت قبلاً ثبت شده است");
    const newTo = endDateRaw ? parseDay(endDateRaw, "تاریخ پایان") : r.toDate;
    if (newTo > todayDate()) throw new AttendanceError("پایان ماموریت رویدادی است که اتفاق افتاده؛ تاریخ پایان نمی‌تواند در آینده باشد (تا آن زمان «تا تاریخ» را تغییر دهید)");
    await validateNewEnd(r, newTo);
    await tx.attendanceMissionRequest.update({ where: { id }, data: { toDate: newTo, endedAt: new Date(), endedById: userId } });
  });
}

/** برگشت پایان: فقط وقتی ماهِ پایان محاسبه‌ی حقوق نشده و گزارشی برای آن ثبت نشده باشد */
export async function unfinishMission(id: number) {
  await prisma.$transaction(async (tx) => {
    await lockMission(tx, id);
    const r = await tx.attendanceMissionRequest.findUnique({ where: { id }, include: { _count: { select: { reports: true } } } });
    if (!r) throw new AttendanceError("درخواست یافت نشد");
    if (!r.endedAt) throw new AttendanceError("پایان این ماموریت ثبت نشده است");
    const lastEnd = await lastCalculatedEnd(r.employeeId);
    if (lastEnd && lastEnd >= r.toDate) throw new AttendanceError(`حقوق کارمند تا ${displayDate(lastEnd)} محاسبه شده است؛ برای برگشت پایان ماموریت ابتدا محاسبه‌ی آن ماه را حذف کنید`);
    if (r._count.reports > 0) throw new AttendanceError("برای این ماموریت گزارش ثبت شده است؛ ابتدا گزارش‌ها را حذف کنید");
    await tx.attendanceMissionRequest.update({ where: { id }, data: { endedAt: null, endedById: null } });
  });
}

export async function approveMission(id: number, userId: number | null) {
  await prisma.$transaction(async (tx) => {
    await lockMission(tx, id);
    const r = await tx.attendanceMissionRequest.findUnique({ where: { id } });
    if (!r) throw new AttendanceError("درخواست یافت نشد");
    if (r.status !== "PENDING") throw new AttendanceError("فقط درخواست در وضعیت «ثبت‌شده» قابل تایید است");
    await assertDayOpen(r.employeeId, r.fromDate);
    await assertShiftAssigned(r.employeeId, r.fromDate, "ماموریت");
    // در فاصله‌ی ثبت تا تایید ممکن است درخواست هم‌پوشانِ تاییدشده‌ای ثبت شده باشد
    await assertNoRequestConflict(r, id, ["APPROVED"], "MISSION");
    await tx.attendanceMissionRequest.update({ where: { id }, data: { status: "APPROVED", decidedById: userId, decidedAt: new Date(), decisionNote: null } });
  });
}

export async function rejectMission(id: number, userId: number | null, note: unknown) {
  const text = typeof note === "string" ? note.trim() : "";
  if (!text) throw new AttendanceError("دلیل رد الزامی است");
  const r = await prisma.attendanceMissionRequest.updateMany({ where: { id, status: "PENDING" }, data: { status: "REJECTED", decidedById: userId, decidedAt: new Date(), decisionNote: text } });
  if (r.count === 0) throw new AttendanceError("فقط درخواست در وضعیت «ثبت‌شده» قابل رد است");
}

export async function unapproveMission(id: number) {
  await prisma.$transaction(async (tx) => {
    await lockMission(tx, id);
    const r = await tx.attendanceMissionRequest.findUnique({ where: { id }, select: { status: true, endedAt: true, employeeId: true, fromDate: true, toDate: true, startMinute: true, endMinute: true } });
    if (!r) throw new AttendanceError("درخواست یافت نشد");
    if (r.status === "PENDING") throw new AttendanceError("درخواست در وضعیت «ثبت‌شده» است");
    if (r.endedAt) throw new AttendanceError("پایان این ماموریت ثبت شده است؛ ابتدا «برگشت پایان» را بزنید");
    if (r.status === "APPROVED") await assertDayOpen(r.employeeId, r.fromDate);
    else await assertNoRequestConflict(r, id, ["PENDING", "APPROVED"], "MISSION"); // ردشده که دوباره «ثبت‌شده» می‌شود نباید با درخواست فعالِ دیگری هم‌پوشان باشد
    await tx.attendanceMissionRequest.update({ where: { id }, data: { status: "PENDING", decidedById: null, decidedAt: null, decisionNote: null } });
  });
}
