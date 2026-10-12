import { prisma } from "../lib/prisma";

// سوابق تاریخ‌دار پرسنلی (تحصیلی، ایثارگری، تاهل): مقدار هر تاریخ = آخرین سابقه با تاریخ اعمال ≤ آن تاریخ.
// تنها محل خواندن «مقدار فعلی/در تاریخ» همین‌جاست؛ مصرف‌کننده‌ها (فرم کارمند، بعداً حقوق) مقدار را از روی کارمند نمی‌خوانند.

const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

function endOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export interface CurrentRecords {
  education: { id: number; effectiveDate: string; levelTitle: string; field: string | null } | null;
  veteran: { id: number; effectiveDate: string; isVeteran: boolean; percent: string | null } | null;
  marital: { id: number; effectiveDate: string; maritalStatus: string } | null;
}

/** مقدار معتبر هر سه سابقه برای یک کارمند در تاریخ داده‌شده (پیش‌فرض: امروز) */
export async function loadCurrentRecords(employeeId: number, onDate: Date = new Date()): Promise<CurrentRecords> {
  const d = endOfDay(onDate);
  const where = { employeeId, effectiveDate: { lte: d } };
  const orderBy = { effectiveDate: "desc" as const };
  const [edu, vet, mar] = await Promise.all([
    prisma.employeeEducationRecord.findFirst({ where, orderBy, include: { educationLevel: { select: { title: true } } } }),
    prisma.employeeVeteranRecord.findFirst({ where, orderBy }),
    prisma.employeeMaritalRecord.findFirst({ where, orderBy }),
  ]);
  return {
    education: edu ? { id: edu.id, effectiveDate: day(edu.effectiveDate)!, levelTitle: edu.educationLevel.title, field: edu.field } : null,
    veteran: vet ? { id: vet.id, effectiveDate: day(vet.effectiveDate)!, isVeteran: vet.isVeteran, percent: vet.percent?.toString() ?? null } : null,
    marital: mar ? { id: mar.id, effectiveDate: day(mar.effectiveDate)!, maritalStatus: mar.maritalStatus } : null,
  };
}
