import { prisma } from "../lib/prisma";
import { displayDate } from "../utils/dateDisplay";
import { AttendanceError, EMPLOYEE_SELECT, assertDayOpen, dayStr, minuteText, parseDay, personName } from "./attendancePunchService";
import { getPeriods, periodContains } from "./employmentStatusService";

// مدیریت تردد › نوع مرخصی و درخواست مرخصی (مرحله‌ی ۱ و ۲). تنها محل قواعد.
// نوع مرخصی: واحد (روزانه/ساعتی/هر دو)، «از مانده کم شود» و «روز تعطیل وسط مرخصی» (برای مرحله‌ی «مانده‌ی مرخصی»؛ فعلاً فقط نگه‌داری می‌شوند)، «مدرک الزامی» (تایید بدون پیوست ممکن نیست).
// درخواست: روزانه (از تاریخ تا تاریخ) یا ساعتی (یک تاریخ + ساعت شروع/پایان همان روز)؛ ثبت‌شده ← تایید / رد (با دلیل) ← برگشت؛ فقط «ثبت‌شده» قابل ویرایش است.
// اثر روی کارکرد (مشتق، ذخیره نمی‌شود): فقط درخواست «تاییدشده» — به ازای هر نوع مرخصی یک متغیر روز LV<id> و جمع همه‌ی انواع LEAVE_TAKEN (leaveForDay).

const DAY_MS = 86400000;
const MAX_REQUEST_DAYS = 366;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const dayNum = (d: Date) => Math.floor(d.getTime() / DAY_MS);
export const leaveVarKey = (id: number) => `LV${id}`;

// ───────────────────────── نوع مرخصی ─────────────────────────

export function leaveTypeShape(t: any) {
  return {
    id: t.id,
    title: t.title,
    isActive: t.isActive,
    unit: t.unit as "DAY" | "HOUR" | "BOTH",
    deductsBalance: t.deductsBalance,
    requiresAttachment: t.requiresAttachment,
    countHolidays: t.countHolidays,
    description: t.description ?? "",
    requestCount: t._count?.requests,
    updatedAt: t.updatedAt,
  };
}

export async function saveLeaveType(body: any, id?: number) {
  const title = String(body?.title ?? "").trim().replace(/\s+/g, " ");
  if (!title) throw new AttendanceError("عنوان نوع مرخصی الزامی است");
  const unit = String(body?.unit ?? "BOTH");
  if (unit !== "DAY" && unit !== "HOUR" && unit !== "BOTH") throw new AttendanceError("واحد مرخصی نامعتبر است");
  const data = {
    title,
    unit: unit as any,
    isActive: body?.isActive !== false,
    deductsBalance: body?.deductsBalance === true,
    requiresAttachment: body?.requiresAttachment === true,
    countHolidays: body?.countHolidays === true,
    description: String(body?.description ?? "").trim() || null,
  };
  if (!id) {
    return prisma.$transaction(async (tx) => {
      const t = await tx.attendanceLeaveType.create({ data: { ...data, key: `TMP${Date.now()}${Math.floor(Math.random() * 1000)}` } });
      return tx.attendanceLeaveType.update({ where: { id: t.id }, data: { key: leaveVarKey(t.id) } });
    });
  }
  const ex = await prisma.attendanceLeaveType.findUnique({ where: { id } });
  if (!ex) throw new AttendanceError("نوع مرخصی یافت نشد");
  if (unit !== ex.unit && unit !== "BOTH") {
    // محدودکردن واحد با درخواست‌های موجودِ ناسازگار نمی‌شود
    const bad = await prisma.attendanceLeaveRequest.count({ where: { leaveTypeId: id, startMinute: unit === "DAY" ? { not: null } : null } });
    if (bad > 0) throw new AttendanceError(`درخواست ${unit === "DAY" ? "ساعتی" : "روزانه"}ِ ثبت‌شده‌ای با این نوع وجود دارد؛ واحد را نمی‌توان محدود کرد`);
  }
  return prisma.attendanceLeaveType.update({ where: { id }, data });
}

