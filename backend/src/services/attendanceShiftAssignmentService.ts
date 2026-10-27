import { prisma } from "../lib/prisma";
import { displayDate } from "../utils/dateDisplay";
import { AttendanceError, EMPLOYEE_SELECT, assertEmployeeWorking, assertFromDateOpen, dayStr, parseDay, personName } from "./attendancePunchService";

// مدیریت تردد › انتساب شیفت: تنها نویسنده‌ی AttendanceShiftAssignment. هر کارمند از «تاریخ شروع» هر انتساب تا شروع انتساب بعدی آن شیفت را دارد
// (مؤثر در یک تاریخ = آخرین انتساب با تاریخ شروع ≤ آن تاریخ؛ ریشه‌ی تشخیص روز چرخه در attendanceWindowService). شیفت چرخشی «تاریخِ روز ۱ چرخه» می‌خواهد؛
// شیفت هفتگی هم‌تراز هفته است و تاریخ چرخه ندارد. کارمند باید در تاریخ شروع در دوره‌ی همکاری باشد و شیفت فعال باشد.
// قفل: انتسابی که ترددِ دستی‌اختصاص‌یافته‌ای (روز کاری ≥ تاریخ شروع) به آن متکی است ویرایش/حذف نمی‌شود.

export const ASSIGNMENT_INCLUDE = { employee: { select: EMPLOYEE_SELECT }, shift: { select: { id: true, code: true, title: true, cycleType: true, cycleLength: true, cycleStartDate: true } } } as const;

export function assignmentShape(a: any) {
  return {
    id: a.id,
    employeeId: a.employeeId,
    personnelCode: a.employee.personnelCode,
    employeeName: personName(a.employee.party),
    shiftId: a.shiftId,
    shiftCode: a.shift.code,
    shiftTitle: a.shift.title,
    cycleType: a.shift.cycleType,
    cycleLength: a.shift.cycleLength,
    fromDate: dayStr(a.fromDate),
    /** تاریخ روز ۱ چرخه‌ی شیفت (فقط چرخشی؛ فقط نمایش) */
    cycleStartDate: a.shift.cycleType === "ROTATING" ? dayStr(a.shift.cycleStartDate) : null,
    note: a.note ?? "",
    updatedAt: a.updatedAt,
  };
}

async function clean(b: any) {
  const employeeId = Number(b?.employeeId);
  if (!employeeId) throw new AttendanceError("کارمند الزامی است");
  const shiftId = Number(b?.shiftId);
  if (!shiftId) throw new AttendanceError("شیفت را انتخاب کنید");
  const fromDate = parseDay(b?.fromDate, "تاریخ شروع");
  const shift = await prisma.attendanceShift.findUnique({ where: { id: shiftId } });
  if (!shift) throw new AttendanceError("شیفت یافت نشد");
  if (!shift.isActive) throw new AttendanceError("این شیفت غیرفعال است");
  await assertEmployeeWorking(employeeId, fromDate);
  // تاریخ روز ۱ چرخه فقط در تعریف شیفت است؛ انتساب فقط «کارمند + شیفت + از تاریخ» است و کارمند از روزِ مربوطِ همان تاریخ وارد چرخه می‌شود
  if (shift.cycleType === "ROTATING" && !shift.cycleStartDate) throw new AttendanceError(`برای شیفت چرخشی «${shift.title}» تاریخ روز ۱ چرخه تعیین نشده است؛ آن را در تعریف شیفت وارد کنید`);
  return { employeeId, shiftId, fromDate, note: typeof b?.note === "string" && b.note.trim() ? b.note.trim() : null };
}

/** ترددی که با اختصاص دستی (روز کاری ≥ تاریخ شروع) به این انتساب متکی است */
async function lockMessage(a: { employeeId: number; fromDate: Date }): Promise<string | null> {
  const n = await prisma.attendancePunch.count({ where: { employeeId: a.employeeId, workDate: { gte: a.fromDate } } });
  return n > 0 ? `${n} تردد با اختصاص دستی به پنجره از ${displayDate(a.fromDate)} به بعد برای این کارمند ثبت شده است؛ ابتدا اختصاص آن‌ها را بردارید` : null;
}

