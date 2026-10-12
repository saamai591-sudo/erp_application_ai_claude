import { NextFunction, Response, Router } from "express";
import { prisma } from "../lib/prisma";
import { can, userHasAction } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { AuthedRequest } from "../middleware/auth";
import { PayrollCalcError, calculatePayroll, validateComponentFormula } from "../services/payrollCalculationService";
import { VARIABLES } from "../services/payrollFormula";

// حقوق و دستمزد: اجزای حقوق (فرمولی)، مشخصات محاسبه‌ی تاریخ‌دار اجزا، و محاسبه‌ی فیش یک کارمند + جزئیات برای گزارش.

const F_COMP = findFormPrefix("payroll-components");
const F_PROF = findFormPrefix("calc-profiles");
const F_CALC = findFormPrefix("payroll-calculation");
const F_REPORT = findFormPrefix("payroll-calculation-report");

const router = Router();
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const str = (v: unknown) => {
  const t = typeof v === "string" ? v.trim() : "";
  return t || null;
};
const KINDS = ["EARNING", "DEDUCTION", "EMPLOYER_COST", "INFO"];

function fail(res: Response, e: any, fallback: string) {
  if (e instanceof PayrollCalcError) return res.status(400).json({ error: e.message });
  if (e?.code === "P2002") return res.status(400).json({ error: "رکورد تکراری است" });
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

// ════════════ اجزای حقوق ════════════
router.get("/payroll-components", can(`${F_COMP}.view`), async (_req, res) => {
  res.json(await prisma.payrollComponent.findMany({ orderBy: [{ isSystem: "desc" }, { id: "asc" }] }));
});

// فهرست عملوندهای قابل استفاده در فرمول (برای پالت فرم)
router.get("/payroll-components/palette", can(`${F_COMP}.view`), async (_req, res) => {
  const [decree, comps, params] = await Promise.all([
    prisma.decreeComponent.findMany({ orderBy: { code: "asc" } }),
    prisma.payrollComponent.findMany({ orderBy: { id: "asc" } }),
    prisma.payrollParameter.findMany({ orderBy: { id: "asc" } }),
  ]);
  res.json({
    decree: decree.map((d) => ({ ref: `[D:${d.code}]`, title: d.title })),
    components: comps.map((c) => ({ ref: `[C:${c.key}]`, title: c.title, kind: c.kind })),
    params: params.map((p) => ({ ref: `[P:${p.key}]`, title: p.title, type: p.type })),
    variables: Object.entries(VARIABLES).map(([k, t]) => ({ ref: `[V:${k}]`, title: t })),
    functions: ["MIN(a, b)", "MAX(a, b)", "ROUND(x, ارقام)", "PROGRESSIVE([P:جدول], مبلغ)"],
  });
});

router.post("/payroll-components/validate", can(`${F_COMP}.view`), async (req, res) => {
  const b = req.body as any;
  try {
    const others = await prisma.payrollComponent.findMany({ select: { key: true, kind: true, formula: true } });
    const r = await validateComponentFormula(String(b.key ?? "NEW_COMPONENT").toUpperCase(), b.kind ?? "EARNING", String(b.formula ?? ""), others as any);
    res.json({ ok: true, refs: r.refs });
  } catch (e: any) {
    res.json({ ok: false, error: e.message });
  }
});

async function componentBody(b: any, selfKey: string | null) {
  const title = str(b.title);
  if (!title) throw new PayrollCalcError("عنوان الزامی است");
  if (!KINDS.includes(b.kind)) throw new PayrollCalcError("نوع جزء نامعتبر است");
  const formula = str(b.formula);
  if (!formula) throw new PayrollCalcError("فرمول الزامی است");
  const others = await prisma.payrollComponent.findMany({ select: { key: true, kind: true, formula: true } });
  await validateComponentFormula(selfKey ?? String(b.key).toUpperCase(), b.kind, formula, others as any);
  return { title, kind: b.kind, formula, description: str(b.description) };
}

router.post("/payroll-components", can(`${F_COMP}.create`), async (req, res) => {
  const b = req.body as any;
  try {
    const key = String(b.key ?? "").trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9_]{1,39}$/.test(key)) throw new PayrollCalcError("کلید باید با حرف انگلیسی شروع شود و فقط حروف بزرگ انگلیسی، عدد و _ داشته باشد");
    if (await prisma.payrollComponent.findUnique({ where: { key } })) throw new PayrollCalcError("این کلید قبلاً تعریف شده است");
    const data = await componentBody({ ...b, key }, null);
    const created = await prisma.payrollComponent.create({ data: { key, ...data, isActive: b.isActive ?? true } });
    res.status(201).json({ id: created.id });
  } catch (e) {
    fail(res, e, "خطا در ثبت جزء");
  }
});

