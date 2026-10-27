import { prisma } from "../lib/prisma";
import { formulaUsers } from "./attendanceFormulaUsage";
import { displayDate } from "../utils/dateDisplay";
import { AttendanceError, EMPLOYEE_SELECT, assertDaysOpen, dayStr, minuteText, parseDay, personName } from "./attendancePunchService";
import { getPeriods, periodContains } from "./employmentStatusService";
import { buildWorksheet } from "./attendanceWorksheetService";
import { assertBalanceAllowed, lockEmployeeBalance, typeHasBalanceData } from "./attendanceLeaveBalanceService";
import { assertNoPresenceInInterval } from "./attendancePresenceService";

// مدیریت تردد › نوع مرخصی و درخواست مرخصی (مرحله‌ی ۱ و ۲). تنها محل قواعد.
// نوع مرخصی: واحد (روزانه / روزانه و ساعتی)، «دارای مانده مرخصی» و «روز تعطیل وسط مرخصی» (محاسبه‌ی مانده در attendanceLeaveBalanceService)، «مدرک الزامی» (تایید بدون پیوست ممکن نیست).
// کنترل مانده‌ی منفی هنگام ثبت/ویرایش و تایید درخواست (assertBalanceAllowed) زیر قفل کارمند انجام می‌شود تا دو درخواست هم‌زمان هر دو از کنترل رد نشوند.
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
    unit: (t.unit === "DAY" ? "DAY" : "BOTH") as "DAY" | "BOTH",
    deductsBalance: t.deductsBalance,
    entitlementKind: (t.entitlementKind ?? null) as "ANNUAL" | "MONTHLY" | null,
    hasPerRequestLimit: !!t.hasPerRequestLimit,
    hasPerMonthLimit: !!t.hasPerMonthLimit,
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
  if (unit !== "DAY" && unit !== "BOTH") throw new AttendanceError("واحد مرخصی نامعتبر است");
  const deducts = body?.deductsBalance === true;
  let entitlementKind: "ANNUAL" | "MONTHLY" | null = null;
  if (deducts) {
    const k = String(body?.entitlementKind ?? "");
    if (k !== "ANNUAL" && k !== "MONTHLY") throw new AttendanceError("برای نوعِ «دارای مانده مرخصی» نوع استحقاق (سالانه یا ماهانه) را انتخاب کنید");
    entitlementKind = k;
  }
  const data = {
    title,
    unit: unit as any,
    isActive: body?.isActive !== false,
    deductsBalance: deducts,
    entitlementKind: entitlementKind as any,
    // سقف‌های استفاده فقط برای نوعِ دارای مانده معنا دارند؛ مقدارشان در «قاعده‌ی استحقاق» گرفته می‌شود
    hasPerRequestLimit: deducts && body?.hasPerRequestLimit === true,
    hasPerMonthLimit: deducts && body?.hasPerMonthLimit === true,
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
  const exUnit = ex.unit === "DAY" ? "DAY" : "BOTH";
  if (ex.entitlementKind && entitlementKind && ex.entitlementKind !== entitlementKind && (await typeHasBalanceData(id))) throw new AttendanceError("برای این نوع مرخصی مانده‌ی دستی، قاعده‌ی استحقاق یا مرخصی منفی ثبت شده است؛ نوع استحقاق را نمی‌توان تغییر داد");
  if (unit !== exUnit) {
    // مانده‌ی روزانه «روز» و مانده‌ی روزانه و ساعتی «دقیقه» است؛ با داده‌ی مانده تغییر واحد معنا را عوض می‌کند
    if (await typeHasBalanceData(id)) throw new AttendanceError("برای این نوع مرخصی مانده‌ی دستی، قاعده‌ی استحقاق یا مرخصی منفی ثبت شده است؛ واحد را نمی‌توان تغییر داد");
    if (unit === "DAY") {
      const bad = await prisma.attendanceLeaveRequest.count({ where: { leaveTypeId: id, startMinute: { not: null } } });
      if (bad > 0) throw new AttendanceError("درخواست ساعتیِ ثبت‌شده‌ای با این نوع وجود دارد؛ واحد را نمی‌توان به «روزانه» محدود کرد");
    }
  }
  return prisma.attendanceLeaveType.update({ where: { id }, data });
}

