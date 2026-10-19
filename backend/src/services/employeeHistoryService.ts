import { prisma } from "../lib/prisma";
import { HrError, checkAssignmentRefs } from "./employeeAssignmentService";
import { displayDate } from "../utils/dateDisplay";
import { getPeriods, periodContains } from "./employmentStatusService";

// اصلاح سوابق انتصاب کارمند: ویرایش/حذف انتصاب (تنها محل این قواعد؛ مسیرهای employees فقط صدا می‌زنند). سابقه‌ی وضعیت و دوره‌های همکاری = services/employmentStatusService.ts.
//  • انتصابی که برای کارمند «حکمی با تاریخ اعمال ≥ تاریخ شروع آن انتصاب» دارد قابل ویرایش و حذف نیست (حکم هر وضعیتی).
//  • حذف: فقط انتصاب جاری، با انتصاب قبلیِ پیوسته (برای باز شدن دوباره‌ی آن).

const DAY = 86400000;
/** فقط برای متن پیام‌ها: تاریخ در تقویم نمایش (utils/dateDisplay) */
const day = (d: Date | null | undefined) => displayDate(d);
const sameDay = (a: Date, b: Date) => a.getTime() === b.getTime();

function parseDay(v: unknown, label: string): Date {
  const d = new Date(`${String(v ?? "")}T00:00:00.000Z`);
  if (!v || isNaN(d.getTime())) throw new HrError(`${label} نامعتبر یا خالی است`);
  return d;
}

/** پیام قفل یک انتصاب: وجود حکمی (هر وضعیت) با تاریخ اعمال ≥ تاریخ شروع انتصاب */
export function lockMessageFor(decree: { number: number; effectiveDate: Date } | null): string | null {
  return decree
    ? `برای این کارمند حکم شماره ${decree.number} با تاریخ اعمال ${day(decree.effectiveDate)} (همان تاریخ شروع این انتصاب یا بعد از آن) ثبت شده است؛ ویرایش و حذف انتصاب ممکن نیست`
    : null;
}

/** قفل همه‌ی انتصاب‌های یک کارمند با یک پرس‌وجو: id → پیام (null = آزاد) */
export async function assignmentLocks(employeeId: number, assignments: { id: number; fromDate: Date }[]): Promise<Map<number, string | null>> {
  const decrees = await prisma.employmentDecree.findMany({ where: { employeeId }, select: { number: true, effectiveDate: true }, orderBy: { effectiveDate: "asc" } });
  const out = new Map<number, string | null>();
  for (const a of assignments) out.set(a.id, lockMessageFor(decrees.find((d) => d.effectiveDate >= a.fromDate) ?? null));
  return out;
}

async function loadAssignment(employeeId: number, id: number) {
  const a = await prisma.employeeAssignment.findUnique({ where: { id } });
  if (!a || a.employeeId !== employeeId) throw new HrError("انتصاب یافت نشد");
  const lock = (await assignmentLocks(employeeId, [a])).get(a.id);
  if (lock) throw new HrError(lock);
  return a;
}

export async function updateAssignment(employeeId: number, id: number, b: any): Promise<void> {
  const a = await loadAssignment(employeeId, id);
  const input = { positionId: b.positionId ? Number(b.positionId) : null, orgUnitId: b.orgUnitId ? Number(b.orgUnitId) : null, costCenterId: b.costCenterId ? Number(b.costCenterId) : null, jobId: b.jobId ? Number(b.jobId) : null };
  await checkAssignmentRefs(input);
  const fromDate = parseDay(b.fromDate, "تاریخ شروع انتصاب");
  const [all, periods] = await Promise.all([
    prisma.employeeAssignment.findMany({ where: { employeeId }, orderBy: [{ fromDate: "asc" }, { id: "asc" }] }),
    getPeriods(employeeId),
  ]);
  const idx = all.findIndex((x) => x.id === id);
  const prev = all[idx - 1];
  const next = all[idx + 1];
  if (prev && fromDate <= prev.fromDate) throw new HrError(`تاریخ شروع باید بعد از شروع انتصاب قبلی (${day(prev.fromDate)}) باشد`);
  if (next && fromDate >= next.fromDate) throw new HrError(`تاریخ شروع باید قبل از شروع انتصاب بعدی (${day(next.fromDate)}) باشد`);
  if (a.toDate && fromDate > a.toDate) throw new HrError("تاریخ شروع نمی‌تواند بعد از تاریخ پایان همین انتصاب باشد");
  if (!periodContains(periods, fromDate)) throw new HrError("تاریخ شروع انتصاب باید داخل یکی از دوره‌های همکاری کارمند باشد");
  await prisma.$transaction(async (tx) => {
    if (prev && !sameDay(fromDate, a.fromDate)) {
      // پایان انتصاب قبلی همراه شروع این انتصاب جابه‌جا می‌شود (اگر پیوسته بودند)؛ وگرنه (فاصله‌ی ناشی از پایان همکاری) فقط نباید با آن هم‌پوشانی پیدا کند
      if (prev.toDate && sameDay(prev.toDate, new Date(a.fromDate.getTime() - DAY))) {
        await tx.employeeAssignment.update({ where: { id: prev.id }, data: { toDate: new Date(fromDate.getTime() - DAY) } });
      } else if (prev.toDate && fromDate <= prev.toDate) {
        throw new HrError("تاریخ شروع با انتصاب قبلی هم‌پوشانی دارد");
      }
    }
    await tx.employeeAssignment.update({
      where: { id },
      data: { fromDate, positionId: input.positionId!, orgUnitId: input.orgUnitId!, costCenterId: input.costCenterId, jobId: input.jobId },
    });
    await tx.position.update({ where: { id: input.positionId! }, data: { hasTransactions: true } });
  });
}

export async function deleteAssignment(employeeId: number, id: number): Promise<void> {
  const a = await loadAssignment(employeeId, id);
  if (a.toDate) throw new HrError("فقط انتصاب جاری قابل حذف است");
  const prev = await prisma.employeeAssignment.findFirst({ where: { employeeId, fromDate: { lt: a.fromDate } }, orderBy: { fromDate: "desc" } });
  if (!prev) throw new HrError("این تنها انتصاب کارمند است و حذف نمی‌شود؛ برای تغییر آن، ویرایشش کنید");
  if (!prev.toDate || !sameDay(prev.toDate, new Date(a.fromDate.getTime() - DAY))) {
    throw new HrError("انتصاب قبلی به‌صورت پیوسته به این انتصاب وصل نیست (فاصله‌ی پایان همکاری)؛ این انتصاب قابل حذف نیست");
  }
  await prisma.$transaction([
    prisma.employeeAssignment.delete({ where: { id } }),
    prisma.employeeAssignment.update({ where: { id: prev.id }, data: { toDate: null } }),
  ]);
}