/** عامل‌هایی که فرمولشان به متغیر این نوع مرخصی ارجاع می‌دهد */
export async function factorsUsingLeaveType(id: number): Promise<string[]> {
  const re = new RegExp(`\\[(V|T):${leaveVarKey(id)}(:[A-Za-z_]+)?\\]`, "i");
  const rows = await prisma.attendanceFactor.findMany({ include: { methods: { include: { branches: true } } } });
  return rows.filter((f) => f.methods.some((m) => m.branches.some((b) => re.test(b.formulaText) || re.test(b.conditionText ?? "")))).map((f) => f.title);
}

export async function deleteLeaveType(id: number) {
  const by = await factorsUsingLeaveType(id);
  if (by.length) throw new AttendanceError(`این نوع مرخصی در فرمول عامل‌های دیگر استفاده شده است و حذف نمی‌شود: ${by.slice(0, 5).join("، ")}${by.length > 5 ? " …" : ""}`);
  await prisma.attendanceLeaveType.delete({ where: { id } });
}

// ───────────────────────── درخواست ─────────────────────────

export const STATUS_FA = { PENDING: "ثبت‌شده", APPROVED: "تاییدشده", REJECTED: "ردشده" } as const;

export function requestShape(r: any) {
  const hourly = r.startMinute !== null && r.startMinute !== undefined;
  return {
    id: r.id,
    number: r.number,
    employeeId: r.employeeId,
    personnelCode: r.employee?.personnelCode ?? "",
    employeeName: r.employee ? personName(r.employee.party) : "",
    leaveTypeId: r.leaveTypeId,
    leaveTypeTitle: r.leaveType?.title ?? "",
    requiresAttachment: !!r.leaveType?.requiresAttachment,
    fromDate: dayStr(r.fromDate),
    toDate: dayStr(r.toDate),
    hourly,
    startMinute: r.startMinute,
    endMinute: r.endMinute,
    periodText: hourly ? `${minuteText(r.startMinute)} تا ${minuteText(r.endMinute)}` : "",
    reason: r.reason,
    status: r.status as keyof typeof STATUS_FA,
    statusTitle: STATUS_FA[r.status as keyof typeof STATUS_FA],
    decisionNote: r.decisionNote ?? "",
    attachments: (r.attachments ?? []).map((a: any) => ({ id: a.id, fileName: a.fileName, mimeType: a.mimeType, size: a.size })),
    attachmentCount: r._count?.attachments ?? (r.attachments ?? []).length,
    updatedAt: r.updatedAt,
  };
}

export const REQUEST_INCLUDE = { employee: { select: EMPLOYEE_SELECT }, leaveType: true, attachments: { select: { id: true, fileName: true, mimeType: true, size: true } } };

async function nextNumber(tx: any): Promise<number> {
  const last = await tx.attendanceLeaveRequest.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
  return (last?.number ?? 0) + 1;
}

export interface CleanRequest {
  employeeId: number;
  leaveTypeId: number;
  fromDate: Date;
  toDate: Date;
  startMinute: number | null;
  endMinute: number | null;
  reason: string;
}

