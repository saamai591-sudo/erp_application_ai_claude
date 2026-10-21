import { NextFunction, Response, Router } from "express";
import { prisma } from "../lib/prisma";
import { can, userHasAction } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { AuthedRequest } from "../middleware/auth";
import type { BranchInput } from "../services/payrollCalculationService";
import { METHOD_FA, PayrollCalcError, calculatePayroll, validateFactorMethod, methodLockMessage, lockedMethodIds, getBaseCalcType, dependentSlipMessage, createPayrollComponent } from "../services/payrollCalculationService";
import { getEffectiveDecrees } from "../services/employmentDecreeService";
import { buildPayrollSlipsPrint } from "../services/payrollSlipPrint";
import { buildPayrollListPrint } from "../services/payrollListPrint";
import { jalaliMonthRange } from "../utils/jalaliDate";
import { getCalendarMonth, missingMonthMessage } from "../services/workCalendarService";
import { basisRows, resolveBasisDecisions } from "../services/payrollBasisService";
import { BASE_INFO, DECREE_VARIANTS, FACTOR_VARIANTS, KIND_FA, LOAN_SUM_KEY, LOAN_SUM_LABEL } from "../services/payrollFormula";
import { employeeIdsInPeriod } from "../services/employmentStatusService";
import { slipJournalLockMessage } from "../services/payrollAccountingService";
import { slipPrepLockMessage } from "../services/payrollPaymentPrepService";

// حقوق و دستمزد: عامل‌های حقوق (هویت)، «روش محاسبه عامل» (تاریخ‌دار با ماه اجرا؛ مبنا = عامل حکم یا عامل حقوق)، ورودی ماهانه‌ی عوامل،
// محاسبه‌ی فیش یک کارمند و جزئیات آن برای گزارش.

const F_TYPE = findFormPrefix("calculation-types");
const F_COMP = findFormPrefix("payroll-components");
const F_METH = findFormPrefix("factor-methods");
const F_CALC = findFormPrefix("payroll-calculation");
const F_REPORT = findFormPrefix("payroll-calculation-report");

const router = Router();

/** شاخه‌های بدنه → رشته‌های تمیز (شرط خالی = null)؛ شاخه‌ی کاملاً خالی نادیده گرفته می‌شود */
function cleanBranches(raw: unknown): BranchInput[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x: any) => ({ conditionText: str(x?.conditionText), formulaText: str(x?.formulaText) ?? "" }))
    .filter((x) => x.conditionText || x.formulaText);
}
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const str = (v: unknown) => {
  const t = typeof v === "string" ? v.trim() : "";
  return t || null;
};
const KINDS = ["WORK", "EARNING", "DEDUCTION", "EMPLOYER_COST", "INFO"];
const METHODS = ["CALCULATED", "MANUAL", "ATTENDANCE", "TREASURY"];
const VALUE_TYPES = ["NUMBER", "TIME", "DAYS", "AMOUNT"];

function fail(res: Response, e: any, fallback: string) {
  if (e instanceof PayrollCalcError) return res.status(400).json({ error: e.message });
  if (e?.code === "P2002") return res.status(400).json({ error: "برای این عامل با همین ماه اجرا قبلاً روشی ثبت شده است" });
  return res.status(400).json({ error: e?.message || fallback });
}

/** دسترسی به داده‌ی حقوقی: هر یک از کلیدها کافی است (فرم محاسبه یا گزارش) */
function canAny(...keys: string[]) {
  for (const k of keys) can(k); // کلید ثبت‌نشده در بوت خطا می‌دهد
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "توکن احراز هویت ارسال نشده است" });
    for (const k of keys) if (await userHasAction(req.user.id, k)) return next();
    return res.status(403).json({ error: "دسترسی لازم برای این عملیات را ندارید" });
  };
}

// ════════════ نوع محاسبه ════════════
// حقوق ماهانه = نوع پایه (دقیقاً یکی، غیرقابل حذف)؛ انواع دیگر (عیدی، ذخیره سنوات، …) را کاربر تعریف می‌کند.
// یک نوع تا وقتی عامل یا فیشی به آن وصل است حذف نمی‌شود.
router.get("/payroll-calc-types", async (_req, res) => {
  // فهرست مرجع برای انتخابگرها (بدون کلید دسترسی جدا؛ فقط ورود به سیستم) — فرم‌های محاسبه/ورود اطلاعات/عامل از آن استفاده می‌کنند
  const rows = await prisma.payrollCalcType.findMany({ orderBy: [{ isBase: "desc" }, { id: "asc" }], include: { _count: { select: { components: true, slips: true } } } });
  res.json(rows.map((t) => ({ id: t.id, title: t.title, description: t.description, isBase: t.isBase, isActive: t.isActive, componentCount: t._count.components, slipCount: t._count.slips })));
});

router.post("/payroll-calc-types", can(`${F_TYPE}.create`), async (req, res) => {
  const b = req.body as any;
  try {
    const title = str(b.title);
    if (!title) throw new PayrollCalcError("عنوان الزامی است");
    if (await prisma.payrollCalcType.findFirst({ where: { title } })) throw new PayrollCalcError("نوع محاسبه‌ی دیگری با همین عنوان وجود دارد");
    // نوع پایه فقط همان «حقوق ماهانه»ی seed است؛ نوع جدید همیشه غیرپایه
    const created = await prisma.payrollCalcType.create({ data: { title, description: str(b.description), isActive: b.isActive ?? true } });
    res.status(201).json({ id: created.id });
  } catch (e) {
    fail(res, e, "خطا در ثبت نوع محاسبه");
  }
});

