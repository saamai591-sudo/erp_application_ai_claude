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
