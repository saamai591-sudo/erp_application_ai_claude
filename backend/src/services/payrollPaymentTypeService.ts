import { prisma } from "../lib/prisma";

// حقوق و دستمزد › تنظیمات › نوع پرداخت حقوق: سربرگ (کد، عنوان، فعال، پرداخت به: پرسنل / سازمان مرتبط با عامل [+ سازمان]، فایل دارد) + آیتم‌ها (عامل).
// عاملِ آیتم یکی از این‌هاست: عامل حقوقِ طبقه‌ی «کسور» یا «هزینه کارفرما»، «وام» (نوع وام)، یا «خالص پرداختی» (هر نوع محاسبه).
// تمام قواعد این‌جاست؛ روت فقط صدا می‌زند.

export class PayTypeError extends Error {}

export type PayItemField = "payrollComponentId" | "loanTypeId" | "netCalcTypeId";
export const PAYABLE_KINDS = ["DEDUCTION", "EMPLOYER_COST"] as const;
const KIND_FA: Record<string, string> = { DEDUCTION: "کسر", EMPLOYER_COST: "هزینه کارفرما" };

export interface PayRef {
  key: string; // P:<id> | L:<id> | N:<id>
  field: PayItemField;
  /** شناسه‌ی عامل/نوع وام/نوع محاسبه (فرم آن را به‌صورت { [field]: refId } می‌فرستد) */
  refId: number;
  type: string; // طبقه / نوع مرجع برای نمایش
  title: string;
  calcTypeTitle: string;
}

/** گزینه‌های انتخابگر عامل: کسور و هزینه کارفرما + وام‌ها + خالص پرداختی هر نوع محاسبه؛ با عنوان عامل و نوع محاسبه */
export async function loadPayRefOptions(): Promise<PayRef[]> {
  const [comps, loanTypes, calcTypes] = await Promise.all([
    prisma.payrollComponent.findMany({ where: { kind: { in: [...PAYABLE_KINDS] }, isActive: true }, orderBy: { id: "asc" }, select: { id: true, title: true, kind: true, calcType: { select: { title: true } } } }),
    prisma.loanType.findMany({ where: { isActive: true }, orderBy: { title: "asc" }, select: { id: true, title: true } }),
    prisma.payrollCalcType.findMany({ orderBy: [{ isBase: "desc" }, { id: "asc" }], select: { id: true, title: true, isBase: true } }),
  ]);
  const base = calcTypes.find((c) => c.isBase);
  return [
    ...comps.map((c) => ({ key: `P:${c.id}`, field: "payrollComponentId" as const, refId: c.id, type: KIND_FA[c.kind] ?? c.kind, title: c.title, calcTypeTitle: c.calcType.title })),
    // اقساط وام فقط در حقوق ماهانه می‌آید
    ...loanTypes.map((l) => ({ key: `L:${l.id}`, field: "loanTypeId" as const, refId: l.id, type: "وام", title: l.title, calcTypeTitle: base?.title ?? "" })),
    ...calcTypes.map((c) => ({ key: `N:${c.id}`, field: "netCalcTypeId" as const, refId: c.id, type: "خالص پرداختی", title: "خالص پرداختی", calcTypeTitle: c.title })),
  ];
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().replace(/\s+/g, " ") : null);

export interface PayTypeData {
  code?: number;
  title: string;
  isActive: boolean;
  payTo: "EMPLOYEE" | "FACTOR_ORG";
  beneficiaryOrgId: number | null;
  hasFile: boolean;
  items: { field: PayItemField; refId: number }[];
}

