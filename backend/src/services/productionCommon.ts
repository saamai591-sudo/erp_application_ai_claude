import { Prisma } from "@prisma/client";

// ماژول تولید: خطا و ابزارهای مشترک (طرح: Documents/طرح ماژول تولید.md)

export class ProductionError extends Error {}
export const fail = (message: string): never => {
  throw new ProductionError(message);
};

/** نوع کالای گروه حسابداری که «کالای تولیدی» حساب می‌شود (خروجی BOM / قیمت‌گذاری با بهای تمام‌شده) */
export const PRODUCED_TYPES = ["SEMI_FINISHED", "PRODUCT"];
export const isProducedType = (goodsType: string | null | undefined) => !!goodsType && PRODUCED_TYPES.includes(goodsType);

export const D = (v: unknown) => new Prisma.Decimal(v === null || v === undefined || v === "" ? 0 : (v as any));
export const num = (v: unknown) => Number(v ?? 0);

/** «YYYY-MM-DD» (میلادی، همان قالب API) → Date در ساعت صفر UTC */
export function parseDay(input: unknown, label: string): Date {
  const s = String(input ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return fail(`${label} نامعتبر است`);
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return fail(`${label} نامعتبر است`);
  return d;
}
export const isoDay = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

/** مقدار مثبت با حداکثر ۱۰ رقم اعشار */
export function positive(v: unknown, label: string): Prisma.Decimal {
  const x = Number(v);
  if (!Number.isFinite(x) || x <= 0) return fail(`${label} باید بزرگ‌تر از صفر باشد`);
  return D(v);
}

/** پاسخ خطا برای مسیرها: خطای ماژول ۴۰۰، بقیه هم با همان پیام */
export function sendError(res: any, e: any, fallback: string) {
  if (e?.code === "P2002") return res.status(400).json({ error: "مقدار تکراری است" });
  return res.status(400).json({ error: e instanceof ProductionError ? e.message : e?.message || fallback });
}

export { roundToCurrencyDecimals as round } from "../utils/currencyConversion";
