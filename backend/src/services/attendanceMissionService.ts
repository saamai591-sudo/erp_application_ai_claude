import { prisma } from "../lib/prisma";
import { displayDate } from "../utils/dateDisplay";
import { AttendanceError, EMPLOYEE_SELECT, assertDayOpen, assertDaysOpen, dateLocked, dayStr, minuteText, parseDay, personName, type LockRange } from "./attendancePunchService";
import { getPeriods, periodContains } from "./employmentStatusService";
import { assertNoRequestConflict, assertShiftAssigned } from "./attendanceLeaveService";
import { assertNoPresenceInInterval, workSpan } from "./attendancePresenceService";

// مدیریت تردد › درخواست ماموریت — تنها محل قواعد. هم‌الگوی درخواست مرخصی (روزانه یا ساعتی؛ ثبت‌شده ← تایید / رد ← برگشت) ولی:
// • کنترل‌ها: دوره‌ی همکاری، «شیفت تخصیص‌یافته تا تاریخ شروع»، عدم هم‌پوشانی با مرخصی/ماموریت دیگر (assertNoRequestConflict دوطرفه) و عدم تداخل با ترددِ ثبت‌شده
//   (assertNoPresence: در بازه‌ی ماموریت تردد منفرد نباشد و شروع/پایان داخل جفت‌تردد نیفتد؛ برای روزانه بازه = شروع شیفت روز اول تا پایان شیفت روز آخر).
//   ماموریتِ ساعتی لازم نیست داخل بازه‌ی کاری باشد.
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

export function missionShape(r: any, ranges?: LockRange[]) {
  const hourly = r.startMinute !== null && r.startMinute !== undefined;
  const days = dayNum(r.toDate) - dayNum(r.fromDate) + 1;
  const minutes = hourly ? dayNum(r.toDate) * DAY + r.endMinute - (dayNum(r.fromDate) * DAY + r.startMinute) : 0;
  const ended = !!r.endedAt;
  // پایان‌یافته‌ای که ماهِ پایانش «محاسبه تردد» شده، دیگر تغییر (برگشت پایان، گزارش) نمی‌پذیرد
  const locked = ended && dateLocked(ranges, r.toDate);
  return {
    id: r.id,
    number: r.number,
    employeeId: r.employeeId,
    personnelCode: r.employee?.personnelCode ?? "",
    employeeName: r.employee ? personName(r.employee.party) : "",
    requestTypeId: r.requestTypeId,
    requestTypeTitle: r.requestType?.title ?? "",
    /** نوع درخواست گزارش می‌خواهد؟ (حداقل یک نوع ماموریتِ فعال به آن وصل است) */
    requiresReport: (r.requestType?.missionTypes ?? []).some((m: any) => m.isActive),
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
    reportCount: r._count?.reports ?? (r.reports ?? []).length,
    updatedAt: r.updatedAt,
  };
}

export const MISSION_INCLUDE = { employee: { select: EMPLOYEE_SELECT }, requestType: { include: { missionTypes: { select: { isActive: true } } } }, _count: { select: { reports: true } } };

export interface CleanMission {
  employeeId: number;
  requestTypeId: number;
  fromDate: Date;
  toDate: Date;
  plannedToDate: Date;
  startMinute: number | null;
  endMinute: number | null;
  destination: string;
  reason: string;
}

