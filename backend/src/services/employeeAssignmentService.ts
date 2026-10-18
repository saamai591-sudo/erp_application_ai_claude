import { prisma } from "../lib/prisma";

// انتصاب کارمند (پست × واحد × مرکز هزینه، تاریخ‌دار): تنها محل ساخت/بستن انتصاب. هم فرم کارمند و هم تایید حکم از همین تابع استفاده می‌کنند.

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** خطای قاعده‌ی کسب‌وکار منابع انسانی؛ روت‌ها آن را به پاسخ ۴۰۰ تبدیل می‌کنند */
export class HrError extends Error {}

export interface AssignmentInput {
  positionId?: number | null;
  orgUnitId?: number | null;
  costCenterId?: number | null;
  /** شغل: وقتی پست شغل دارد الزامی و از شغل‌های همان پست است؛ پستِ بدون شغل = خالی */
  jobId?: number | null;
}

/** واحد سازمانیِ انتصاب = واحد خودِ پست؛ فقط اگر پست واحد نداشت (مثل پست پیش‌فرض) از کاربر گرفته می‌شود. نتیجه را در a.orgUnitId می‌نویسد */
export async function checkAssignmentRefs(a: AssignmentInput): Promise<void> {
  if (!a.positionId) throw new HrError("پست الزامی است");
  const pos = await prisma.position.findUnique({ where: { id: Number(a.positionId) } });
  if (!pos) throw new HrError("پست یافت نشد");
  if (!pos.isActive) throw new HrError("پست انتخاب‌شده غیرفعال است");
  if (pos.orgUnitId) a.orgUnitId = pos.orgUnitId;
  if (!a.orgUnitId) throw new HrError("این پست واحد سازمانی ندارد؛ واحد سازمانی را انتخاب کنید");
  if (!(await prisma.orgUnit.findUnique({ where: { id: Number(a.orgUnitId) } }))) throw new HrError("واحد سازمانی یافت نشد");
  if (a.costCenterId && !(await prisma.costCenter.findUnique({ where: { id: Number(a.costCenterId) } }))) {
    throw new HrError("مرکز هزینه یافت نشد");
  }
  // شغل: کاربر هنگام انتخاب پست باید از شغل‌هایی که به همان پست تخصیص داده شده یکی را انتخاب کند
  const jobs = await prisma.positionJob.findMany({ where: { positionId: pos.id }, select: { jobId: true } });
  const jobId = a.jobId ? Number(a.jobId) : null;
  if (jobs.length > 0) {
    if (!jobId) throw new HrError(`برای پست «${pos.title}» انتخاب شغل الزامی است`);
    if (!jobs.some((j) => j.jobId === jobId)) throw new HrError(`شغل انتخاب‌شده جزو شغل‌های تخصیص‌داده‌شده به پست «${pos.title}» نیست`);
  } else if (jobId) {
    throw new HrError(`پست «${pos.title}» شغلی ندارد؛ ابتدا در فرم پست شغل‌ها را تخصیص دهید`);
  }
  a.jobId = jobId;
}

/**
 * انتصاب فعلی را از روز قبل از fromDate می‌بندد و انتصاب تازه می‌سازد.
 * ورودی باید قبلاً با checkAssignmentRefs اعتبارسنجی شده باشد (orgUnitId پر است).
 * شناسه‌ی انتصاب ساخته‌شده و انتصاب قبلی را برمی‌گرداند (برای برگشت از تایید حکم).
 */
export async function changeAssignment(
  tx: Tx,
  employeeId: number,
  a: AssignmentInput,
  fromDate: Date
): Promise<{ appliedId: number; previousId: number | null }> {
  const open = await tx.employeeAssignment.findFirst({ where: { employeeId, toDate: null } });
  if (open) {
    if (fromDate <= open.fromDate) throw new HrError("تاریخ انتصاب جدید باید بعد از شروع انتصاب فعلی باشد");
    const prev = new Date(fromDate.getTime() - 86400000);
    await tx.employeeAssignment.update({ where: { id: open.id }, data: { toDate: prev } });
  }
  const created = await tx.employeeAssignment.create({
    data: {
      employeeId,
      positionId: Number(a.positionId),
      orgUnitId: Number(a.orgUnitId),
      costCenterId: a.costCenterId ? Number(a.costCenterId) : null,
      jobId: a.jobId ? Number(a.jobId) : null,
      fromDate,
    },
  });
  await tx.position.update({ where: { id: Number(a.positionId) }, data: { hasTransactions: true } });
  return { appliedId: created.id, previousId: open?.id ?? null };
}