/** عامل‌هایی که فرمولشان به متغیر این نوع مرخصی ارجاع می‌دهد */
export async function factorsUsingLeaveType(id: number): Promise<string[]> {
  const re = new RegExp(`\\[(V|T):${leaveVarKey(id)}(:[A-Za-z_]+)?\\]`, "i");
  return formulaUsers(re);
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
    periodText: hourly ? `${minuteText(r.startMinute)} تا ${minuteText(r.endMinute)}${dayNum(r.toDate) > dayNum(r.fromDate) ? " (روز بعد)" : ""}` : "",
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

const DAY = 1440;
const atText = (abs: number) => `${displayDate(new Date(Math.floor(abs / DAY) * DAY_MS))} ساعت ${minuteText(((abs % DAY) + DAY) % DAY)}`;

/** بازه‌ی مطلق (دقیقه از مبدأ روز) یک درخواست ساعتی؛ null برای روزانه */
const absInterval = (q: { fromDate: Date; toDate: Date; startMinute: number | null; endMinute: number | null }) =>
  q.startMinute === null ? null : { s: dayNum(q.fromDate) * DAY + q.startMinute, e: dayNum(q.toDate) * DAY + (q.endMinute as number) };

/**
 * تداخل با درخواست‌های دیگر (ثبت‌شده یا تاییدشده): ساعتی با ساعتی فقط اگر بازه‌ی مطلقشان هم‌پوشان باشد؛ هر ترکیب دیگر (روزانه با روزانه یا ساعتی) اگر تاریخ‌هایشان مشترک باشد.
 * این‌جا تنها نقطه‌ی «تداخل بین درخواست‌هاست»؛ درخواست ماموریت که ساخته شود همین تابع را برای آن هم می‌خواند.
 */
export async function assertNoRequestConflict(q: { employeeId: number; fromDate: Date; toDate: Date; startMinute: number | null; endMinute: number | null }, excludeId: number | undefined, statuses: ("PENDING" | "APPROVED")[], selfKind: "LEAVE" | "MISSION" = "LEAVE") {
  const where = (own: boolean) => ({ employeeId: q.employeeId, status: { in: statuses }, fromDate: { lte: q.toDate }, toDate: { gte: q.fromDate }, ...(own && excludeId ? { id: { not: excludeId } } : {}) });
  const select = { number: true, fromDate: true, toDate: true, startMinute: true, endMinute: true };
  // مرخصی و ماموریت یک‌دیگر را دوطرفه کنترل می‌کنند: excludeId فقط به جدولِ نوعِ خودِ درخواست مربوط است
  const [leaves, missions] = await Promise.all([
    prisma.attendanceLeaveRequest.findMany({ where: where(selfKind === "LEAVE"), select }),
    prisma.attendanceMissionRequest.findMany({ where: where(selfKind === "MISSION"), select }),
  ]);
  const mine = absInterval(q);
  for (const [kindFa, others] of [["مرخصی", leaves], ["ماموریت", missions]] as const) {
    for (const o of others) {
      const theirs = absInterval(o);
      if (mine && theirs && !(mine.s < theirs.e && theirs.s < mine.e)) continue;
      throw new AttendanceError(`با درخواست ${kindFa} شماره ${o.number} هم‌پوشانی دارد`);
    }
  }
}

/** در تاریخ شروع باید شیفتی به کارمند تخصیص یافته باشد (انتساب از «تاریخ شروع» تا انتساب بعدی ادامه دارد، پس پایان هم پوشش دارد) — مشترک بین مرخصی و ماموریت */
export async function assertShiftAssigned(employeeId: number, fromDate: Date, what: "مرخصی" | "ماموریت" = "مرخصی") {
  const asg = await prisma.attendanceShiftAssignment.findFirst({ where: { employeeId, fromDate: { lte: fromDate } }, select: { id: true } });
  if (asg) return;
  const first = await prisma.attendanceShiftAssignment.findFirst({ where: { employeeId }, orderBy: { fromDate: "asc" }, select: { fromDate: true } });
  throw new AttendanceError(first ? `در تاریخ ${displayDate(fromDate)} شیفتی برای کارمند تخصیص نیافته است (اولین انتساب شیفت از ${displayDate(first.fromDate)} است)؛ ${what} فقط داخل بازه‌ی شیفتِ کارمند ثبت می‌شود` : `برای کارمند هنوز شیفتی تخصیص نیافته است؛ ${what} فقط داخل بازه‌ی شیفتِ کارمند ثبت می‌شود`);
}

/**
 * کنترل‌های «شیفت و حضور»: (۱) مرخصی ساعتی باید با شروع و پایانش داخل بازه‌های کاریِ شیفتِ همان روز (با اعمال استثنای روز) بیفتد (وسط بازه‌ی استراحت/بین دو بازه مجاز است
 * ولی شروع و پایان باید داخل بازه‌ی کاری باشند)؛ (۲) مرخصی با ترددِ ثبت‌شده تداخل نداشته باشد: ساعتی با حضورِ جفت‌ترددها و ترددِ منفردِ داخل بازه، روزانه با هر تردد در تاریخ‌هایش.
 */
export async function assertShiftAndPresence(q: { employeeId: number; fromDate: Date; toDate: Date; startMinute: number | null; endMinute: number | null }) {
  // مرخصی فقط داخل بازه‌ی شیفتِ کارمند
  await assertShiftAssigned(q.employeeId, q.fromDate, "مرخصی");
  const f = dayNum(q.fromDate), t = dayNum(q.toDate);
  const mine = absInterval(q);
  if (mine) {
    const ws = await buildWorksheet({ from: new Date((f - 1) * DAY_MS), to: new Date((t + 1) * DAY_MS), employeeIds: [q.employeeId], includeRest: true });
    const rows = ws.rows.filter((r: any) => r.employeeId === q.employeeId);
    const segs = rows
      .filter((r: any) => !r.rest)
      .map((r: any) => {
        const wd = dayNum(new Date(r.workDate));
        return { s: wd * DAY + (r.segStartRel as number), e: wd * DAY + (r.segEndRel as number) };
      });
    if (segs.length === 0) throw new AttendanceError("برای این کارمند در این تاریخ شیفتِ کاری منتسب نیست؛ مرخصی ساعتی فقط روی ساعت کاری شیفت ثبت می‌شود");
    const list = segs.map((x) => `${atText(x.s)} تا ${atText(x.e)}`).join("، ");
    if (!segs.some((x) => mine.s >= x.s && mine.s < x.e)) throw new AttendanceError(`شروع مرخصی (${atText(mine.s)}) داخل بازه‌ی کاری شیفت نیست؛ بازه‌های کاری: ${list}`);
    if (!segs.some((x) => mine.e > x.s && mine.e <= x.e)) throw new AttendanceError(`پایان مرخصی (${atText(mine.e)}) داخل بازه‌ی کاری شیفت نیست؛ بازه‌های کاری: ${list}`);
    // تداخل با ترددِ ثبت‌شده: تابع مشترکِ مرخصی/ماموریت (جفت‌ترددِ هم‌پوشان یا تردد منفردِ داخل بازه)
    await assertNoPresenceInInterval(q.employeeId, mine.s, mine.e, "مرخصی");
    return;
  }
  const punches = await prisma.attendancePunch.findMany({ where: { employeeId: q.employeeId, date: { gte: q.fromDate, lte: q.toDate } }, orderBy: [{ date: "asc" }, { minute: "asc" }], select: { date: true, minute: true }, take: 1 });
  if (punches.length) throw new AttendanceError(`در تاریخ ${displayDate(punches[0].date)} ساعت ${minuteText(punches[0].minute)} تردد ثبت شده و با مرخصی روزانه تداخل دارد؛ مرخصی ساعتی ثبت کنید یا ترددها را اصلاح کنید`);
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
  const fromDate = parseDay(b?.fromDate, "از تاریخ");
  const toDate = !b?.toDate ? fromDate : parseDay(b.toDate, "تا تاریخ");
  let startMinute: number | null = null, endMinute: number | null = null;
  if (toDate < fromDate) throw new AttendanceError("تاریخ پایان قبل از تاریخ شروع است");
  if (hourly) {
    startMinute = Number(b?.startMinute);
    endMinute = Number(b?.endMinute);
    if (!Number.isInteger(startMinute) || !Number.isInteger(endMinute) || startMinute < 0 || startMinute > 1439 || endMinute < 0 || endMinute > 1439) throw new AttendanceError("ساعت شروع و پایان مرخصی ساعتی را کامل وارد کنید");
    const len = dayNum(toDate) * DAY + endMinute - (dayNum(fromDate) * DAY + startMinute);
    if (len <= 0) throw new AttendanceError("پایان مرخصی باید بعد از شروع آن باشد");
    if (len > DAY) throw new AttendanceError("مرخصی ساعتی حداکثر ۲۴ ساعتِ پیوسته است؛ برای مدت بیشتر «مرخصی روزانه» ثبت کنید");
  } else if (dayNum(toDate) - dayNum(fromDate) + 1 > MAX_REQUEST_DAYS) throw new AttendanceError(`مرخصی حداکثر ${MAX_REQUEST_DAYS} روز در هر درخواست است`);
  // کارمند باید در همه‌ی روزهای مرخصی در دوره‌ی همکاری باشد
  const periods = await getPeriods(employeeId);
  for (let d = dayNum(fromDate); d <= dayNum(toDate); d++) {
    if (!periodContains(periods, new Date(d * DAY_MS))) throw new AttendanceError(`کارمند در تاریخ ${displayDate(new Date(d * DAY_MS))} در دوره‌ی همکاری نیست`);
  }
  const q = { employeeId, fromDate, toDate, startMinute, endMinute };
  await assertDaysOpen(employeeId, fromDate, toDate);
  // اول کنترل شیفت و حضور (پیام روشن‌تر)، بعد تداخل با درخواست‌های دیگر
  await assertShiftAndPresence(q);
  await assertNoRequestConflict(q, excludeId, ["PENDING", "APPROVED"]);
  return { employeeId, leaveTypeId, fromDate, toDate, startMinute, endMinute, reason };
}

export async function createRequest(d: CleanRequest, userId: number | null) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        await lockEmployeeBalance(tx, d.employeeId);
        await assertBalanceAllowed({ employeeId: d.employeeId, leaveTypeId: d.leaveTypeId, fromDate: d.fromDate, extra: d });
        return tx.attendanceLeaveRequest.create({ data: { number: await nextNumber(tx), ...d, createdById: userId } });
      });
    } catch (e: any) {
      if (e?.code === "P2002" && attempt < 3) continue;
      throw e;
    }
  }
}