/**
 * درخواست‌های مرخصی/ماموریتِ در جریان یا تاییدشده (رد‌شده‌ها نه) که در «بازه‌ی اثر» یک انتساب افتاده‌اند: انتساب از تاریخ شروعش تا شروع انتسابِ بعدیِ همان کارمند
 * (بی‌پایان اگر بعدی نباشد) روزها را به شیفت می‌دهد، و مرخصی/ماموریت بر پایه‌ی همان شیفت اعتبارسنجی و محاسبه شده است (باید روز اول شیفت داشته باشد، ساعتی در
 * بازه‌های کاری شیفت باشد، مصرف مانده از روزهای کاری شیفت می‌آید). پس ثبت، تغییر یا حذف انتسابی که این بازه را عوض کند تا وجود آن‌ها رد می‌شود.
 */
async function requestsInSpan(employeeId: number, from: Date, to: Date | null): Promise<string | null> {
  const overlap = { employeeId, status: { in: ["PENDING", "APPROVED"] as ("PENDING" | "APPROVED")[] }, toDate: { gte: from }, ...(to ? { fromDate: { lt: to } } : {}) };
  const [leaves, missions] = await Promise.all([
    prisma.attendanceLeaveRequest.findMany({ where: overlap, select: { number: true }, orderBy: { number: "asc" }, take: 6 }),
    prisma.attendanceMissionRequest.findMany({ where: overlap, select: { number: true }, orderBy: { number: "asc" }, take: 6 }),
  ]);
  if (leaves.length === 0 && missions.length === 0) return null;
  const parts: string[] = [];
  if (leaves.length) parts.push(`درخواست مرخصی شماره ${leaves.map((x) => x.number).join("، ")}`);
  if (missions.length) parts.push(`درخواست ماموریت شماره ${missions.map((x) => x.number).join("، ")}`);
  return `برای این کارمند در بازه‌ی اثر این انتساب (از ${displayDate(from)}${to ? ` تا ${displayDate(new Date(to.getTime() - 86400000))}` : " به بعد"}) ${parts.join(" و ")} ثبت شده است؛ ابتدا آن‌ها را حذف یا رد کنید`;
}

/** شروع انتسابِ بعدی همان کارمند پس از تاریخ داده‌شده (به‌جز خودِ انتساب excludeId)؛ null = بی‌پایان */
async function nextStart(employeeId: number, after: Date, excludeId?: number): Promise<Date | null> {
  const n = await prisma.attendanceShiftAssignment.findFirst({ where: { employeeId, fromDate: { gt: after }, ...(excludeId ? { id: { not: excludeId } } : {}) }, orderBy: { fromDate: "asc" }, select: { fromDate: true } });
  return n?.fromDate ?? null;
}

export async function createAssignment(b: any, userId: number | null): Promise<{ id: number }> {
  const d = await clean(b);
  await assertFromDateOpen(d.employeeId, d.fromDate);
  const msg = await requestsInSpan(d.employeeId, d.fromDate, await nextStart(d.employeeId, d.fromDate));
  if (msg) throw new AttendanceError(msg);
  const c = await prisma.attendanceShiftAssignment.create({ data: { ...d, createdById: userId } });
  return { id: c.id };
}

export interface BulkProblem {
  personnelCode: string;
  fullName: string;
  reason: string;
}
/** خطای عملیات گروهی: هیچ انتسابی ثبت نشده و برای هر کارمندِ مشکل‌دار یک ردیف دلیل هست (قرارداد lib/bulkError.ts) */
export class BulkAssignmentError extends AttendanceError {
  constructor(message: string, public details: BulkProblem[]) {
    super(message);
  }
}

/**
 * انتساب گروهیِ شیفت (از فهرست «کارکنان»): یک شیفت و یک تاریخ شروع برای چند کارمند. همان کنترل‌های ثبت تکی برای هر کارمند (همکاری در تاریخ شروع، شیفت فعال،
 * قفل «محاسبه تردد»، نبودن انتسابِ هم‌تاریخ، درخواست مرخصی/ماموریتِ وابسته به بازه‌ی اثر)، همه‌یا‌هیچ: اگر حتی یک کارمند مشکل داشته باشد چیزی ثبت نمی‌شود و
 * دلیل هر کارمند برمی‌گردد.
 */
