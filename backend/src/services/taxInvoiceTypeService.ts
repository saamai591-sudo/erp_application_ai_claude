import { prisma } from "../lib/prisma";
import { formatJalaliDateForMessage } from "../utils/jalaliDate";

// «قواعد نوع صورتحساب» (امور مالیاتی › تنظیمات): تعیین نوع ۱ یا ۲ صورتحساب مالیاتی از روی منبع داده و مشخصات خریدار.
// هر مجموعه = یک منبع داده + تاریخ اجرا + چند قاعده. شرط خالی = «هر چه باشد». قواعد یک مجموعه نباید هم‌پوشانی داشته باشند
// (قاعده‌ی کلی‌تر زیرمجموعه‌اش را مسدود می‌کند) پس هر فاکتور حداکثر با یک قاعده منطبق می‌شود؛ بدون قاعده منطبق = خطا، نه نوع پیش‌فرض.
// تنها محل تشخیص نوع: resolveTaxInvoiceType (فرم ارسال، ارسال و کار زمان‌بندی‌شده هر سه از همین استفاده می‌کنند).

export class TaxTypeRuleError extends Error {
  details?: Record<string, unknown>[];
}
const fail = (msg: string): never => {
  throw new TaxTypeRuleError(msg);
};

export const TAX_SOURCES: { key: "SALES_INVOICE" | "STORE_SALE"; title: string }[] = [
  { key: "SALES_INVOICE", title: "فاکتور فروش" },
  { key: "STORE_SALE", title: "فروش فروشگاهی" },
];
const SOURCE_KEYS = new Set(TAX_SOURCES.map((s) => s.key as string));
const BUYER_FA: Record<string, string> = { INDIVIDUAL: "حقیقی", LEGAL: "حقوقی" };

const day = (d: Date) => d.toISOString().slice(0, 10);
const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const hasEconomicCodeValue = (v: unknown) => /^\d{11}$|^\d{14}$/.test(digits(v));

export interface RuleInput {
  buyerKind: string | null;
  hasEconomicCode: boolean | null;
  salesCenterId: number | null;
  invoiceType: number;
}

function cleanRule(r: any, index: number): RuleInput {
  const buyerKind = r?.buyerKind ? String(r.buyerKind) : null;
  if (buyerKind !== null && buyerKind !== "INDIVIDUAL" && buyerKind !== "LEGAL") fail(`ردیف ${index + 1}: نوع خریدار نامعتبر است`);
  const hasEconomicCode = r?.hasEconomicCode === true || r?.hasEconomicCode === "true" ? true : r?.hasEconomicCode === false || r?.hasEconomicCode === "false" ? false : null;
  const salesCenterId = r?.salesCenterId ? Number(r.salesCenterId) : null;
  const invoiceType = Number(r?.invoiceType);
  if (invoiceType !== 1 && invoiceType !== 2) fail(`ردیف ${index + 1}: نوع صورتحساب باید ۱ یا ۲ باشد`);
  return { buyerKind, hasEconomicCode, salesCenterId, invoiceType };
}

/** هم‌پوشانی: در هر بُعد مقدارها برابر باشند یا یکی «هر چه باشد» (null) باشد */
function overlaps(a: RuleInput, b: RuleInput): boolean {
  const dim = (x: unknown, y: unknown) => x === null || y === null || x === y;
  return dim(a.buyerKind, b.buyerKind) && dim(a.hasEconomicCode, b.hasEconomicCode) && dim(a.salesCenterId, b.salesCenterId);
}

const RULE_INCLUDE = { rules: { include: { salesCenter: { select: { title: true } } }, orderBy: { id: "asc" as const } } };

function shape(s: any) {
  return {
    id: s.id,
    source: s.source,
    sourceTitle: TAX_SOURCES.find((x) => x.key === s.source)?.title ?? s.source,
    effectiveDate: s.effectiveDate,
    ruleCount: s.rules.length,
    rules: s.rules.map((r: any) => ({
      id: r.id,
      buyerKind: r.buyerKind,
      hasEconomicCode: r.hasEconomicCode,
      salesCenterId: r.salesCenterId,
      salesCenterTitle: r.salesCenter?.title ?? null,
      invoiceType: r.invoiceType,
    })),
  };
}

export async function listRuleSets() {
  const list = await prisma.taxInvoiceTypeRuleSet.findMany({ include: RULE_INCLUDE, orderBy: [{ source: "asc" }, { effectiveDate: "desc" }] });
  return list.map(shape);
}

export async function getRuleSet(id: number) {
  const s = await prisma.taxInvoiceTypeRuleSet.findUnique({ where: { id }, include: RULE_INCLUDE });
  return s ? shape(s) : null;
}

const describe = (r: RuleInput, centers: Map<number, string>) =>
  [r.buyerKind ? `خریدار ${BUYER_FA[r.buyerKind]}` : null, r.hasEconomicCode === null ? null : r.hasEconomicCode ? "دارای شناسه ملی/کد اقتصادی" : "بدون شناسه ملی/کد اقتصادی", r.salesCenterId ? `مرکز فروش «${centers.get(r.salesCenterId) ?? r.salesCenterId}»` : null]
    .filter(Boolean)
    .join("، ") || "همه‌ی حالت‌ها";

