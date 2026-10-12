import { prisma } from "../lib/prisma";

// پارامترهای قانونی حقوق (تاریخ‌دار). تنها محل خواندن مقدار برای محاسبات: مقدار معتبر هر تاریخ = آخرین مقدار با تاریخ شروع ≤ آن تاریخ.
// ماژول محاسبه‌ی حقوق (و فرمول‌ها) فقط از getParameterValue/getParameterValues می‌خوانند، نه مستقیم از جدول‌ها.

export interface Bracket {
  from: number;
  to: number | null;
  rate: number;
}

export interface ParameterValue {
  parameterId: number;
  key: string;
  type: "NUMBER" | "PERCENT" | "AMOUNT" | "BRACKETS";
  effectiveDate: Date;
  isProvisional: boolean;
  value: number | null;
  brackets: Bracket[];
}

const toDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

function shape(p: { id: number; key: string; type: any }, v: any): ParameterValue {
  return {
    parameterId: p.id,
    key: p.key,
    type: p.type,
    effectiveDate: v.effectiveDate,
    isProvisional: v.isProvisional,
    value: v.value === null ? null : Number(v.value),
    brackets: (v.brackets ?? []).map((b: any) => ({ from: Number(b.fromAmount), to: b.toAmount === null ? null : Number(b.toAmount), rate: Number(b.rate) })),
  };
}

/** مقدار معتبر یک پارامتر در تاریخ؛ null = پارامتر مقداری برای آن تاریخ ندارد (فراخواننده باید خطای روشن بدهد) */
export async function getParameterValue(key: string, onDate: Date): Promise<ParameterValue | null> {
  const p = await prisma.payrollParameter.findUnique({ where: { key } });
  if (!p) throw new Error(`پارامتر قانونی ${key} تعریف نشده است`);
  const v = await prisma.payrollParameterValue.findFirst({
    where: { parameterId: p.id, effectiveDate: { lte: toDay(onDate) } },
    orderBy: { effectiveDate: "desc" },
    include: { brackets: { orderBy: { position: "asc" } } },
  });
  return v ? shape(p, v) : null;
}

/** مقدار معتبر چند پارامتر (یا همه‌ی فعال‌ها) در یک تاریخ، با یک رفت‌وبرگشت */
export async function getParameterValues(onDate: Date, keys?: string[]): Promise<Map<string, ParameterValue | null>> {
  const params = await prisma.payrollParameter.findMany({ where: keys ? { key: { in: keys } } : { isActive: true } });
  const d = toDay(onDate);
  const values = await prisma.payrollParameterValue.findMany({
    where: { parameterId: { in: params.map((p) => p.id) }, effectiveDate: { lte: d } },
    orderBy: { effectiveDate: "desc" },
    include: { brackets: { orderBy: { position: "asc" } } },
  });
  const out = new Map<string, ParameterValue | null>();
  for (const p of params) {
    const v = values.find((x) => x.parameterId === p.id);
    out.set(p.key, v ? shape(p, v) : null);
  }
  return out;
}

/**
 * قفل مقدارها: هر «گردش» که مقدار پارامتر را مصرف کرده باشد یک ورودی اضافه می‌کند (مثل SALES_INVOICE_ADVANCE_LOCKS)؛
 * check پیام قفل را برمی‌گرداند یا null. فعلاً محاسبه‌ی حقوقی وجود ندارد، پس خالی است.
 */
export const PARAMETER_VALUE_LOCKS: { key: string; check: (valueId: number) => Promise<string | null> }[] = [];

export async function assertParameterValueNotLocked(valueId: number): Promise<void> {
  for (const l of PARAMETER_VALUE_LOCKS) {
    const msg = await l.check(valueId);
    if (msg) throw new Error(msg);
  }
}