export async function bulkCreateAssignments(b: any, userId: number | null): Promise<{ created: number }> {
  const ids = [...new Set((Array.isArray(b?.employeeIds) ? b.employeeIds : []).map(Number).filter((n: number) => Number.isInteger(n) && n > 0))] as number[];
  if (ids.length === 0) throw new AttendanceError("کارمندی انتخاب نشده است");
  const shiftId = Number(b?.shiftId);
  if (!shiftId) throw new AttendanceError("شیفت را انتخاب کنید");
  const fromDate = parseDay(b?.fromDate, "تاریخ شروع");
  const shift = await prisma.attendanceShift.findUnique({ where: { id: shiftId } });
  if (!shift) throw new AttendanceError("شیفت یافت نشد");
  if (!shift.isActive) throw new AttendanceError("این شیفت غیرفعال است");
  if (shift.cycleType === "ROTATING" && !shift.cycleStartDate) throw new AttendanceError(`برای شیفت چرخشی «${shift.title}» تاریخ روز ۱ چرخه تعیین نشده است؛ آن را در تعریف شیفت وارد کنید`);
  const note = typeof b?.note === "string" && b.note.trim() ? b.note.trim() : null;
  const emps = await prisma.employee.findMany({ where: { id: { in: ids } }, select: EMPLOYEE_SELECT });
  const byId = new Map(emps.map((e) => [e.id, e]));
  const problems: BulkProblem[] = [];
  for (const id of ids) {
    const e = byId.get(id);
    const row = { personnelCode: e?.personnelCode ?? String(id), fullName: e ? personName(e.party) : "" };
    try {
      if (!e) throw new AttendanceError("کارمند یافت نشد");
      await assertEmployeeWorking(id, fromDate);
      await assertFromDateOpen(id, fromDate);
      if (await prisma.attendanceShiftAssignment.findFirst({ where: { employeeId: id, fromDate }, select: { id: true } })) throw new AttendanceError("برای این کارمند در همین تاریخ شروع، انتساب دیگری ثبت شده است");
      const msg = await requestsInSpan(id, fromDate, await nextStart(id, fromDate));
      if (msg) throw new AttendanceError(msg);
    } catch (err: any) {
      problems.push({ ...row, reason: err instanceof AttendanceError ? err.message : err?.message || "خطا" });
    }
  }
  if (problems.length) throw new BulkAssignmentError(`انتساب گروهی انجام نشد؛ ${problems.length} کارمند از ${ids.length} مشکل دارد (هیچ انتسابی ثبت نشد)`, problems);
  await prisma.$transaction(ids.map((employeeId) => prisma.attendanceShiftAssignment.create({ data: { employeeId, shiftId, fromDate, note, createdById: userId } })));
  return { created: ids.length };
}

export async function updateAssignment(id: number, b: any): Promise<void> {
  const ex = await prisma.attendanceShiftAssignment.findUnique({ where: { id } });
  if (!ex) throw new AttendanceError("انتساب یافت نشد");
  const lock = await lockMessage(ex);
  if (lock) throw new AttendanceError(lock);
  await assertFromDateOpen(ex.employeeId, ex.fromDate);
  const d = await clean(b);
  await assertFromDateOpen(d.employeeId, d.fromDate);
  if (d.employeeId !== ex.employeeId) throw new AttendanceError("کارمند انتساب قابل تغییر نیست؛ انتساب را حذف و دوباره ثبت کنید");
  // فقط تغییر شیفت یا تاریخ شروع بازه را عوض می‌کند (توضیح آزاد است)
  if (d.shiftId !== ex.shiftId || d.fromDate.getTime() !== ex.fromDate.getTime()) {
    const old = await requestsInSpan(ex.employeeId, ex.fromDate, await nextStart(ex.employeeId, ex.fromDate, id));
    if (old) throw new AttendanceError(old);
    const neu = await requestsInSpan(d.employeeId, d.fromDate, await nextStart(d.employeeId, d.fromDate, id));
    if (neu) throw new AttendanceError(neu);
  }
  await prisma.attendanceShiftAssignment.update({ where: { id }, data: d });
}

export async function deleteAssignment(id: number): Promise<void> {
  const ex = await prisma.attendanceShiftAssignment.findUnique({ where: { id } });
  if (!ex) throw new AttendanceError("انتساب یافت نشد");
  const lock = await lockMessage(ex);
  if (lock) throw new AttendanceError(lock);
  await assertFromDateOpen(ex.employeeId, ex.fromDate);
  const msg = await requestsInSpan(ex.employeeId, ex.fromDate, await nextStart(ex.employeeId, ex.fromDate, id));
  if (msg) throw new AttendanceError(msg);
  await prisma.attendanceShiftAssignment.delete({ where: { id } });
}