router.put("/payroll-components/:id", can(`${F_COMP}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body as any;
  try {
    const c = await prisma.payrollComponent.findUnique({ where: { id } });
    if (!c) return res.status(404).json({ error: "جزء یافت نشد" });
    // کلید ثابت است؛ نوع جزء سیستمی هم عوض نمی‌شود (فرمول‌های دیگر به آن تکیه دارند)
    const data = await componentBody({ ...b, kind: c.isSystem ? c.kind : b.kind }, c.key);
    await prisma.payrollComponent.update({ where: { id }, data: { ...data, isActive: c.isSystem ? c.isActive : b.isActive ?? c.isActive } });
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در ویرایش جزء");
  }
});

router.delete("/payroll-components/:id", can(`${F_COMP}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const c = await prisma.payrollComponent.findUnique({ where: { id } });
  if (!c) return res.status(404).json({ error: "جزء یافت نشد" });
  if (c.isSystem) return res.status(400).json({ error: "جزء سیستمی قابل حذف نیست (می‌توانید فرمول آن را ویرایش کنید)" });
  const used = await prisma.payrollSlipLine.count({ where: { source: "PAYROLL_COMPONENT", refId: id } });
  if (used) return res.status(400).json({ error: "این جزء در فیش‌های محاسبه‌شده استفاده شده و قابل حذف نیست" });
  const dependents = (await prisma.payrollComponent.findMany({ where: { NOT: { id } } })).filter((o) => o.formula.toUpperCase().includes(`[C:${c.key}]`));
  if (dependents.length) return res.status(400).json({ error: `اجزای «${dependents.map((d) => d.title).join("، ")}» به این جزء ارجاع دارند` });
  await prisma.payrollComponent.delete({ where: { id } });
  res.status(204).send();
});

// ════════════ مشخصات محاسبه‌ی تاریخ‌دار ════════════
type ItemKind = "decree" | "payroll";
const profWhere = (kind: ItemKind, id: number) => (kind === "decree" ? { decreeComponentId: id } : { payrollComponentId: id });
const shapeProfile = (p: any) => ({
  id: p.id,
  effectiveDate: day(p.effectiveDate),
  prorate: p.prorate,
  insurable: p.insurable,
  taxable: p.taxable,
  overtimeBase: p.overtimeBase,
  isProvisional: p.isProvisional,
  note: p.note,
});

router.get("/payroll-profiles", can(`${F_PROF}.view`), async (_req, res) => {
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  const [dec, comp] = await Promise.all([
    prisma.decreeComponent.findMany({ orderBy: { code: "asc" }, include: { profiles: { orderBy: { effectiveDate: "desc" } } } }),
    prisma.payrollComponent.findMany({ orderBy: { id: "asc" }, include: { profiles: { orderBy: { effectiveDate: "desc" } } } }),
  ]);
  const cur = (ps: any[]) => {
    const p = ps.find((x) => x.effectiveDate <= today);
    return p ? shapeProfile(p) : null;
  };
  res.json([
    ...dec.map((d) => ({ kind: "decree" as const, id: d.id, title: d.title, group: "جزء حکم", current: cur(d.profiles), count: d.profiles.length })),
    ...comp.map((c) => ({ kind: "payroll" as const, id: c.id, title: c.title, group: "جزء حقوق", current: cur(c.profiles), count: c.profiles.length })),
  ]);
});

