import { prisma } from "../lib/prisma";

async function titleForEntity(entityTable: string, entityId: number): Promise<string> {
  switch (entityTable) {
    case "Party": {
      const p = await prisma.party.findUnique({ where: { id: entityId } });
      if (!p) return "—";
      return p.category === "INDIVIDUAL" ? `${p.firstName} ${p.lastName}` : p.name || "—";
    }
    case "CashBox": {
      const c = await prisma.cashBox.findUnique({ where: { id: entityId } });
      return c?.title || "—";
    }
    case "BankAccount": {
      const b = await prisma.bankAccount.findUnique({ where: { id: entityId } });
      return b ? `حساب ${b.accountNumber}` : "—";
    }
    case "CostCenter": {
      const cc = await prisma.costCenter.findUnique({ where: { id: entityId } });
      return cc?.title || "—";
    }
    case "Project": {
      const p = await prisma.project.findUnique({ where: { id: entityId } });
      return p?.title || "—";
    }
    case "FiscalPeriod": {
      const fp = await prisma.fiscalPeriod.findUnique({ where: { id: entityId } });
      return fp?.title || "—";
    }
    default:
      return "—";
  }
}

/** فهرست گزینه‌های قابل انتخاب برای یک نوع تفصیل خاص (برای دراپ‌داون ردیف سند) */
export async function getDetailOptions(detailTypeId: number): Promise<{ code: string; title: string }[]> {
  const usages = await prisma.detailCodeUsage.findMany({ where: { detailTypeId }, orderBy: { code: "asc" } });
  const options = await Promise.all(
    usages.map(async (u: any) => ({ code: u.code, title: await titleForEntity(u.entityTable, u.entityId) }))
  );
  return options;
}

/** عنوان قابل‌نمایش برای یک کد تفصیلی مشخص */
export async function resolveDetailTitle(code: string): Promise<string | null> {
  const usage = await prisma.detailCodeUsage.findUnique({ where: { code } });
  if (!usage) return null;
  return titleForEntity(usage.entityTable, usage.entityId);
}

/** رزولوشن یک کد تفصیلی به رکورد واقعی‌اش، با اطمینان از اینکه از نوع موجودیت مورد انتظار است
 * (مثلاً کد وارد شده برای «طرف مقابل» باید واقعاً به یک Party اشاره کند، نه CostCenter/Project) */
export async function resolveDetailEntity(
  code: string,
  expectedTable: "Party" | "CostCenter" | "Project"
): Promise<{ id: number } | null> {
  const usage = await prisma.detailCodeUsage.findUnique({ where: { code } });
  if (!usage || usage.entityTable !== expectedTable) return null;
  return { id: usage.entityId };
}

/** نسخه‌ی دسته‌ای resolveDetailEntity، برای صفحات فهرست که چندین کد تفصیلی را یکجا باید به شناسه‌ی
 * موجودیت واقعی‌شان تبدیل کنند (یک کوئری به‌جای N کوئری) — خروجی: نگاشت code → entityId */
export async function resolveDetailEntityIds(
  codes: (string | null | undefined)[],
  expectedTable: "Party" | "CostCenter" | "Project"
): Promise<Record<string, number>> {
  const uniqueCodes = Array.from(new Set(codes.filter((c): c is string => !!c)));
  if (uniqueCodes.length === 0) return {};
  const usages = await prisma.detailCodeUsage.findMany({ where: { code: { in: uniqueCodes }, entityTable: expectedTable } });
  const result: Record<string, number> = {};
  for (const u of usages) result[u.code] = u.entityId;
  return result;
}

export async function resolveDetailTitles(codes: (string | null)[]): Promise<Record<string, string>> {
  const uniqueCodes = Array.from(new Set(codes.filter((c): c is string => !!c)));
  const result: Record<string, string> = {};
  await Promise.all(
    uniqueCodes.map(async (code) => {
      const title = await resolveDetailTitle(code);
      if (title) result[code] = title;
    })
  );
  return result;
}

/** یک کد تفصیلی مشخص را به detailTypeId آن تبدیل می‌کند (برای تشخیص این‌که یک تفصیل از کدام نوع است،
 * بدون نیاز به دانستن جدول موجودیت آن) — نگاه کنید به resolveAccountDetailFields */
export async function resolveDetailTypeId(code: string | null): Promise<number | null> {
  if (!code) return null;
  const usage = await prisma.detailCodeUsage.findUnique({ where: { code } });
  return usage?.detailTypeId ?? null;
}

/** اگر یک معین، در یکی از سه اسلات تفصیل خودش (detailType1/2/3Id)، به نوع تفصیلِ داده‌شده وصل باشد،
 * کدِ تفصیل را در همان اسلات می‌گذارد — دقیقاً همان قاعده‌ی «سند حسابداری» در چند جریان مختلف
 * (صدور سند اسناد انبار، صدور سند فاکتور خرید): وصل‌بودن به نوع تفصیل تشخیص می‌دهد کدام اسلات، نه
 * ترتیب ثابت detail1/2/3. */
export function resolveAccountDetailFields(
  account: { detailType1Id: number | null; detailType2Id: number | null; detailType3Id: number | null },
  detailTypeId: number | null,
  code: string | null
): { detail1Code?: string; detail2Code?: string; detail3Code?: string } {
  if (!code || detailTypeId == null) return {};
  if (account.detailType1Id === detailTypeId) return { detail1Code: code };
  if (account.detailType2Id === detailTypeId) return { detail2Code: code };
  if (account.detailType3Id === detailTypeId) return { detail3Code: code };
  return {};
}