/** تداخل با ترددِ ثبت‌شده (تابع مشترک با مرخصی ساعتی): ساعتی = بازه‌ی خودش؛ روزانه = شروع شیفتِ روز اول تا پایان شیفتِ روز آخر */
async function assertNoPresence(q: { employeeId: number; fromDate: Date; toDate: Date; startMinute: number | null; endMinute: number | null }) {
  if (q.startMinute !== null) {
    await assertNoPresenceInInterval(q.employeeId, dayNum(q.fromDate) * DAY + q.startMinute, dayNum(q.toDate) * DAY + (q.endMinute as number), "ماموریت");
    return;
  }
  const span = await workSpan(q.employeeId, dayNum(q.fromDate), dayNum(q.toDate));
  await assertNoPresenceInInterval(q.employeeId, span.s, span.e, "ماموریت");
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
  // نوع درخواست (ماهیت ماموریت) واحد را هم مشخص می‌کند: ساعتی یا روزانه؛ چک‌باکس «ساعتی» ندارد
  const requestTypeId = Number(b?.requestTypeId);
  const type = requestTypeId ? await prisma.attendanceRequestType.findUnique({ where: { id: requestTypeId } }) : null;
  if (!type || type.nature !== "MISSION") throw new AttendanceError("نوع درخواست ماموریت را انتخاب کنید");
  if (!type.isActive) throw new AttendanceError(`نوع درخواست «${type.title}» غیرفعال است`);
  const destination = typeof b?.destination === "string" ? b.destination.trim() : "";
  if (!destination) throw new AttendanceError("مقصد ماموریت الزامی است");
  const reason = typeof b?.reason === "string" ? b.reason.trim() : "";
  if (!reason) throw new AttendanceError("شرح ماموریت الزامی است");
  const hourly = type.unit === "HOURLY";
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
  await assertDaysOpen(employeeId, fromDate, toDate);
  await assertShiftAssigned(employeeId, fromDate, "ماموریت");
  await assertNoPresence({ employeeId, fromDate, toDate, startMinute, endMinute });
  await assertNoRequestConflict({ employeeId, fromDate, toDate, startMinute, endMinute }, excludeId, ["PENDING", "APPROVED"], "MISSION");
  return { employeeId, requestTypeId, fromDate, toDate, plannedToDate: toDate, startMinute, endMinute, destination, reason };
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
 * روزهای تغییرکرده در ماهِ «محاسبه تردد»شده نباشد (assertDaysOpen)، کارمند در همه‌ی روزها در همکاری باشد و با درخواست دیگری هم‌پوشان نشود.
 */
async function validateNewEnd(r: { id: number; employeeId: number; fromDate: Date; toDate: Date; startMinute: number | null }, newTo: Date) {
  if (r.startMinute !== null) throw new AttendanceError("پایان ماموریت فقط برای ماموریت روزانه است");
  if (newTo < r.fromDate) throw new AttendanceError("تاریخ پایان قبل از تاریخ شروع ماموریت است");
  if (dayNum(newTo) - dayNum(r.fromDate) + 1 > MAX_REQUEST_DAYS) throw new AttendanceError(`ماموریت حداکثر ${MAX_REQUEST_DAYS} روز در هر درخواست است`);
  await assertCooperation(r.employeeId, r.fromDate, newTo);
  // روزهای بین پایان قبلی و تازه (و هر دو سر) عوض می‌شوند و احتسابِ ماهِ پایان هم از روزِ پایان می‌آید
  await assertDaysOpen(r.employeeId, r.toDate, newTo);
  await assertNoPresence({ employeeId: r.employeeId, fromDate: r.fromDate, toDate: newTo, startMinute: null, endMinute: null });
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

/** برگشت پایان: فقط وقتی ماهِ پایان «محاسبه تردد» نشده و گزارشی برای آن ثبت نشده باشد */
export async function unfinishMission(id: number) {
  await prisma.$transaction(async (tx) => {
    await lockMission(tx, id);
    const r = await tx.attendanceMissionRequest.findUnique({ where: { id }, include: { _count: { select: { reports: true } } } });
    if (!r) throw new AttendanceError("درخواست یافت نشد");
    if (!r.endedAt) throw new AttendanceError("پایان این ماموریت ثبت نشده است");
    await assertDayOpen(r.employeeId, r.toDate);
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
    await assertDaysOpen(r.employeeId, r.fromDate, r.toDate);
    await assertShiftAssigned(r.employeeId, r.fromDate, "ماموریت");
    // در فاصله‌ی ثبت تا تایید ممکن است ترددی داخل بازه ثبت شده یا درخواست هم‌پوشانِ تاییدشده‌ای آمده باشد
    await assertNoPresence(r);
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
    if (r.status === "APPROVED") await assertDaysOpen(r.employeeId, r.fromDate, r.toDate);
    else await assertNoRequestConflict(r, id, ["PENDING", "APPROVED"], "MISSION"); // ردشده که دوباره «ثبت‌شده» می‌شود نباید با درخواست فعالِ دیگری هم‌پوشان باشد
    await tx.attendanceMissionRequest.update({ where: { id }, data: { status: "PENDING", decidedById: null, decidedAt: null, decisionNote: null } });
  });
}

/**
 * کنترل‌های «محاسبه تردد» برای ماموریت (هر کارمند): بازه‌ی [from, to] = بازه‌ی تردد ماه.
 *  ۱) ماموریت روزانه‌ی تاییدشده‌ای که تاریخ پایانش در بازه است ولی «پایان ماموریت» ثبت نشده در محاسبه شمرده نمی‌شود ← خطا (وگرنه کارمند ماموریتش را نمی‌گیرد).
 *  ۲) ماموریت پایان‌یافته‌ی روزانه که نوع درخواستش گزارش می‌خواهد (حداقل یک نوع ماموریتِ فعال به آن وصل است) و گزارشِ تاییدشده ندارد ← خطا.
 * خروجی: پیام‌های هر کارمند (نبودن کلید = مشکلی نیست).
 */
export async function missionCalculationBlockers(employeeIds: number[], from: Date, to: Date): Promise<Map<number, string[]>> {
  const out = new Map<number, string[]>();
  if (employeeIds.length === 0) return out;
  const rows = await prisma.attendanceMissionRequest.findMany({
    where: { employeeId: { in: employeeIds }, status: "APPROVED", startMinute: null, toDate: { gte: from, lte: to } },
    select: {
      employeeId: true,
      number: true,
      fromDate: true,
      toDate: true,
      endedAt: true,
      requestType: { select: { title: true, missionTypes: { where: { isActive: true }, select: { id: true } } } },
      reports: { select: { status: true } },
    },
    orderBy: { number: "asc" },
  });
  const add = (id: number, msg: string) => (out.get(id) ?? out.set(id, []).get(id)!).push(msg);
  for (const r of rows) {
    const span = `از ${displayDate(r.fromDate)} تا ${displayDate(r.toDate)}`;
    if (!r.endedAt) {
      add(r.employeeId, `درخواست ماموریت شماره ${r.number} (${span}) پایان نیافته است؛ «پایان ماموریت» را ثبت کنید`);
      continue;
    }
    if (r.requestType.missionTypes.length === 0) continue;
    if (r.reports.some((p) => p.status === "APPROVED")) continue;
    const pending = r.reports.some((p) => p.status === "PENDING");
    add(r.employeeId, `برای درخواست ماموریت شماره ${r.number} (${r.requestType.title}، ${span}) گزارش ماموریتِ تاییدشده ثبت نشده است${pending ? " (گزارش ثبت‌شده هنوز تایید نشده)" : ""}`);
  }
  return out;
}