export async function cleanRequest(b: any, excludeId?: number): Promise<CleanRequest> {
  const employeeId = Number(b?.employeeId);
  if (!employeeId) throw new AttendanceError("کارمند الزامی است");
  const leaveTypeId = Number(b?.leaveTypeId);
  const type = leaveTypeId ? await prisma.attendanceLeaveType.findUnique({ where: { id: leaveTypeId } }) : null;
  if (!type) throw new AttendanceError("نوع مرخصی را انتخاب کنید");
  if (!type.isActive) throw new AttendanceError(`نوع مرخصی «${type.title}» غیرفعال است`);
  const reason = typeof b?.reason === "string" ? b.reason.trim() : "";
  if (!reason) throw new AttendanceError("دلیل درخواست الزامی است");
  const hourly = b?.hourly === true;
  if (hourly && type.unit === "DAY") throw new AttendanceError(`نوع مرخصی «${type.title}» فقط روزانه است`);
  if (!hourly && type.unit === "HOUR") throw new AttendanceError(`نوع مرخصی «${type.title}» فقط ساعتی است`);
  const fromDate = parseDay(b?.fromDate, "از تاریخ");
  let toDate = hourly || !b?.toDate ? fromDate : parseDay(b.toDate, "تا تاریخ");
  let startMinute: number | null = null, endMinute: number | null = null;
  if (hourly) {
    startMinute = Number(b?.startMinute);
    endMinute = Number(b?.endMinute);
    if (!Number.isInteger(startMinute) || !Number.isInteger(endMinute) || startMinute < 0 || endMinute > 1439 || startMinute < 0) throw new AttendanceError("ساعت شروع و پایان مرخصی ساعتی را کامل وارد کنید");
    if (endMinute <= startMinute) throw new AttendanceError("ساعت پایان مرخصی باید بعد از ساعت شروع باشد (مرخصی ساعتی از نیمه‌شب نمی‌گذرد)");
    toDate = fromDate;
  }
  if (toDate < fromDate) throw new AttendanceError("تاریخ پایان قبل از تاریخ شروع است");
  if (dayNum(toDate) - dayNum(fromDate) + 1 > MAX_REQUEST_DAYS) throw new AttendanceError(`مرخصی حداکثر ${MAX_REQUEST_DAYS} روز در هر درخواست است`);
  // کارمند باید در همه‌ی روزهای مرخصی در دوره‌ی همکاری باشد
  const periods = await getPeriods(employeeId);
  for (let d = dayNum(fromDate); d <= dayNum(toDate); d++) {
    if (!periodContains(periods, new Date(d * DAY_MS))) throw new AttendanceError(`کارمند در تاریخ ${displayDate(new Date(d * DAY_MS))} در دوره‌ی همکاری نیست`);
  }
  // هم‌پوشانی با درخواست‌های دیگر (ثبت‌شده یا تاییدشده)
  const others = await prisma.attendanceLeaveRequest.findMany({
    where: { employeeId, status: { not: "REJECTED" }, fromDate: { lte: toDate }, toDate: { gte: fromDate }, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { number: true, startMinute: true, endMinute: true },
  });
  for (const o of others) {
    const oHourly = o.startMinute !== null;
    // ساعتی با ساعتی فقط وقتی تداخل دارد که بازه‌ی ساعتی‌شان هم‌پوشان باشد؛ هر ترکیبِ دیگر روی همان روز تداخل است
    if (hourly && oHourly && !((startMinute as number) < (o.endMinute as number) && (o.startMinute as number) < (endMinute as number))) continue;
    throw new AttendanceError(`با درخواست مرخصی شماره ${o.number} هم‌پوشانی دارد`);
  }
  return { employeeId, leaveTypeId, fromDate, toDate, startMinute, endMinute, reason };
}

export async function createRequest(d: CleanRequest, userId: number | null) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => tx.attendanceLeaveRequest.create({ data: { number: await nextNumber(tx), ...d, createdById: userId } }));
    } catch (e: any) {
      if (e?.code === "P2002" && attempt < 3) continue;
      throw e;
    }
  }
}