router.get("/payroll-profiles/:kind/:id", can(`${F_PROF}.view`), async (req, res) => {
  const kind = req.params.kind as ItemKind;
  const id = Number(req.params.id);
  if (kind !== "decree" && kind !== "payroll") return res.status(400).json({ error: "نوع نامعتبر است" });
  const title = kind === "decree" ? (await prisma.decreeComponent.findUnique({ where: { id } }))?.title : (await prisma.payrollComponent.findUnique({ where: { id } }))?.title;
  if (!title) return res.status(404).json({ error: "جزء یافت نشد" });
  const rows = await prisma.payrollItemProfile.findMany({ where: profWhere(kind, id), orderBy: { effectiveDate: "desc" } });
  res.json({ kind, id, title, profiles: rows.map(shapeProfile) });
});

function profileData(b: any) {
  const d = new Date(`${String(b.effectiveDate ?? "")}T00:00:00.000Z`);
  if (!b.effectiveDate || isNaN(d.getTime())) throw new PayrollCalcError("تاریخ شروع الزامی است");
  return { effectiveDate: d, prorate: !!b.prorate, insurable: !!b.insurable, taxable: !!b.taxable, overtimeBase: !!b.overtimeBase, note: str(b.note) };
}

router.post("/payroll-profiles/:kind/:id", can(`${F_PROF}.edit`), async (req, res) => {
  const kind = req.params.kind as ItemKind;
  const id = Number(req.params.id);
  try {
    if (kind !== "decree" && kind !== "payroll") throw new PayrollCalcError("نوع نامعتبر است");
    const data = profileData(req.body);
    const latest = await prisma.payrollItemProfile.findFirst({ where: profWhere(kind, id), orderBy: { effectiveDate: "desc" } });
    if (latest && data.effectiveDate <= latest.effectiveDate) {
      throw new PayrollCalcError(`تاریخ شروع باید بعد از آخرین مشخصات (${day(latest.effectiveDate)}) باشد`);
    }
    const created = await prisma.payrollItemProfile.create({ data: { ...profWhere(kind, id), ...data } });
    res.status(201).json({ id: created.id });
  } catch (e) {
    fail(res, e, "خطا در ثبت مشخصات");
  }
});

router.put("/payroll-profiles/:pid", can(`${F_PROF}.edit`), async (req, res) => {
  const pid = Number(req.params.pid);
  try {
    const p = await prisma.payrollItemProfile.findUnique({ where: { id: pid } });
    if (!p) return res.status(404).json({ error: "مشخصات یافت نشد" });
    const data = profileData(req.body);
    const same = p.decreeComponentId ? { decreeComponentId: p.decreeComponentId } : { payrollComponentId: p.payrollComponentId };
    const [prev, next] = await Promise.all([
      prisma.payrollItemProfile.findFirst({ where: { ...same, effectiveDate: { lt: p.effectiveDate } }, orderBy: { effectiveDate: "desc" } }),
      prisma.payrollItemProfile.findFirst({ where: { ...same, effectiveDate: { gt: p.effectiveDate } }, orderBy: { effectiveDate: "asc" } }),
    ]);
    if (prev && data.effectiveDate <= prev.effectiveDate) throw new PayrollCalcError(`تاریخ باید بعد از مشخصات قبلی (${day(prev.effectiveDate)}) بماند`);
    if (next && data.effectiveDate >= next.effectiveDate) throw new PayrollCalcError(`تاریخ باید قبل از مشخصات بعدی (${day(next.effectiveDate)}) بماند`);
    await prisma.payrollItemProfile.update({ where: { id: pid }, data: { ...data, isProvisional: false } });
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در ویرایش مشخصات");
  }
});

