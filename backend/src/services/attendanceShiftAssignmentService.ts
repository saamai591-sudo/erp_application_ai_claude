import { prisma } from "../lib/prisma";
import { displayDate } from "../utils/dateDisplay";
import { AttendanceError, EMPLOYEE_SELECT, assertEmployeeWorking, dayStr, parseDay, personName } from "./attendancePunchService";

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

export async function createAssignment(b: any, userId: number | null): Promise<{ id: number }> {
  const d = await clean(b);
  const c = await prisma.attendanceShiftAssignment.create({ data: { ...d, createdById: userId } });
  return { id: c.id };
}

export async function updateAssignment(id: number, b: any): Promise<void> {
  const ex = await prisma.attendanceShiftAssignment.findUnique({ where: { id } });
  if (!ex) throw new AttendanceError("انتساب یافت نشد");
  const lock = await lockMessage(ex);
  if (lock) throw new AttendanceError(lock);
  const d = await clean(b);
  if (d.employeeId !== ex.employeeId) throw new AttendanceError("کارمند انتساب قابل تغییر نیست؛ انتساب را حذف و دوباره ثبت کنید");
  await prisma.attendanceShiftAssignment.update({ where: { id }, data: d });
}

export async function deleteAssignment(id: number): Promise<void> {
  const ex = await prisma.attendanceShiftAssignment.findUnique({ where: { id } });
  if (!ex) throw new AttendanceError("انتساب یافت نشد");
  const lock = await lockMessage(ex);
  if (lock) throw new AttendanceError(lock);
  await prisma.attendanceShiftAssignment.delete({ where: { id } });
}