router.put("/payroll-calc-types/:id", can(`${F_TYPE}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body as any;
  try {
    const t = await prisma.payrollCalcType.findUnique({ where: { id } });
    if (!t) return res.status(404).json({ error: "نوع محاسبه یافت نشد" });
    const title = str(b.title);
    if (!title) throw new PayrollCalcError("عنوان الزامی است");
    if (await prisma.payrollCalcType.findFirst({ where: { title, NOT: { id } } })) throw new PayrollCalcError("نوع محاسبه‌ی دیگری با همین عنوان وجود دارد");
    if (t.isBase && b.isActive === false) throw new PayrollCalcError("نوع پایه (حقوق ماهانه) را نمی‌شود غیرفعال کرد");
    await prisma.payrollCalcType.update({ where: { id }, data: { title, description: str(b.description), isActive: t.isBase ? true : b.isActive ?? t.isActive } });
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در ویرایش نوع محاسبه");
  }
});

router.delete("/payroll-calc-types/:id", can(`${F_TYPE}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const t = await prisma.payrollCalcType.findUnique({ where: { id }, include: { _count: { select: { components: true, slips: true } } } });
  if (!t) return res.status(404).json({ error: "نوع محاسبه یافت نشد" });
  if (t.isBase) return res.status(400).json({ error: "نوع پایه (حقوق ماهانه) قابل حذف نیست" });
  if (t._count.components) return res.status(400).json({ error: "عامل حقوقی به این نوع وصل است و قابل حذف نیست" });
  if (t._count.slips) return res.status(400).json({ error: "برای این نوع محاسبه انجام شده است و قابل حذف نیست" });
  await prisma.payrollCalcType.delete({ where: { id } });
  res.status(204).send();
});

// ════════════ عامل حقوق (هویت) ════════════
router.get("/payroll-components", can(`${F_COMP}.view`), async (_req, res) => {
  const rows = await prisma.payrollComponent.findMany({ orderBy: { id: "asc" }, include: { methods: { orderBy: { execCalendarMonth: { startDate: "desc" } }, take: 1 }, calcType: { select: { title: true } }, beneficiaryOrg: { select: { title: true } } } });
  res.json(
    rows.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      isActive: c.isActive,
      method: c.methods[0]?.method ?? null,
      kind: c.kind,
      excludeFromSums: c.excludeFromSums,
      calcTypeId: c.calcTypeId,
      calcTypeTitle: c.calcType.title,
      beneficiaryOrgId: c.beneficiaryOrgId,
      beneficiaryOrgTitle: c.beneficiaryOrg?.title ?? null,
    }))
  );
});

router.post("/payroll-components", can(`${F_COMP}.create`), async (req, res) => {
  const b = req.body as any;
  try {
    const created = await createPayrollComponent({ title: str(b.title) ?? "", kind: b.kind, calcTypeId: Number(b.calcTypeId), description: str(b.description), isActive: b.isActive, excludeFromSums: b.excludeFromSums === true, beneficiaryOrgId: b.beneficiaryOrgId ? Number(b.beneficiaryOrgId) : null });
    res.status(201).json({ id: created.id });
  } catch (e) {
    fail(res, e, "خطا در ثبت عامل");
  }
});

