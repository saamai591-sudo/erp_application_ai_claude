import { prisma } from "../lib/prisma";
import { HrError } from "./employeeAssignmentService";

// منابع انسانی › سازمان ذینفع: قواعد مشترکِ شعبه و مشمولیت کارمند (تنها محل این قواعد؛ route سازمان/شعبه و فرم کارمند صدا می‌زنند).
//  • شعبه = یک شخص حقوقی؛ «کد کارگاه» (تامین اجتماعی) یا «شماره پرونده» (سایر)، ردیف پیمان/کارفرما/آدرس فقط برای تامین اجتماعی.
//  • مشمولیت کارمند: برای هر سازمانِ فعال باید صریحاً «مشمول» یا «غیرمشمول» مشخص شود (تعیین‌نشده ذخیره نمی‌شود)؛ مشمول ⇒ شعبه‌ی همان سازمان الزامی.

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export const BENEFICIARY_TYPES = ["SOCIAL_SECURITY", "TAX", "OTHER"] as const;
export type BeneficiaryType = (typeof BENEFICIARY_TYPES)[number];
export const BENEFICIARY_TYPE_FA: Record<BeneficiaryType, string> = { SOCIAL_SECURITY: "سازمان تامین اجتماعی", TAX: "سازمان امور مالیاتی", OTHER: "سایر" };

/** عنوان ترکیبیِ شعبه: «عنوان شعبه» + (در صورت وجود) ردیف پیمان */
export function branchLabel(partyTitle: string, contractRow: string | null | undefined): string {
  return contractRow ? `${partyTitle} (ردیف پیمان ${contractRow})` : partyTitle;
}

export interface BeneficiaryInput {
  organizationId: number;
  isIncluded: boolean;
  branchId: number | null;
}

/** وضعیت مشمولیت ذخیره‌شده‌ی یک کارمند (برای جزئیات کارمند) */
export async function loadEmployeeBeneficiaries(employeeId: number, db: typeof prisma | Tx = prisma) {
  const rows = await db.employeeBeneficiary.findMany({ where: { employeeId }, select: { organizationId: true, isIncluded: true, branchId: true } });
  return rows.map((r) => ({ organizationId: r.organizationId, isIncluded: r.isIncluded, branchId: r.branchId }));
}

/**
 * ذخیره‌ی مشمولیت کارمند (جایگزینی کامل برای سازمان‌های فعال): هر سازمان فعال باید یک ردیف با isIncluded صریح (true/false) داشته باشد؛
 * مشمول ⇒ شعبه‌ی فعالِ همان سازمان (یا همان شعبه‌ی قبلیِ ذخیره‌شده اگر بعداً غیرفعال شده)؛ غیرمشمول ⇒ بدون شعبه.
 * ردیف سازمان‌های غیرفعال دست نمی‌خورد. `raw === undefined` یعنی «بدون تغییر» (ورود از اکسل).
 */
export async function saveEmployeeBeneficiaries(tx: Tx, employeeId: number, raw: unknown): Promise<void> {
  if (raw === undefined) return;
  if (!Array.isArray(raw)) throw new HrError("فهرست مشمولیت سازمان‌های ذینفع نامعتبر است");
  const orgs = await tx.beneficiaryOrg.findMany({ where: { isActive: true }, select: { id: true, title: true } });
  const existing = await tx.employeeBeneficiary.findMany({ where: { employeeId } });
  const byOrg = new Map<number, any>();
  for (const r of raw as any[]) {
    const orgId = Number(r?.organizationId);
    if (byOrg.has(orgId)) throw new HrError("یک سازمان ذینفع بیش از یک‌بار آمده است");
    byOrg.set(orgId, r);
  }
  const data: BeneficiaryInput[] = [];
  for (const o of orgs) {
    const r = byOrg.get(o.id);
    if (!r || typeof r.isIncluded !== "boolean") throw new HrError(`برای سازمان «${o.title}» مشمول یا غیرمشمول بودن را انتخاب کنید`);
    if (r.isIncluded) {
      const branchId = Number(r.branchId);
      if (!branchId) throw new HrError(`برای سازمان «${o.title}» شعبه را انتخاب کنید`);
      const b = await tx.beneficiaryBranch.findUnique({ where: { id: branchId } });
      if (!b || b.organizationId !== o.id) throw new HrError(`شعبه‌ی انتخاب‌شده متعلق به سازمان «${o.title}» نیست`);
      const prev = existing.find((e) => e.organizationId === o.id);
      if (!b.isActive && prev?.branchId !== b.id) throw new HrError(`شعبه‌ی انتخاب‌شده برای سازمان «${o.title}» غیرفعال است`);
      data.push({ organizationId: o.id, isIncluded: true, branchId });
    } else {
      data.push({ organizationId: o.id, isIncluded: false, branchId: null });
    }
  }
  for (const d of data) {
    await tx.employeeBeneficiary.upsert({
      where: { employeeId_organizationId: { employeeId, organizationId: d.organizationId } },
      create: { employeeId, ...d },
      update: { isIncluded: d.isIncluded, branchId: d.branchId },
    });
  }
}