export async function updateRequest(id: number, d: CleanRequest) {
  await prisma.$transaction(async (tx) => {
    await lockEmployeeBalance(tx, d.employeeId);
    await assertBalanceAllowed({ employeeId: d.employeeId, leaveTypeId: d.leaveTypeId, fromDate: d.fromDate, extra: { ...d, id }, excludeRequestId: id });
    await tx.attendanceLeaveRequest.update({ where: { id }, data: d });
  });
}

export async function approveRequest(id: number, userId: number | null) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(7100012, ${Number(id)})`);
    const r = await tx.attendanceLeaveRequest.findUnique({ where: { id }, include: { leaveType: true, _count: { select: { attachments: true } } } });
    if (!r) throw new AttendanceError("درخواست یافت نشد");
    if (r.status !== "PENDING") throw new AttendanceError("فقط درخواست در وضعیت «ثبت‌شده» قابل تایید است");
    if (r.leaveType.requiresAttachment && r._count.attachments === 0) throw new AttendanceError(`برای نوع مرخصی «${r.leaveType.title}» پیوست (مدرک) الزامی است؛ ابتدا مدرک را پیوست کنید`);
    await assertDaysOpen(r.employeeId, r.fromDate, r.toDate);
    // در فاصله‌ی ثبت تا تایید ممکن است درخواست هم‌پوشان تاییدشده یا ترددِ تداخل‌دار ثبت شده باشد
    await assertNoRequestConflict(r, id, ["APPROVED"]);
    await assertShiftAndPresence(r);
    await lockEmployeeBalance(tx, r.employeeId);
    await assertBalanceAllowed({ employeeId: r.employeeId, leaveTypeId: r.leaveTypeId, fromDate: r.fromDate, requestId: id });
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
    const r = await tx.attendanceLeaveRequest.findUnique({ where: { id }, select: { status: true, employeeId: true, fromDate: true, toDate: true, leaveTypeId: true } });
    if (!r) throw new AttendanceError("درخواست یافت نشد");
    if (r.status === "PENDING") throw new AttendanceError("درخواست در وضعیت «ثبت‌شده» است");
    if (r.status === "APPROVED") await assertDaysOpen(r.employeeId, r.fromDate, r.toDate);
    else {
      // درخواست ردشده دوباره «ثبت‌شده» و مصرف‌کننده‌ی مانده می‌شود
      await lockEmployeeBalance(tx, r.employeeId);
      const q = await tx.attendanceLeaveRequest.findUnique({ where: { id }, select: { id: true, number: true, leaveTypeId: true, fromDate: true, toDate: true, startMinute: true, endMinute: true } });
      await assertBalanceAllowed({ employeeId: r.employeeId, leaveTypeId: r.leaveTypeId, fromDate: r.fromDate, extra: q!, excludeRequestId: id });
    }
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

/** درخواست‌های «تاییدشده»ی کارمندان که با بازه‌ی روزها هم‌پوشان‌اند (یک روز حاشیه برای مرخصی ساعتیِ شبانه) */
export async function loadApprovedLeave(employeeIds: number[], fromDay: number, toDay: number): Promise<ApprovedLeave[]> {
  if (employeeIds.length === 0) return [];
  const rows = await prisma.attendanceLeaveRequest.findMany({
    where: { employeeId: { in: employeeIds }, status: "APPROVED", fromDate: { lte: new Date((toDay + 1) * DAY_MS) }, toDate: { gte: new Date((fromDay - 1) * DAY_MS) } },
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
 * مرخصیِ یک کارمند در یک روزِ کاری از روی ردیف‌های «کارکرد روزانه»ی همان روز (dayRows): مرخصی تمام‌روز = «ساعت مرخصی» روز شیفت؛ مرخصی ساعتی = اشتراکِ بازه‌ی مطلقِ درخواست
 * با بازه‌های کاریِ همان روز (محور زمان پیوسته: مرخصی ۲۲ تا ۰۲ بامداد روز بعد به روزِ کاریِ شروعِ شیفت تعلق می‌گیرد). روزِ غیرکاری یا بدون شیفت دقیقه‌ی مرخصی ندارد.
 */
export function leaveForDay(reqs: ApprovedLeave[], employeeId: number, day: number, dayRows: any[]): DayLeave {
  const out: DayLeave = { byKey: {}, total: 0, hasDaily: false };
  const work = dayRows.filter((r) => !r.rest);
  for (const q of reqs) {
    if (q.employeeId !== employeeId) continue;
    let minutes = 0;
    if (q.startMinute === null) {
      if (day < q.fromDay || day > q.toDay) continue;
      out.hasDaily = true;
      minutes = work.length ? work[0].dayLeaveMinutes ?? 0 : 0;
    } else {
      const qs = q.fromDay * 1440 + q.startMinute, qe = q.toDay * 1440 + (q.endMinute as number);
      for (const r of work) {
        const s = day * 1440 + (r.segStartRel as number), e = day * 1440 + (r.segEndRel as number);
        minutes += Math.max(0, Math.min(qe, e) - Math.max(qs, s));
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