router.put("/payroll-components/:id", can(`${F_COMP}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body as any;
  try {
    const c = await prisma.payrollComponent.findUnique({ where: { id } });
    if (!c) return res.status(404).json({ error: "عامل یافت نشد" });
    const title = str(b.title);
    if (!title) throw new PayrollCalcError("عنوان الزامی است");
    if (await prisma.payrollComponent.findFirst({ where: { title, NOT: { id } } })) throw new PayrollCalcError("عامل دیگری با همین عنوان وجود دارد");
    if (b.kind !== undefined && !KINDS.includes(b.kind)) throw new PayrollCalcError("طبقه نامعتبر است");
    // تغییر طبقه‌ی عاملی که در فیش‌ها استفاده شده جمع‌های قبلی را بی‌معنا می‌کند
    if (b.kind && b.kind !== c.kind && (await prisma.payrollSlipLine.count({ where: { source: "PAYROLL_COMPONENT", refId: id } }))) {
      throw new PayrollCalcError("این عامل در فیش‌های محاسبه‌شده استفاده شده و طبقه‌اش قابل تغییر نیست");
    }
    // «در جمع طبقه‌ها نیاید» نتیجه‌ی فرمول‌های جمع را عوض می‌کند؛ مثل طبقه، بعد از استفاده در فیش قابل تغییر نیست
    if (b.excludeFromSums !== undefined && !!b.excludeFromSums !== c.excludeFromSums && (await prisma.payrollSlipLine.count({ where: { source: "PAYROLL_COMPONENT", refId: id } }))) {
      throw new PayrollCalcError("این عامل در فیش‌های محاسبه‌شده استفاده شده و گزینه‌ی «در جمع طبقه‌ها نیاید» قابل تغییر نیست");
    }
    // سازمان ذینفع عامل بر مبلغ فیش اثر دارد (غیرمشمول = صفر)؛ بعد از استفاده در فیش قابل تغییر نیست
    let beneficiaryOrgId: number | null | undefined;
    if (b.beneficiaryOrgId !== undefined) {
      beneficiaryOrgId = b.beneficiaryOrgId ? Number(b.beneficiaryOrgId) : null;
      if (beneficiaryOrgId !== c.beneficiaryOrgId) {
        if (beneficiaryOrgId && !(await prisma.beneficiaryOrg.findUnique({ where: { id: beneficiaryOrgId } }))) throw new PayrollCalcError("سازمان ذینفع یافت نشد");
        if (await prisma.payrollSlipLine.count({ where: { source: "PAYROLL_COMPONENT", refId: id } })) throw new PayrollCalcError("این عامل در فیش‌های محاسبه‌شده استفاده شده و سازمان ذینفعش قابل تغییر نیست");
      }
    }
    // تغییر نوع محاسبه: فقط وقتی عامل در فیشی نیامده و فرمول عامل دیگری به آن ارجاع ندارد
    let calcTypeId: number | undefined;
    if (b.calcTypeId !== undefined && Number(b.calcTypeId) !== c.calcTypeId) {
      const nt = await prisma.payrollCalcType.findUnique({ where: { id: Number(b.calcTypeId) } });
      if (!nt) throw new PayrollCalcError("نوع محاسبه یافت نشد");
      if (await prisma.payrollSlipLine.count({ where: { source: "PAYROLL_COMPONENT", refId: id } })) throw new PayrollCalcError("این عامل در فیش‌های محاسبه‌شده استفاده شده و نوع محاسبه‌اش قابل تغییر نیست");
      const refText = `[C:${c.key}`;
      const users = (await prisma.payrollFactorMethod.findMany({ where: { NOT: { payrollComponentId: id } }, include: { branches: true } })).filter((m) =>
        m.branches.some((b) => b.formulaText.toUpperCase().includes(refText) || (b.conditionText ?? "").toUpperCase().includes(refText))
      );
      if (users.length) throw new PayrollCalcError("فرمول عامل‌های دیگر به این عامل ارجاع دارد؛ نوع محاسبه‌اش قابل تغییر نیست");
      calcTypeId = nt.id;
    }
    await prisma.payrollComponent.update({ where: { id }, data: { title, kind: b.kind ?? undefined, calcTypeId, description: str(b.description), isActive: b.isActive, excludeFromSums: b.excludeFromSums === undefined ? undefined : !!b.excludeFromSums, beneficiaryOrgId } });
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در ویرایش عامل");
  }
});

router.delete("/payroll-components/:id", can(`${F_COMP}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const c = await prisma.payrollComponent.findUnique({ where: { id } });
  if (!c) return res.status(404).json({ error: "عامل یافت نشد" });
  if (await prisma.payrollSlipLine.count({ where: { source: "PAYROLL_COMPONENT", refId: id } })) {
    return res.status(400).json({ error: "این عامل در فیش‌های محاسبه‌شده استفاده شده و قابل حذف نیست" });
  }
  const refText = `[C:${c.key}`;
  const users = (await prisma.payrollFactorMethod.findMany({ where: { NOT: { payrollComponentId: id } }, include: { branches: true } })).filter((m) =>
    m.branches.some((b) => b.formulaText.toUpperCase().includes(refText) || (b.conditionText ?? "").toUpperCase().includes(refText))
  );
  if (users.length) return res.status(400).json({ error: "فرمول عامل‌های دیگر به این عامل ارجاع دارد" });
  await prisma.payrollComponent.delete({ where: { id } });
  res.status(204).send();
});

// ════════════ روش محاسبه عامل ════════════
// ماه صدور و ماه اجرا (هر دو اجباری) فقط به‌صورت ارجاع به ردیف تقویم کاری ذخیره می‌شود؛ سال/ماه/تاریخِ پاسخ از همان ردیف می‌آید.
const methodMonthInclude = {
  execCalendarMonth: { select: { year: true, month: true, startDate: true } },
  issueCalendarMonth: { select: { year: true, month: true, startDate: true } },
} as const;
const execYm = (m: any): { year: number; month: number } => m.execCalendarMonth;
const shapeMethod = (m: any, today: Date) => ({
  id: m.id,
  basis: m.decreeComponentId ? "decree" : "payroll",
  factorId: m.decreeComponentId ?? m.payrollComponentId,
  factorTitle: m.decreeComponent?.title ?? m.payrollComponent?.title ?? "",
  method: m.method,
  valueType: m.valueType,
  issueYear: m.issueCalendarMonth.year,
  issueMonth: m.issueCalendarMonth.month,
  execYear: execYm(m).year,
  execMonth: execYm(m).month,
  /** شاخه‌های «شرط ← فرمول» به ترتیب اولویت (روش غیرمحاسباتی: خالی) */
  branches: (m.branches ?? []).map((b: any) => ({ conditionText: b.conditionText ?? "", formulaText: b.formulaText })),
  isProvisional: m.isProvisional,
  /** مبناهایی که این روش (عامل) عضو آن‌هاست */
  basisIds: (m.bases ?? []).filter((b: any) => b.effective).map((b: any) => b.parameterId) as number[],
  /** مبناهایی که کاربر آگاهانه «بدون تأثیر» تعیین کرده (مبنای بدون هیچ‌کدام از دو فهرست = تعیین‌نشده) */
  noEffectBasisIds: (m.bases ?? []).filter((b: any) => !b.effective).map((b: any) => b.parameterId) as number[],
  isCurrent: false as boolean,
  _eff: m.execCalendarMonth.startDate as Date,
  _today: today,
});

router.get("/payroll-methods", can(`${F_METH}.view`), async (_req, res) => {
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  const rows = await prisma.payrollFactorMethod.findMany({
    include: { decreeComponent: { select: { title: true } }, payrollComponent: { select: { title: true } }, branches: { orderBy: { seq: "asc" } }, bases: { select: { parameterId: true, effective: true } }, ...methodMonthInclude },
    orderBy: [{ execCalendarMonth: { startDate: "desc" } }, { id: "desc" }],
  });
  // «جاری» = آخرین رکورد هر عامل با تاریخ اجرای ≤ امروز
  const cur = new Set<string>();
  const locked = await lockedMethodIds();
  const out = rows.map((m) => {
    const s = { ...shapeMethod(m, today), locked: locked.has(m.id) };
    const k = `${s.basis}:${s.factorId}`;
    if (m.execCalendarMonth.startDate <= today && !cur.has(k)) {
      cur.add(k);
      s.isCurrent = true;
    }
    const { _eff, _today, ...rest } = s;
    return rest;
  });
  res.json(out);
});

// داده‌ی پنجره‌ی فرمول‌نویس: دسته‌بندی عوامل، طبقه‌ها، متغیرها و پارامترهای مبنا
router.get("/payroll-methods/palette", can(`${F_METH}.view`), async (req, res) => {
  const baseType = await getBaseCalcType();
  // نوع محاسبه‌ی عاملِ در دست تعریف (?basis=payroll&factorId=): عامل‌های همان نوع + (برای انواع غیرپایه) عامل‌های حقوق ماهانه؛ عامل حکم همیشه نوع پایه است
  const qFactor = req.query.basis === "payroll" && req.query.factorId ? await prisma.payrollComponent.findUnique({ where: { id: Number(req.query.factorId) }, select: { calcTypeId: true } }) : null;
  const typeId = qFactor?.calcTypeId ?? baseType.id;
  const [decree, allComps, params, methods] = await Promise.all([
    prisma.decreeComponent.findMany({ orderBy: { code: "asc" } }),
    prisma.payrollComponent.findMany({ where: { isActive: true }, orderBy: { id: "asc" } }),
    prisma.payrollParameter.findMany({ where: { isActive: true }, orderBy: { id: "asc" } }),
    prisma.payrollFactorMethod.findMany({ where: { payrollComponentId: { not: null } }, orderBy: { execCalendarMonth: { startDate: "desc" } } }),
  ]);
  const latest = new Map<number, (typeof methods)[number]>();
  for (const m of methods) if (!latest.has(m.payrollComponentId!)) latest.set(m.payrollComponentId!, m);
  const comps = allComps.filter((c) => c.calcTypeId === typeId || (typeId !== baseType.id && c.calcTypeId === baseType.id));
  const byMethod = (method: string) => {
    const kinds = KINDS.map((k) => ({
      kind: k,
      title: KIND_FA[k],
      factors: comps
        .filter((c) => latest.get(c.id)?.method === method && c.kind === k)
        .map((c) => ({ key: c.key, title: c.calcTypeId === typeId ? c.title : `${c.title} (${baseType.title})`, valueType: latest.get(c.id)!.valueType })),
    }));
    return kinds.filter((k) => k.factors.length > 0);
  };
  res.json({
    decree: { title: "عامل حکم", factors: decree.map((d) => ({ code: String(d.code), title: d.title })), variants: Object.entries(DECREE_VARIANTS).map(([k, t]) => ({ key: k, title: t })) },
    payroll: [
      { method: "CALCULATED", title: "عامل محاسباتی", classes: byMethod("CALCULATED"), variants: ["VALUE", "YTD", "ALL_PREV", "PREV"].map((k) => ({ key: k, title: FACTOR_VARIANTS[k] })) },
      { method: "MANUAL", title: "عامل ورود دستی", classes: byMethod("MANUAL"), variants: ["VALUE", "YTD_PREV", "ALL_PREV", "PREV"].map((k) => ({ key: k, title: FACTOR_VARIANTS[k] })) },
      { method: "ATTENDANCE", title: "عامل ورود سیستمی تردد", classes: byMethod("ATTENDANCE"), variants: ["VALUE", "YTD_PREV", "ALL_PREV", "PREV"].map((k) => ({ key: k, title: FACTOR_VARIANTS[k] })) },
      { method: "TREASURY", title: "عامل ورود سیستمی خزانه", classes: byMethod("TREASURY"), variants: ["VALUE", "YTD_PREV", "ALL_PREV", "PREV"].map((k) => ({ key: k, title: FACTOR_VARIANTS[k] })) },
    ],
    baseInfo: Object.entries(BASE_INFO).map(([k, t]) => ({ key: k, title: t })),
    classTotals: [...KINDS.map((k) => ({ key: k, title: `جمع ${KIND_FA[k]}` })), { key: LOAN_SUM_KEY, title: LOAN_SUM_LABEL }],
    // مقدارهای ثابت (به‌جز مبناها) و مبناها جدا؛ مبنا در فرمول به‌صورت [P:کلید] جمع عضوهایش را می‌دهد
    params: params
      .filter((p) => p.kind === "CONSTANT" || p.kind === "PERSONNEL_HR" || p.kind === "PERSONNEL_PAYROLL")
      .map((p) => ({ key: p.key, title: p.title, type: p.type, personnel: p.kind === "PERSONNEL_HR" ? "HR" : p.kind === "PERSONNEL_PAYROLL" ? "PAYROLL" : null })),
    bases: params.filter((p) => p.kind === "BASIS").map((p) => ({ key: p.key, title: p.title, source: p.basisSource })),
  });
});

// بررسی زودهنگام شرط/فرمول (پنجره‌ی فرمول‌نویس)
router.post("/payroll-methods/validate", can(`${F_METH}.view`), async (req, res) => {
  const b = req.body as any;
  try {
    let node: string;
    let kindOfFactor = "EARNING";
    let calcTypeId: number | null = null;
    if (b.basis === "decree") {
      const d = await prisma.decreeComponent.findUnique({ where: { id: Number(b.factorId) } });
      if (!d) throw new PayrollCalcError("عامل حکم را انتخاب کنید");
      node = `D:${d.code}`;
    } else {
      const comp = b.factorId ? await prisma.payrollComponent.findUnique({ where: { id: Number(b.factorId) } }) : null;
      node = `C:${comp?.key ?? "NEW_FACTOR"}`;
      kindOfFactor = comp?.kind ?? "EARNING";
      calcTypeId = comp?.calcTypeId ?? null;
    }
    await validateFactorMethod({
      node,
      calcTypeId,
      kind: kindOfFactor as any,
      method: b.basis === "decree" ? "CALCULATED" : b.method ?? "CALCULATED",
      branches: cleanBranches(b.branches),
      basisIds: (Array.isArray(b.basisIds) ? b.basisIds : []).map(Number).filter((n: number) => Number.isInteger(n)),
    });
    res.json({ ok: true });
  } catch (e: any) {
    res.json({ ok: false, error: e.message });
  }
});

router.get("/payroll-methods/:id", can(`${F_METH}.view`), async (req, res) => {
  const m = await prisma.payrollFactorMethod.findUnique({
    where: { id: Number(req.params.id) },
    include: { decreeComponent: { select: { title: true } }, payrollComponent: { select: { title: true } }, branches: { orderBy: { seq: "asc" } }, bases: { select: { parameterId: true, effective: true } }, ...methodMonthInclude },
  });
  if (!m) return res.status(404).json({ error: "روش یافت نشد" });
  const { _eff, _today, ...rest } = shapeMethod(m, new Date());
  const lockMsg = await methodLockMessage(m);
  res.json({ ...rest, locked: !!lockMsg, lockMessage: lockMsg });
});

async function methodData(b: any, existingId: number | null) {
  const basis = b.basis === "decree" ? "decree" : b.basis === "payroll" ? "payroll" : null;
  if (!basis) throw new PayrollCalcError("مبنا را انتخاب کنید");
  const factorId = Number(b.factorId);
  if (!factorId) throw new PayrollCalcError("عامل را انتخاب کنید");
  let node: string;
  let kind: string;
  let calcTypeId: number | null = null;
  if (basis === "decree") {
    const d = await prisma.decreeComponent.findUnique({ where: { id: factorId } });
    if (!d) throw new PayrollCalcError("عامل حکم یافت نشد");
    node = `D:${d.code}`;
    kind = "EARNING";
  } else {
    const c = await prisma.payrollComponent.findUnique({ where: { id: factorId } });
    if (!c) throw new PayrollCalcError("عامل حقوق یافت نشد");
    node = `C:${c.key}`;
    kind = c.kind;
    calcTypeId = c.calcTypeId;
  }
  const method = basis === "decree" ? "CALCULATED" : b.method;
  if (!METHODS.includes(method)) throw new PayrollCalcError("روش را انتخاب کنید");
  if (!VALUE_TYPES.includes(b.valueType)) throw new PayrollCalcError("نوع پارامتر را انتخاب کنید");
  const iy = Number(b.issueYear), im = Number(b.issueMonth), ey = Number(b.execYear), em = Number(b.execMonth);
  for (const [y, m, label] of [[iy, im, "ماه صدور"], [ey, em, "ماه اجرا"]] as const) {
    if (!Number.isInteger(y) || y < 1300 || y > 1600 || !Number.isInteger(m) || m < 1 || m > 12) throw new PayrollCalcError(`${label} نامعتبر است`);
  }
  if (ey * 12 + em < iy * 12 + im) throw new PayrollCalcError("ماه اجرا نمی‌تواند قبل از ماه صدور باشد");
  // هر دو ماه باید ردیفی در «تقویم کاری» باشند؛ فقط ارجاع به همان ردیف ذخیره می‌شود
  const issueRow = await getCalendarMonth(iy, im);
  if (!issueRow) throw new PayrollCalcError((await missingMonthMessage(iy, im))!);
  const execRow = await getCalendarMonth(ey, em);
  if (!execRow) throw new PayrollCalcError((await missingMonthMessage(ey, em))!);
  const isCalc = method === "CALCULATED";
  const branches = isCalc ? cleanBranches(b.branches) : [];
  // مبناهای مؤثر: عامل حکم هر مبنا؛ عامل حقوق فقط «پرداختی» و فقط مبنای منبع «محاسبات» (مبناهای فعلی همین رکورد حتی اگر غیرفعال شده باشند می‌مانند)
  const keep = existingId ? (await prisma.payrollFactorMethodBasis.findMany({ where: { methodId: existingId }, select: { parameterId: true } })).map((x) => x.parameterId) : [];
  const { effectiveIds: basisIds, noEffectIds } = await resolveBasisDecisions({ basis, kind }, b.basisIds, b.noEffectBasisIds, keep);
  await validateFactorMethod({ node, calcTypeId, kind: kind as any, method, branches, basisIds });
  return {
    basis,
    factorId,
    /** تاریخ شروع ماه اجرا (برای کنترل ترتیب تاریخچه‌ی روش‌های یک عامل) */
    execStart: execRow.startDate,
    data: {
      method,
      valueType: b.valueType,
      issueCalendarMonthId: issueRow.id,
      execCalendarMonthId: execRow.id,
      isProvisional: false,
    },
    branches,
    basisIds,
    noEffectIds,
  };
}

router.post("/payroll-methods", can(`${F_METH}.create`), async (req, res) => {
  try {
    const { basis, factorId, data, execStart, branches, basisIds, noEffectIds } = await methodData(req.body, null);
    const where = basis === "decree" ? { decreeComponentId: factorId } : { payrollComponentId: factorId };
    const latest = await prisma.payrollFactorMethod.findFirst({ where, orderBy: { execCalendarMonth: { startDate: "desc" } }, include: methodMonthInclude });
    if (latest && execStart <= latest.execCalendarMonth.startDate) {
      throw new PayrollCalcError(`ماه اجرا باید بعد از ماه اجرای آخرین روش این عامل (${execYm(latest).year}/${execYm(latest).month}) باشد`);
    }
    const created = await prisma.payrollFactorMethod.create({
      data: { ...where, ...data, branches: { create: branches.map((x, i) => ({ seq: i + 1, conditionText: x.conditionText, formulaText: x.formulaText })) }, bases: { create: basisRows(basisIds, noEffectIds) } },
    });
    res.status(201).json({ id: created.id });
  } catch (e) {
    fail(res, e, "خطا در ثبت روش محاسبه");
  }
});

router.put("/payroll-methods/:id", can(`${F_METH}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const m = await prisma.payrollFactorMethod.findUnique({ where: { id }, include: methodMonthInclude });
    if (!m) return res.status(404).json({ error: "روش یافت نشد" });
    const lockMsg = await methodLockMessage(m);
    if (lockMsg) throw new PayrollCalcError(lockMsg);
    // عامل و مبنای یک رکورد تغییر نمی‌کند
    const body = { ...req.body, basis: m.decreeComponentId ? "decree" : "payroll", factorId: m.decreeComponentId ?? m.payrollComponentId };
    const { data, execStart, branches, basisIds, noEffectIds } = await methodData(body, id);
    const same = m.decreeComponentId ? { decreeComponentId: m.decreeComponentId } : { payrollComponentId: m.payrollComponentId };
    const [prev, next] = await Promise.all([
      prisma.payrollFactorMethod.findFirst({ where: { ...same, execCalendarMonth: { startDate: { lt: m.execCalendarMonth.startDate } } }, orderBy: { execCalendarMonth: { startDate: "desc" } }, include: methodMonthInclude }),
      prisma.payrollFactorMethod.findFirst({ where: { ...same, execCalendarMonth: { startDate: { gt: m.execCalendarMonth.startDate } } }, orderBy: { execCalendarMonth: { startDate: "asc" } }, include: methodMonthInclude }),
    ]);
    if (prev && execStart <= prev.execCalendarMonth.startDate) throw new PayrollCalcError(`ماه اجرا باید بعد از روش قبلی (${execYm(prev).year}/${execYm(prev).month}) بماند`);
    if (next && execStart >= next.execCalendarMonth.startDate) throw new PayrollCalcError(`ماه اجرا باید قبل از روش بعدی (${execYm(next).year}/${execYm(next).month}) بماند`);
    await prisma.payrollFactorMethod.update({
      where: { id },
      data: { ...data, branches: { deleteMany: {}, create: branches.map((x, i) => ({ seq: i + 1, conditionText: x.conditionText, formulaText: x.formulaText })) }, bases: { deleteMany: {}, create: basisRows(basisIds, noEffectIds) } },
    });
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در ویرایش روش محاسبه");
  }
});

router.post("/payroll-methods/:id/confirm", can(`${F_METH}.edit`), async (req, res) => {
  const m = await prisma.payrollFactorMethod.findUnique({ where: { id: Number(req.params.id) } });
  if (!m) return res.status(404).json({ error: "روش یافت نشد" });
  const lockMsg = await methodLockMessage(m);
  if (lockMsg) return res.status(400).json({ error: lockMsg });
  await prisma.payrollFactorMethod.update({ where: { id: m.id }, data: { isProvisional: false } });
  res.json({ ok: true });
});

router.delete("/payroll-methods/:id", can(`${F_METH}.delete`), async (req, res) => {
  const m = await prisma.payrollFactorMethod.findUnique({ where: { id: Number(req.params.id) } });
  if (!m) return res.status(204).send();
  const lockMsg = await methodLockMessage(m);
  if (lockMsg) return res.status(400).json({ error: lockMsg });
  await prisma.payrollFactorMethod.delete({ where: { id: m.id } });
  res.status(204).send();
});

// ════════════ محاسبه و گزارش ════════════
// فهرست کارمندانِ دارای همکاری در ماه (برای فرم «محاسبه حقوق») با وضعیت حکم و آخرین محاسبه‌ی همان ماه
router.get("/payroll-calculations/month", canAny(`${F_CALC}.view`, `${F_CALC}.calculate`), async (req, res) => {
  try {
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    if (!Number.isInteger(year) || year < 1300 || year > 1600 || !Number.isInteger(month) || month < 1 || month > 12) throw new PayrollCalcError("سال یا ماه نامعتبر است");
    const range = jalaliMonthRange(year, month);
    const calMsg = await missingMonthMessage(year, month);
    if (calMsg) throw new PayrollCalcError(calMsg);
    const baseType = await getBaseCalcType();
    const calcType = req.query.calcTypeId ? await prisma.payrollCalcType.findUnique({ where: { id: Number(req.query.calcTypeId) } }) : baseType;
    if (!calcType) throw new PayrollCalcError("نوع محاسبه یافت نشد");
    const inPeriod = await employeeIdsInPeriod(range.start, range.end);
    const emps = await prisma.employee.findMany({
      where: { id: { in: inPeriod } },
      include: { party: { select: { firstName: true, lastName: true, name: true } } },
      orderBy: { personnelCode: "asc" },
    });
    const slips = await prisma.payrollSlip.findMany({ where: { year, month, calcTypeId: calcType.id, employeeId: { in: emps.map((e) => e.id) } }, include: { journalEntry: { select: { id: true, referenceNumber: true, status: true } } } });
    // نوع غیرپایه: کارمندانی که «حقوق ماهانه»ی همین ماهشان محاسبه نشده قابل محاسبه نیستند
    const baseSet = calcType.isBase
      ? null
      : new Set((await prisma.payrollSlip.findMany({ where: { year, month, calcTypeId: baseType.id, employeeId: { in: emps.map((e) => e.id) } }, select: { employeeId: true } })).map((x) => x.employeeId));
    const decrees = await getEffectiveDecrees(emps.map((e) => e.id), range.end);
    res.json({
      monthDays: range.days,
      calcType: { id: calcType.id, title: calcType.title, isBase: calcType.isBase },
      rows: emps.map((e) => {
        const s = slips.find((x) => x.employeeId === e.id);
        return {
          employeeId: e.id,
          personnelCode: e.personnelCode,
          fullName: [e.party.firstName, e.party.lastName].filter(Boolean).join(" ") || e.party.name || "",
          decreeValidity: decrees.get(e.id)?.validity ?? "NONE",
          blockedReason: baseSet && !baseSet.has(e.id) ? `ابتدا «${baseType.title}» محاسبه شود` : null,
          slip: s ? { id: s.id, netPay: s.netPay.toString(), hasErrors: s.hasErrors, calculatedAt: s.calculatedAt, journalEntryId: s.journalEntry?.id ?? null, journalReferenceNumber: s.journalEntry?.referenceNumber ?? null } : null,
        };
      }),
    });
  } catch (e) {
    fail(res, e, "خطا در بارگذاری فهرست پرسنل");
  }
});

// محاسبه‌ی گروهیِ کارمندان انتخاب‌شده در یک ماه؛ هر کارمند مستقل است و خطای یکی مانع بقیه نمی‌شود
router.post("/payroll-calculations/calculate", can(`${F_CALC}.calculate`), async (req, res) => {
  const b = req.body as { year: number; month: number; employeeIds: number[]; calcTypeId?: number };
  try {
    const ids = Array.isArray(b.employeeIds) ? [...new Set(b.employeeIds.map(Number).filter(Boolean))] : [];
    if (ids.length === 0) throw new PayrollCalcError("هیچ کارمندی انتخاب نشده است");
    if (ids.length > 500) throw new PayrollCalcError("حداکثر ۵۰۰ کارمند در هر بار محاسبه");
    const results: { employeeId: number; ok: boolean; slipId?: number; error?: string }[] = [];
    for (const employeeId of ids) {
      try {
        const r = await calculatePayroll(employeeId, Number(b.year), Number(b.month), b.calcTypeId ? Number(b.calcTypeId) : undefined);
        results.push({ employeeId, ok: true, slipId: r.slipId });
      } catch (e: any) {
        results.push({ employeeId, ok: false, error: e?.message || "خطا در محاسبه" });
      }
    }
    res.json({ results });
  } catch (e) {
    fail(res, e, "خطا در محاسبه‌ی حقوق");
  }
});

router.get("/payroll-calculations", canAny(`${F_CALC}.view`, `${F_REPORT}.view`), async (req, res) => {
  const employeeId = req.query.employeeId ? Number(req.query.employeeId) : undefined;
  const calcTypeId = req.query.calcTypeId ? Number(req.query.calcTypeId) : undefined;
  const rows = await prisma.payrollSlip.findMany({
    where: { ...(employeeId ? { employeeId } : {}), ...(calcTypeId ? { calcTypeId } : {}) },
    include: { calcType: { select: { title: true } }, employee: { select: { personnelCode: true, party: { select: { firstName: true, lastName: true, name: true } } } } },
    orderBy: [{ year: "desc" }, { month: "desc" }, { id: "desc" }],
  });
  res.json(
    rows.map((s) => ({
      id: s.id,
      employeeId: s.employeeId,
      personnelCode: s.employee.personnelCode,
      employeeName: [s.employee.party.firstName, s.employee.party.lastName].filter(Boolean).join(" ") || s.employee.party.name || "",
      calcTypeId: s.calcTypeId,
      calcTypeTitle: s.calcType.title,
      year: s.year,
      month: s.month,
      earnings: s.earnings.toString(),
      deductions: s.deductions.toString(),
      employerCosts: s.employerCosts.toString(),
      netPay: s.netPay.toString(),
      hasErrors: s.hasErrors,
      calculatedAt: s.calculatedAt,
    }))
  );
});

router.get("/payroll-calculations/find", canAny(`${F_CALC}.view`, `${F_REPORT}.view`), async (req, res) => {
  const calcTypeId = req.query.calcTypeId ? Number(req.query.calcTypeId) : (await getBaseCalcType()).id;
  const s = await prisma.payrollSlip.findUnique({
    where: { employeeId_year_month_calcTypeId: { employeeId: Number(req.query.employeeId), year: Number(req.query.year), month: Number(req.query.month), calcTypeId } },
    select: { id: true },
  });
  res.json({ id: s?.id ?? null });
});

router.get("/payroll-calculations/:id", canAny(`${F_CALC}.view`, `${F_REPORT}.view`), async (req, res) => {
  const s = await prisma.payrollSlip.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      calcType: { select: { id: true, title: true, isBase: true } },
      lines: { orderBy: { seq: "asc" } },
      decree: { select: { id: true, number: true, type: true, effectiveDate: true, endDate: true, employmentType: { select: { title: true } } } },
      employee: { select: { id: true, personnelCode: true, party: { select: { firstName: true, lastName: true, name: true, nationalId: true } } } },
    },
  });
  if (!s) return res.status(404).json({ error: "فیش یافت نشد" });
  res.json({
    id: s.id,
    year: s.year,
    month: s.month,
    calcType: s.calcType,
    employee: {
      id: s.employee.id,
      personnelCode: s.employee.personnelCode,
      fullName: [s.employee.party.firstName, s.employee.party.lastName].filter(Boolean).join(" ") || s.employee.party.name || "",
      nationalId: s.employee.party.nationalId,
    },
    decree: s.decree
      ? { id: s.decree.id, number: s.decree.number, type: s.decree.type, effectiveDate: day(s.decree.effectiveDate), endDate: day(s.decree.endDate), employmentType: s.decree.employmentType.title }
      : null,
    monthDays: s.monthDays,
    totals: { earnings: s.earnings.toString(), deductions: s.deductions.toString(), employerCosts: s.employerCosts.toString(), netPay: s.netPay.toString() },
    hasErrors: s.hasErrors,
    warnings: s.warnings,
    parameters: s.parameters,
    calculatedAt: s.calculatedAt,
    lines: s.lines.map((l) => ({
      seq: l.seq,
      kind: l.kind,
      source: l.source,
      title: l.title,
      formula: l.formula,
      amount: l.amount.toString(),
      error: l.error,
      trace: l.trace,
    })),
  });
});

// چاپ فیش حقوقی یک یا چند کارمند از فیش‌های محاسبه‌شده‌ی یک ماه؛ سند HTML آماده‌ی چاپ برمی‌گرداند
router.post("/payroll-calculations/print", canAny(`${F_CALC}.view`, `${F_REPORT}.view`), async (req, res) => {
  const b = req.body as { year: number; month: number; employeeIds: number[]; digits?: string; calcTypeId?: number };
  try {
    const ids = Array.isArray(b.employeeIds) ? [...new Set(b.employeeIds.map(Number).filter(Boolean))] : [];
    if (ids.length === 0) throw new PayrollCalcError("هیچ کارمندی انتخاب نشده است");
    if (ids.length > 500) throw new PayrollCalcError("حداکثر ۵۰۰ فیش در هر بار چاپ");
    const r = await buildPayrollSlipsPrint(Number(b.year), Number(b.month), ids, b.digits === "LATIN" ? "LATIN" : "PERSIAN", b.calcTypeId ? Number(b.calcTypeId) : undefined);
    if (r.count === 0) throw new PayrollCalcError("برای کارمندان انتخاب‌شده در این ماه محاسبه‌ای ثبت نشده است؛ ابتدا محاسبه کنید");
    res.json(r);
  } catch (e) {
    fail(res, e, "خطا در آماده‌سازی چاپ فیش");
  }
});

// چاپ «لیست حقوق» یک ماه (A4 افقی، چیدمان خودکار ستون‌ها)؛ employeeIds خالی = همه‌ی فیش‌های محاسبه‌شده‌ی آن ماه و نوع محاسبه
router.post("/payroll-calculations/print-list", canAny(`${F_CALC}.view`, `${F_REPORT}.view`), async (req, res) => {
  const b = req.body as { year: number; month: number; employeeIds?: number[]; digits?: string; calcTypeId?: number };
  try {
    const ids = Array.isArray(b.employeeIds) ? [...new Set(b.employeeIds.map(Number).filter(Boolean))] : [];
    const r = await buildPayrollListPrint(Number(b.year), Number(b.month), ids.length ? ids : null, b.digits === "LATIN" ? "LATIN" : "PERSIAN", b.calcTypeId ? Number(b.calcTypeId) : undefined);
    if (r.count === 0) throw new PayrollCalcError("در این ماه محاسبه‌ای ثبت نشده است؛ ابتدا محاسبه کنید");
    res.json(r);
  } catch (e) {
    fail(res, e, "خطا در آماده‌سازی چاپ لیست حقوق");
  }
});

// حذف محاسبه‌ی کارمندان انتخاب‌شده‌ی یک ماه (بدون حذف، محاسبه‌ی مجدد ممکن نیست)
router.post("/payroll-calculations/delete", can(`${F_CALC}.delete`), async (req, res) => {
  const b = req.body as { year: number; month: number; employeeIds: number[]; calcTypeId?: number };
  try {
    const ids = Array.isArray(b.employeeIds) ? [...new Set(b.employeeIds.map(Number).filter(Boolean))] : [];
    if (ids.length === 0) throw new PayrollCalcError("هیچ کارمندی انتخاب نشده است");
    const baseType = await getBaseCalcType();
    const calcTypeId = b.calcTypeId ? Number(b.calcTypeId) : baseType.id;
    // حذف «حقوق ماهانه» وقتی فیش نوع دیگری برای همان کارمند و ماه هست ممنوع است
    if (calcTypeId === baseType.id) {
      const msg = await dependentSlipMessage(ids.map((employeeId) => ({ employeeId, year: Number(b.year), month: Number(b.month) })));
      if (msg) throw new PayrollCalcError(msg);
    }
    const lock = await slipJournalLockMessage({ year: Number(b.year), month: Number(b.month), calcTypeId, employeeId: { in: ids } });
    if (lock) throw new PayrollCalcError(lock);
    const prepLock = await slipPrepLockMessage({ year: Number(b.year), month: Number(b.month), calcTypeId, employeeId: { in: ids } });
    if (prepLock) throw new PayrollCalcError(prepLock);
    const r = await prisma.payrollSlip.deleteMany({ where: { year: Number(b.year), month: Number(b.month), calcTypeId, employeeId: { in: ids } } });
    res.json({ deleted: r.count });
  } catch (e) {
    fail(res, e, "خطا در حذف محاسبه");
  }
});

router.delete("/payroll-calculations/:id", can(`${F_CALC}.delete`), async (req, res) => {
  const lock = await slipJournalLockMessage({ id: Number(req.params.id) });
  if (lock) return res.status(400).json({ error: lock });
  const prepLock = await slipPrepLockMessage({ id: Number(req.params.id) });
  if (prepLock) return res.status(400).json({ error: prepLock });
  const slip = await prisma.payrollSlip.findUnique({ where: { id: Number(req.params.id) }, select: { employeeId: true, year: true, month: true, calcType: { select: { isBase: true } } } });
  if (slip?.calcType.isBase) {
    const msg = await dependentSlipMessage([slip]);
    if (msg) return res.status(400).json({ error: msg });
  }
  await prisma.payrollSlip.deleteMany({ where: { id: Number(req.params.id) } });
  res.status(204).send();
});

export default router;