export async function approveRequest(id: number, userId: number | null) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(7100012, ${Number(id)})`);
    const r = await tx.attendanceLeaveRequest.findUnique({ where: { id }, include: { leaveType: true, _count: { select: { attachments: true } } } });
    if (!r) throw new AttendanceError("درخواست یافت نشد");
    if (r.status !== "PENDING") throw new AttendanceError("فقط درخواست در وضعیت «ثبت‌شده» قابل تایید است");
    if (r.leaveType.requiresAttachment && r._count.attachments === 0) throw new AttendanceError(`برای نوع مرخصی «${r.leaveType.title}» پیوست (مدرک) الزامی است؛ ابتدا مدرک را پیوست کنید`);
    await assertDayOpen(r.employeeId, r.fromDate);
    // در فاصله‌ی ثبت تا تایید ممکن است درخواست هم‌پوشان تاییدشده باشد
    const clash = await tx.attendanceLeaveRequest.findMany({ where: { employeeId: r.employeeId, status: "APPROVED", id: { not: id }, fromDate: { lte: r.toDate }, toDate: { gte: r.fromDate } }, select: { number: true, startMinute: true, endMinute: true } });
    for (const o of clash) {
      const bothHourly = r.startMinute !== null && o.startMinute !== null;
      if (bothHourly && !((r.startMinute as number) < (o.endMinute as number) && (o.startMinute as number) < (r.endMinute as number))) continue;
      throw new AttendanceError(`با درخواست تاییدشده‌ی شماره ${o.number} هم‌پوشانی دارد`);
    }
    await tx.attendanceLeaveRequest.update({ where: { id }, data: { status: "APPROVED", decidedById: userId, decidedAt: new Date(), decisionNote: null } });
  });
}

export async function rejectRequest(id: number, userId: number | null, note: unknown) {
  const text = typeof note === "string" ? note.trim() : "";
  if (!text) throw new AttendanceError("دلیل رد الزامی است");
  const r = await prisma.attendanceLeaveRequest.updateMany({ where: { id, status: "PENDING" }, data: { status: "REJECTED", decidedById: userId, decidedAt: new Date(), decisionNote: text } });
  if (r.count === 0) throw new AttendanceError("فقط درخواست در وضعیت «ثبت‌شده» قابل رد است");
}

export async function unapproveRequest(id: number) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(7100012, ${Number(id)})`);
    const r = await tx.attendanceLeaveRequest.findUnique({ where: { id }, select: { status: true, employeeId: true, fromDate: true } });
    if (!r) throw new AttendanceError("درخواست یافت نشد");
    if (r.status === "PENDING") throw new AttendanceError("درخواست در وضعیت «ثبت‌شده» است");
    if (r.status === "APPROVED") await assertDayOpen(r.employeeId, r.fromDate);
    await tx.attendanceLeaveRequest.update({ where: { id }, data: { status: "PENDING", decidedById: null, decidedAt: null, decisionNote: null } });
  });
}

// ── پیوست‌ها (در پایگاه داده، تصویر یا PDF تا ۵ مگابایت؛ فقط تا وقتی درخواست «ثبت‌شده» است) ──

export async function addAttachment(requestId: number, userId: number | null, b: { fileName?: unknown; mimeType?: unknown; dataBase64?: unknown }) {
  const r = await prisma.attendanceLeaveRequest.findUnique({ where: { id: requestId }, select: { status: true } });
  if (!r) throw new AttendanceError("درخواست یافت نشد");
  if (r.status !== "PENDING") throw new AttendanceError("فقط به درخواست «ثبت‌شده» می‌توان پیوست اضافه کرد");
  const fileName = typeof b.fileName === "string" ? b.fileName.trim().slice(0, 200) : "";
  const mimeType = typeof b.mimeType === "string" ? b.mimeType.trim() : "";
  if (!fileName) throw new AttendanceError("نام فایل الزامی است");
  if (!(mimeType.startsWith("image/") || mimeType === "application/pdf")) throw new AttendanceError("فقط تصویر یا PDF پذیرفته می‌شود");
  const raw = typeof b.dataBase64 === "string" ? b.dataBase64.replace(/^data:[^;]*;base64,/, "") : "";
  const data = Buffer.from(raw, "base64");
  if (data.length === 0) throw new AttendanceError("فایل خالی است");
  if (data.length > MAX_ATTACHMENT_BYTES) throw new AttendanceError("حجم فایل بیش از ۵ مگابایت است");
  const a = await prisma.attendanceLeaveAttachment.create({ data: { requestId, fileName, mimeType, size: data.length, data, uploadedById: userId } });
  return { id: a.id };
}