/** بدنه‌ی فرم → داده‌ی ذخیره (همه‌ی کنترل‌ها؛ ویرایش با excludeId) */
export async function validatePaymentType(b: any, excludeId?: number): Promise<PayTypeData> {
  const title = str(b.title);
  if (!title) throw new PayTypeError("عنوان الزامی است");
  if (await prisma.payrollPaymentType.findFirst({ where: { title, ...(excludeId ? { NOT: { id: excludeId } } : {}) } })) throw new PayTypeError("نوع پرداخت دیگری با همین عنوان وجود دارد");

  let code: number | undefined;
  if (b.code !== undefined && b.code !== null && b.code !== "") {
    code = Number(b.code);
    if (!Number.isInteger(code) || code < 1) throw new PayTypeError("کد باید عدد صحیح مثبت باشد");
    if (await prisma.payrollPaymentType.findFirst({ where: { code, ...(excludeId ? { NOT: { id: excludeId } } : {}) } })) throw new PayTypeError("کد تکراری است");
  }

  const payTo = b.payTo;
  if (payTo !== "EMPLOYEE" && payTo !== "FACTOR_ORG") throw new PayTypeError("«پرداخت به» را انتخاب کنید (پرسنل یا سازمان مرتبط با عامل)");
  let beneficiaryOrgId: number | null = null;
  if (payTo === "FACTOR_ORG") {
    const org = b.beneficiaryOrgId ? await prisma.beneficiaryOrg.findUnique({ where: { id: Number(b.beneficiaryOrgId) } }) : null;
    if (!org) throw new PayTypeError("سازمان مرتبط با عامل را انتخاب کنید");
    beneficiaryOrgId = org.id;
  }

  const raw = Array.isArray(b.items) ? b.items : [];
  if (raw.length === 0) throw new PayTypeError("دست‌کم یک عامل در آیتم‌ها لازم است");
  const items: PayTypeData["items"] = [];
  const seen = new Set<string>();
  for (const it of raw) {
    const chosen = (["payrollComponentId", "loanTypeId", "netCalcTypeId"] as const).filter((f) => it[f] !== undefined && it[f] !== null && it[f] !== "");
    if (chosen.length !== 1) throw new PayTypeError("برای هر ردیف یک عامل انتخاب کنید");
    const field = chosen[0];
    const refId = Number(it[field]);
    const key = `${field}:${refId}`;
    if (seen.has(key)) throw new PayTypeError("یک عامل بیش از یک‌بار آمده است");
    seen.add(key);
    if (field === "payrollComponentId") {
      const c = await prisma.payrollComponent.findUnique({ where: { id: refId }, select: { title: true, kind: true } });
      if (!c) throw new PayTypeError("عامل حقوق یافت نشد");
      if (!(PAYABLE_KINDS as readonly string[]).includes(c.kind)) throw new PayTypeError(`عامل «${c.title}» از طبقه‌ی کسور یا هزینه کارفرما نیست`);
    } else if (field === "loanTypeId") {
      if (!(await prisma.loanType.findUnique({ where: { id: refId } }))) throw new PayTypeError("نوع وام یافت نشد");
    } else if (!(await prisma.payrollCalcType.findUnique({ where: { id: refId } }))) throw new PayTypeError("نوع محاسبه یافت نشد");
    items.push({ field, refId });
  }
  if (excludeId && (await prisma.payrollPaymentPrep.count({ where: { paymentTypeId: excludeId } })) > 0) {
    const cur = await prisma.payrollPaymentType.findUnique({ where: { id: excludeId }, include: { items: true } });
    const keyOf = (i: { field: string; refId: number }) => `${i.field}:${i.refId}`;
    const curKeys = new Set((cur?.items ?? []).map((i) => (i.payrollComponentId ? keyOf({ field: "payrollComponentId", refId: i.payrollComponentId }) : i.loanTypeId ? keyOf({ field: "loanTypeId", refId: i.loanTypeId }) : keyOf({ field: "netCalcTypeId", refId: i.netCalcTypeId! }))));
    const newKeys = new Set(items.map(keyOf));
    if (!cur || cur.payTo !== payTo || cur.beneficiaryOrgId !== beneficiaryOrgId || cur.hasFile !== !!b.hasFile || curKeys.size !== newKeys.size || [...curKeys].some((k) => !newKeys.has(k)))
      throw new PayTypeError("این نوع پرداخت در «آماده‌سازی پرداخت» استفاده شده است؛ فقط عنوان و فعال/غیرفعال‌بودن قابل تغییر است");
  }
  return { code, title, isActive: b.isActive === undefined ? true : !!b.isActive, payTo, beneficiaryOrgId, hasFile: !!b.hasFile, items };
}

export const itemCreateData = (it: { field: PayItemField; refId: number }) => ({ [it.field]: it.refId } as Record<PayItemField, number>);