export async function saveRuleSet(id: number | null, body: { source?: string; effectiveDate?: string; rules?: unknown[] }) {
  const source = String(body.source ?? "");
  if (!SOURCE_KEYS.has(source)) fail("منبع داده نامعتبر است");
  const effectiveDate = new Date(String(body.effectiveDate ?? ""));
  if (!body.effectiveDate || Number.isNaN(effectiveDate.getTime())) fail("تاریخ اجرا نامعتبر است");
  const rules = (Array.isArray(body.rules) ? body.rules : []).map(cleanRule);
  if (!rules.length) fail("حداقل یک قاعده لازم است");

  // مراکز فروش موجود
  const centerIds = Array.from(new Set(rules.map((r) => r.salesCenterId).filter((x): x is number => !!x)));
  const centers = new Map((await prisma.salesCenter.findMany({ where: { id: { in: centerIds } }, select: { id: true, title: true } })).map((c) => [c.id, c.title]));
  for (const cid of centerIds) if (!centers.has(cid)) fail("مرکز فروش نامعتبر است");

  // بدون هم‌پوشانی
  const problems: Record<string, unknown>[] = [];
  for (let i = 0; i < rules.length; i += 1) {
    for (let j = i + 1; j < rules.length; j += 1) {
      if (overlaps(rules[i], rules[j])) {
        problems.push({ "ردیف": i + 1, "علت": `با ردیف ${j + 1} هم‌پوشانی دارد (${describe(rules[i], centers)} ⟷ ${describe(rules[j], centers)}؛ قاعده‌ی کلی‌تر زیرمجموعه‌اش را مسدود می‌کند)` });
      }
    }
  }
  if (problems.length) {
    const err = new TaxTypeRuleError("قواعد هم‌پوشانی دارند؛ هر فاکتور باید حداکثر با یک قاعده منطبق شود");
    err.details = problems;
    throw err;
  }

  const dup = await prisma.taxInvoiceTypeRuleSet.findFirst({ where: { source: source as any, effectiveDate, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
  if (dup) fail(`برای این منبع در تاریخ ${formatJalaliDateForMessage(effectiveDate)} قبلاً مجموعه‌ای ثبت شده است`);

  const rows = rules.map((r) => ({ buyerKind: r.buyerKind as any, hasEconomicCode: r.hasEconomicCode, salesCenterId: r.salesCenterId, invoiceType: r.invoiceType }));
  if (!id) return prisma.taxInvoiceTypeRuleSet.create({ data: { source: source as any, effectiveDate, rules: { create: rows } } });
  if (!(await prisma.taxInvoiceTypeRuleSet.findUnique({ where: { id }, select: { id: true } }))) return fail("مجموعه‌ی قواعد یافت نشد");
  return prisma.$transaction(async (tx) => {
    await tx.taxInvoiceTypeRule.deleteMany({ where: { setId: id } });
    return tx.taxInvoiceTypeRuleSet.update({ where: { id }, data: { source: source as any, effectiveDate, rules: { create: rows } } });
  });
}

export async function deleteRuleSet(id: number) {
  await prisma.taxInvoiceTypeRuleSet.delete({ where: { id } });
}

export type ResolvedTaxType = { type: 1 | 2; error: null } | { type: null; error: string };

/** فاکتور فروش با مشتری (party) و مرکز فروش */
interface InvoiceLike {
  date: Date;
  salesCenterId: number;
  customer: { party: { category: string; economicCode: string | null; nationalId: string | null } };
}

/**
 * نوع صورتحساب مالیاتی یک فاکتور: مجموعه‌ی مؤثر منبع در تاریخ فاکتور (آخرین تاریخ اجرای ≤ تاریخ فاکتور) و قاعده‌ی منطبق.
 * مجموعه‌ی مؤثر یا قاعده‌ی منطبق نبود ⇒ error (هرگز نوع پیش‌فرض بی‌صدا).
 */
export async function resolveTaxInvoiceType(source: "SALES_INVOICE" | "STORE_SALE", inv: InvoiceLike): Promise<ResolvedTaxType> {
  const set = await prisma.taxInvoiceTypeRuleSet.findFirst({ where: { source, effectiveDate: { lte: inv.date } }, orderBy: { effectiveDate: "desc" }, include: { rules: true } });
  const srcTitle = TAX_SOURCES.find((s) => s.key === source)?.title ?? source;
  if (!set) return { type: null, error: `برای منبع «${srcTitle}» قاعده‌ی نوع صورتحساب در تاریخ ${formatJalaliDateForMessage(inv.date)} تعریف نشده است («قواعد نوع صورتحساب» در امور مالیاتی › تنظیمات)` };
  const party = inv.customer.party;
  const buyerKind = party.category === "INDIVIDUAL" ? "INDIVIDUAL" : "LEGAL";
  // حقوقی: شناسه ملی (۱۱ رقم) کافی است؛ حقیقی: کد اقتصادی (۱۱ یا ۱۴ رقم). کد اقتصادی معتبر برای هر دو کافی است
  const hasEco = hasEconomicCodeValue(party.economicCode) || (buyerKind === "LEGAL" && /^\d{11}$/.test(digits(party.nationalId)));
  const match = set.rules.filter((r) => (r.buyerKind === null || r.buyerKind === buyerKind) && (r.hasEconomicCode === null || r.hasEconomicCode === hasEco) && (r.salesCenterId === null || r.salesCenterId === inv.salesCenterId));
  if (match.length === 0) {
    return { type: null, error: `هیچ قاعده‌ای از «قواعد نوع صورتحساب» (${srcTitle}، از ${formatJalaliDateForMessage(set.effectiveDate)}) برای این فاکتور (خریدار ${BUYER_FA[buyerKind]}، ${hasEco ? "دارای" : "بدون"} شناسه ملی/کد اقتصادی) منطبق نشد؛ قاعده‌ی این حالت را تعریف کنید یا نوع را دستی انتخاب کنید` };
  }
  if (match.length > 1) return { type: null, error: "بیش از یک قاعده با این فاکتور منطبق شد (قواعد هم‌پوشان‌اند)؛ مجموعه‌ی قواعد را اصلاح کنید" };
  return { type: match[0].invoiceType === 2 ? 2 : 1, error: null };
}