export async function deleteAttachment(id: number) {
  const a = await prisma.attendanceLeaveAttachment.findUnique({ where: { id }, include: { request: { select: { status: true } } } });
  if (!a) throw new AttendanceError("پیوست یافت نشد");
  if (a.request.status !== "PENDING") throw new AttendanceError("پیوستِ درخواستِ تاییدشده/ردشده حذف نمی‌شود؛ ابتدا برگشت از تایید/رد کنید");
  await prisma.attendanceLeaveAttachment.delete({ where: { id } });
}

// ───────────────────────── اثر روی کارکرد ─────────────────────────

export interface ApprovedLeave {
  employeeId: number;
  typeKey: string;
  fromDay: number;
  toDay: number;
  startMinute: number | null;
  endMinute: number | null;
}

/** درخواست‌های «تاییدشده»ی کارمندان که با بازه‌ی روزها هم‌پوشان‌اند */
export async function loadApprovedLeave(employeeIds: number[], fromDay: number, toDay: number): Promise<ApprovedLeave[]> {
  if (employeeIds.length === 0) return [];
  const rows = await prisma.attendanceLeaveRequest.findMany({
    where: { employeeId: { in: employeeIds }, status: "APPROVED", fromDate: { lte: new Date(toDay * DAY_MS) }, toDate: { gte: new Date(fromDay * DAY_MS) } },
    include: { leaveType: { select: { key: true } } },
  });
  return rows.map((r) => ({ employeeId: r.employeeId, typeKey: r.leaveType.key, fromDay: dayNum(r.fromDate), toDay: dayNum(r.toDate), startMinute: r.startMinute, endMinute: r.endMinute }));
}

export interface DayLeave {
  byKey: Record<string, number>;
  total: number;
  /** مرخصی روزانه‌ی تاییدشده آن روز را می‌پوشاند (غیبت نیست) */
  hasDaily: boolean;
}

/**
 * مرخصیِ یک کارمند در یک روز از روی ردیف‌های «کارکرد روزانه»ی همان روز (dayRows): مرخصی تمام‌روز = «ساعت مرخصی» روز شیفت؛ مرخصی ساعتی = اشتراک بازه‌ی درخواستی با
 * بازه‌های کاریِ همان روز. روزِ غیرکاری (تعطیلی شیفت/رسمی) یا بدون شیفت دقیقه‌ی مرخصی ندارد (ولی مرخصی روزانه آن را «پوشش‌داده‌شده» می‌کند).
 */
export function leaveForDay(reqs: ApprovedLeave[], employeeId: number, day: number, dayRows: any[]): DayLeave {
  const out: DayLeave = { byKey: {}, total: 0, hasDaily: false };
  const work = dayRows.filter((r) => !r.rest);
  for (const q of reqs) {
    if (q.employeeId !== employeeId || day < q.fromDay || day > q.toDay) continue;
    let minutes = 0;
    if (q.startMinute === null) {
      out.hasDaily = true;
      minutes = work.length ? work[0].dayLeaveMinutes ?? 0 : 0;
    } else {
      for (const r of work) {
        const s = r.segStartClock as number;
        const e = (r.segEndClock as number) + (r.segEndsNextDay ? 1440 : 0);
        minutes += Math.max(0, Math.min(q.endMinute as number, e) - Math.max(q.startMinute, s));
      }
    }
    if (minutes > 0) {
      out.byKey[q.typeKey] = (out.byKey[q.typeKey] ?? 0) + minutes;
      out.total += minutes;
    }
  }
  return out;
}

export { MAX_ATTACHMENT_BYTES };
