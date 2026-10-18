import { prisma } from "../lib/prisma";

// پارامترهای مبنا حقوق (تاریخ‌دار). تنها محل خواندن مقدار برای محاسبات: مقدار معتبر هر تاریخ = آخرین مقدار با تاریخ شروع ≤ آن تاریخ.
// ماژول محاسبه‌ی حقوق (و فرمول‌ها) فقط از getParameterValue/getParameterValues می‌خوانند، نه مستقیم از جدول‌ها.

export interface Bracket {
  from: number;
  to: number | null;
  rate: number;
}

export interface ParameterValue {
  parameterId: number;
  key: string;
  type: "NUMBER" | "AMOUNT" | "BRACKETS";
  effectiveDate: Date;
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
    value: v.value === null ? null : Number(v.value),
    brackets: (v.brackets ?? []).map((b: any) => ({ from: Number(b.fromAmount), to: b.toAmount === null ? null : Number(b.toAmount), rate: Number(b.rate) })),
  };
}

/** مقدار معتبر یک پارامتر در تاریخ؛ null = پارامتر مقداری برای آن تاریخ ندارد (فراخواننده باید خطای روشن بدهد) */
export async function getParameterValue(key: string, onDate: Date): Promise<ParameterValue | null> {
  const p = await prisma.payrollParameter.findUnique({ where: { key } });
  if (!p) throw new Error(`پارامتر مبنا ${key} تعریف نشده است`);
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

const ymKey = (y: number, m: number) => y * 12 + (m - 1);

/** آخرین ماهِ محاسبه‌شده‌ی حقوق در کل سیستم (بیشترین سال/ماهِ فیش‌ها)؛ null = هنوز محاسبه‌ای نشده */
export async function lastCalculatedMonth(): Promise<{ year: number; month: number } | null> {
  const s = await prisma.payrollSlip.findFirst({ orderBy: [{ year: "desc" }, { month: "desc" }], select: { year: true, month: true } });
  return s ? { year: s.year, month: s.month } : null;
}

/**
 * «ماه اجرا»ی مجاز برای مقدار تازه یا تغییر ماه: باید بعد از آخرین ماهِ محاسبه‌شده باشد
 * (مقداری که پیش از آن ماه اجرا شود، نتیجه‌ی محاسبه‌های انجام‌شده را عوض می‌کند). null = مجاز.
 */
export async function execMonthBeforeLastCalculation(year: number, month: number): Promise<string | null> {
  const last = await lastCalculatedMonth();
  if (last && ymKey(year, month) <= ymKey(last.year, last.month)) {
    return `ماه اجرا باید بعد از آخرین ماهِ محاسبه‌شده‌ی حقوق (${MONTHS[last.month - 1]} ${last.year}) باشد؛ برای تغییر در ماه‌های قبل ابتدا محاسبه‌ها را حذف کنید`;
  }
  return null;
}

/** مقدارهای (تاریخ شروع) یک پارامتر که در فیش‌های محاسبه‌شده استفاده شده‌اند، با اولین ماهِ استفاده */
export async function usedValueDates(key: string): Promise<Map<string, { year: number; month: number }>> {
  const rows = await prisma.$queryRaw<{ d: string | null; ym: number }[]>`
    SELECT parameters -> ${key}::text ->> 'effectiveDate' AS d, MIN(year * 100 + month)::int AS ym
    FROM "PayrollSlip"
    WHERE (parameters -> ${key}::text) IS NOT NULL
    GROUP BY 1`;
  const out = new Map<string, { year: number; month: number }>();
  for (const r of rows) if (r.d) out.set(r.d, { year: Math.floor(r.ym / 100), month: r.ym % 100 });
  return out;
}

const MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];

/**
 * قفل مقدارها: هر «گردش» که مقدار پارامتر را مصرف کرده باشد یک ورودی اضافه می‌کند (مثل SALES_INVOICE_ADVANCE_LOCKS)؛
 * check پیام قفل را برمی‌گرداند یا null.
 * CALCULATION: مقداری که در فیشِ محاسبه‌شده‌ای به‌کار رفته (فیش تاریخ شروعِ مقدارِ استفاده‌شده را نگه می‌دارد) قابل ویرایش و حذف نیست؛
 * با حذف محاسبه‌ی آن ماه‌ها قفل خودکار آزاد می‌شود.
 */
export const PARAMETER_VALUE_LOCKS: { key: string; check: (valueId: number) => Promise<string | null> }[] = [
  {
    key: "CALCULATION",
    check: async (valueId) => {
      const v = await prisma.payrollParameterValue.findUnique({ where: { id: valueId }, include: { parameter: { select: { key: true, title: true } } } });
      if (!v) return null;
      const hit = (await usedValueDates(v.parameter.key)).get(v.effectiveDate.toISOString().slice(0, 10));
      return hit
        ? `این مقدار از پارامتر «${v.parameter.title}» در محاسبه‌ی حقوق (از ماه ${MONTHS[hit.month - 1]} ${hit.year}) استفاده شده و قابل ویرایش یا حذف نیست؛ ابتدا محاسبه‌های مربوط را حذف کنید`
        : null;
    },
  },
];

export async function assertParameterValueNotLocked(valueId: number): Promise<void> {
  for (const l of PARAMETER_VALUE_LOCKS) {
    const msg = await l.check(valueId);
    if (msg) throw new Error(msg);
  }
}