router.post("/payroll-profiles/:pid/confirm", can(`${F_PROF}.edit`), async (req, res) => {
  await prisma.payrollItemProfile.updateMany({ where: { id: Number(req.params.pid) }, data: { isProvisional: false } });
  res.json({ ok: true });
});

router.delete("/payroll-profiles/:pid", can(`${F_PROF}.delete`), async (req, res) => {
  await prisma.payrollItemProfile.deleteMany({ where: { id: Number(req.params.pid) } });
  res.status(204).send();
});

// ════════════ محاسبه و گزارش ════════════
router.post("/payroll-calculations/calculate", can(`${F_CALC}.calculate`), async (req, res) => {
  const b = req.body as any;
  try {
    const num = (v: unknown) => (v === undefined || v === null || v === "" ? undefined : Number(v));
    const r = await calculatePayroll(Number(b.employeeId), Number(b.year), Number(b.month), { workDays: num(b.workDays), overtimeHours: num(b.overtimeHours) });
    res.json(r);
  } catch (e) {
    fail(res, e, "خطا در محاسبه‌ی حقوق");
  }
});

router.get("/payroll-calculations", canAny(`${F_CALC}.view`, `${F_REPORT}.view`), async (req, res) => {
  const employeeId = req.query.employeeId ? Number(req.query.employeeId) : undefined;
  const rows = await prisma.payrollSlip.findMany({
    where: employeeId ? { employeeId } : {},
    include: { employee: { select: { personnelCode: true, party: { select: { firstName: true, lastName: true, name: true } } } } },
    orderBy: [{ year: "desc" }, { month: "desc" }, { id: "desc" }],
  });
  res.json(
    rows.map((s) => ({
      id: s.id,
      employeeId: s.employeeId,
      personnelCode: s.employee.personnelCode,
      employeeName: [s.employee.party.firstName, s.employee.party.lastName].filter(Boolean).join(" ") || s.employee.party.name || "",
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

// یافتن فیش یک کارمند در یک ماه (برای گزارش)
router.get("/payroll-calculations/find", canAny(`${F_CALC}.view`, `${F_REPORT}.view`), async (req, res) => {
  const s = await prisma.payrollSlip.findUnique({
    where: { employeeId_year_month: { employeeId: Number(req.query.employeeId), year: Number(req.query.year), month: Number(req.query.month) } },
    select: { id: true },
  });
  res.json({ id: s?.id ?? null });
});

router.get("/payroll-calculations/:id", canAny(`${F_CALC}.view`, `${F_REPORT}.view`), async (req, res) => {
  const s = await prisma.payrollSlip.findUnique({
    where: { id: Number(req.params.id) },
    include: {
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
    employee: {
      id: s.employee.id,
      personnelCode: s.employee.personnelCode,
      fullName: [s.employee.party.firstName, s.employee.party.lastName].filter(Boolean).join(" ") || s.employee.party.name || "",
      nationalId: s.employee.party.nationalId,
    },
    decree: s.decree
      ? { id: s.decree.id, number: s.decree.number, type: s.decree.type, effectiveDate: day(s.decree.effectiveDate), endDate: day(s.decree.endDate), employmentType: s.decree.employmentType.title }
      : null,
    inputs: { monthDays: s.monthDays, workDays: s.workDays.toString(), overtimeHours: s.overtimeHours.toString() },
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
      insurable: l.insurable,
      taxable: l.taxable,
      amount: l.amount.toString(),
      error: l.error,
      trace: l.trace,
    })),
  });
});

router.delete("/payroll-calculations/:id", can(`${F_CALC}.delete`), async (req, res) => {
  await prisma.payrollSlip.deleteMany({ where: { id: Number(req.params.id) } });
  res.status(204).send();
});

export default router;
