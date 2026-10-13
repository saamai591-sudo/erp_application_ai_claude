import { NextFunction, Response, Router } from "express";
import { prisma } from "../lib/prisma";
import { can, userHasAction } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { AuthedRequest } from "../middleware/auth";
import { METHOD_FA, PayrollCalcError, calculatePayroll, validateFactorMethod, methodLockMessage, lockedMethodIds } from "../services/payrollCalculationService";
import { getEffectiveDecrees } from "../services/employmentDecreeService";
import { buildPayrollSlipsPrint } from "../services/payrollSlipPrint";
import { jalaliMonthRange } from "../utils/jalaliDate";
import { BASE_INFO, DECREE_VARIANTS, FACTOR_VARIANTS, KIND_FA } from "../services/payrollFormula";

// حقوق و دستمزد: عامل‌های حقوق (هویت)، «روش محاسبه عامل» (تاریخ‌دار با ماه اجرا؛ مبنا = عامل حکم یا عامل حقوق)، ورودی ماهانه‌ی عوامل،
// محاسبه‌ی فیش یک کارمند و جزئیات آن برای گزارش.

const F_COMP = findFormPrefix("payroll-components");
const F_METH = findFormPrefix("factor-methods");
const F_CALC = findFormPrefix("payroll-calculation");
const F_REPORT = findFormPrefix("payroll-calculation-report");

const router = Router();
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const str = (v: unknown) => {
  const t = typeof v === "string" ? v.trim() : "";
  return t || null;
};
const KINDS = ["WORK", "EARNING", "DEDUCTION", "EMPLOYER_COST", "INFO"];
const METHODS = ["CALCULATED", "FIXED", "MANUAL", "ATTENDANCE", "TREASURY"];
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

// ════════════ عامل حقوق (هویت) ════════════
router.get("/payroll-components", can(`${F_COMP}.view`), async (_req, res) => {
  const rows = await prisma.payrollComponent.findMany({ orderBy: [{ isSystem: "desc" }, { id: "asc" }], include: { methods: { orderBy: { effectiveDate: "desc" }, take: 1 } } });
  res.json(
    rows.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      isSystem: c.isSystem,
      isActive: c.isActive,
      method: c.methods[0]?.method ?? null,
      kind: c.kind,
    }))
  );
});

router.post("/payroll-components", can(`${F_COMP}.create`), async (req, res) => {
  const b = req.body as any;
  try {
    const title = str(b.title);
    if (!title) throw new PayrollCalcError("عنوان الزامی است");
    if (!KINDS.includes(b.kind)) throw new PayrollCalcError("طبقه را انتخاب کنید");
    if (await prisma.payrollComponent.findFirst({ where: { title } })) throw new PayrollCalcError("عامل دیگری با همین عنوان وجود دارد");
    // کلید داخلی را سیستم می‌سازد (به کاربر نمایش داده نمی‌شود)
    const last = await prisma.payrollComponent.findFirst({ orderBy: { id: "desc" }, select: { id: true } });
    let n = (last?.id ?? 0) + 1;
    let key = `F${n}`;
    while (await prisma.payrollComponent.findUnique({ where: { key } })) key = `F${++n}`;
    const created = await prisma.payrollComponent.create({ data: { key, title, kind: b.kind, description: str(b.description), isActive: b.isActive ?? true } });
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
    await prisma.payrollComponent.update({ where: { id }, data: { title, kind: b.kind ?? undefined, description: str(b.description), isActive: c.isSystem ? undefined : b.isActive } });
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در ویرایش عامل");
  }
});

router.delete("/payroll-components/:id", can(`${F_COMP}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const c = await prisma.payrollComponent.findUnique({ where: { id } });
  if (!c) return res.status(404).json({ error: "عامل یافت نشد" });
  if (c.isSystem) return res.status(400).json({ error: "عامل سیستمی قابل حذف نیست (می‌توانید روش محاسبه‌ی آن را ویرایش کنید)" });
  if (await prisma.payrollSlipLine.count({ where: { source: "PAYROLL_COMPONENT", refId: id } })) {
    return res.status(400).json({ error: "این عامل در فیش‌های محاسبه‌شده استفاده شده و قابل حذف نیست" });
  }
  const refText = `[C:${c.key}`;
  const users = (await prisma.payrollFactorMethod.findMany({ where: { NOT: { payrollComponentId: id } } })).filter(
    (m) => (m.formulaText ?? "").toUpperCase().includes(refText) || (m.conditionText ?? "").toUpperCase().includes(refText)
  );
  if (users.length) return res.status(400).json({ error: "فرمول عامل‌های دیگر به این عامل ارجاع دارد" });
  await prisma.payrollComponent.delete({ where: { id } });
  res.status(204).send();
});

// ════════════ روش محاسبه عامل ════════════
const shapeMethod = (m: any, today: Date) => ({
  id: m.id,
  basis: m.decreeComponentId ? "decree" : "payroll",
  factorId: m.decreeComponentId ?? m.payrollComponentId,
  factorTitle: m.decreeComponent?.title ?? m.payrollComponent?.title ?? "",
  method: m.method,
  valueType: m.valueType,
  issueYear: m.issueYear,
  issueMonth: m.issueMonth,
  execYear: m.execYear,
  execMonth: m.execMonth,
  fixedValue: m.fixedValue === null ? null : m.fixedValue.toString(),
  conditionText: m.conditionText,
  formulaText: m.formulaText,
  isProvisional: m.isProvisional,
  isCurrent: false as boolean,
  _eff: m.effectiveDate as Date,
  _today: today,
});

router.get("/payroll-methods", can(`${F_METH}.view`), async (_req, res) => {
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  const rows = await prisma.payrollFactorMethod.findMany({
    include: { decreeComponent: { select: { title: true } }, payrollComponent: { select: { title: true } } },
    orderBy: [{ effectiveDate: "desc" }, { id: "desc" }],
  });
  // «جاری» = آخرین رکورد هر عامل با تاریخ اجرای ≤ امروز
  const cur = new Set<string>();
  const locked = await lockedMethodIds();
  const out = rows.map((m) => {
    const s = { ...shapeMethod(m, today), locked: locked.has(m.id) };
    const k = `${s.basis}:${s.factorId}`;
    if (m.effectiveDate <= today && !cur.has(k)) {
      cur.add(k);
      s.isCurrent = true;
    }
    const { _eff, _today, ...rest } = s;
    return rest;
  });
  res.json(out);
});

// داده‌ی پنجره‌ی فرمول‌نویس: دسته‌بندی عوامل، طبقه‌ها، متغیرها و پارامترهای مبنا
router.get("/payroll-methods/palette", can(`${F_METH}.view`), async (_req, res) => {
  const [decree, comps, params, methods] = await Promise.all([
    prisma.decreeComponent.findMany({ orderBy: { code: "asc" } }),
    prisma.payrollComponent.findMany({ where: { isActive: true }, orderBy: { id: "asc" } }),
    prisma.payrollParameter.findMany({ where: { isActive: true }, orderBy: { id: "asc" } }),
    prisma.payrollFactorMethod.findMany({ where: { payrollComponentId: { not: null } }, orderBy: { effectiveDate: "desc" } }),
  ]);
  const latest = new Map<number, (typeof methods)[number]>();
  for (const m of methods) if (!latest.has(m.payrollComponentId!)) latest.set(m.payrollComponentId!, m);
  const byMethod = (method: string) => {
    const kinds = KINDS.map((k) => ({
      kind: k,
      title: KIND_FA[k],
      factors: comps.filter((c) => latest.get(c.id)?.method === method && c.kind === k).map((c) => ({ key: c.key, title: c.title, valueType: latest.get(c.id)!.valueType })),
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
      { method: "FIXED", title: "عامل مقدار ثابت", classes: byMethod("FIXED"), variants: ["VALUE", "YTD_PREV", "ALL_PREV", "PREV"].map((k) => ({ key: k, title: FACTOR_VARIANTS[k] })) },
    ],
    baseInfo: Object.entries(BASE_INFO).map(([k, t]) => ({ key: k, title: t })),
    classTotals: KINDS.map((k) => ({ key: k, title: `جمع ${KIND_FA[k]}` })),
    params: params.map((p) => ({ key: p.key, title: p.title, type: p.type })),
  });
});

// بررسی زودهنگام شرط/فرمول (پنجره‌ی فرمول‌نویس)
router.post("/payroll-methods/validate", can(`${F_METH}.view`), async (req, res) => {
  const b = req.body as any;
  try {
    let node: string;
    let kindOfFactor = "EARNING";
    if (b.basis === "decree") {
      const d = await prisma.decreeComponent.findUnique({ where: { id: Number(b.factorId) } });
      if (!d) throw new PayrollCalcError("عامل حکم را انتخاب کنید");
      node = `D:${d.code}`;
    } else {
      const comp = b.factorId ? await prisma.payrollComponent.findUnique({ where: { id: Number(b.factorId) } }) : null;
      node = `C:${comp?.key ?? "NEW_FACTOR"}`;
      kindOfFactor = comp?.kind ?? "EARNING";
    }
    await validateFactorMethod({
      node,
      kind: kindOfFactor as any,
      method: b.basis === "decree" ? "CALCULATED" : b.method ?? "CALCULATED",
      conditionText: str(b.conditionText),
      formulaText: str(b.formulaText),
    });
    res.json({ ok: true });
  } catch (e: any) {
    res.json({ ok: false, error: e.message });
  }
});

router.get("/payroll-methods/:id", can(`${F_METH}.view`), async (req, res) => {
  const m = await prisma.payrollFactorMethod.findUnique({
    where: { id: Number(req.params.id) },
    include: { decreeComponent: { select: { title: true } }, payrollComponent: { select: { title: true } } },
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
  }
  const method = basis === "decree" ? "CALCULATED" : b.method;
  if (!METHODS.includes(method)) throw new PayrollCalcError("روش را انتخاب کنید");
  if (!VALUE_TYPES.includes(b.valueType)) throw new PayrollCalcError("نوع پارامتر را انتخاب کنید");
  const iy = Number(b.issueYear), im = Number(b.issueMonth), ey = Number(b.execYear), em = Number(b.execMonth);
  for (const [y, m, label] of [[iy, im, "ماه صدور"], [ey, em, "ماه اجرا"]] as const) {
    if (!Number.isInteger(y) || y < 1300 || y > 1600 || !Number.isInteger(m) || m < 1 || m > 12) throw new PayrollCalcError(`${label} نامعتبر است`);
  }
  if (ey * 12 + em < iy * 12 + im) throw new PayrollCalcError("ماه اجرا نمی‌تواند قبل از ماه صدور باشد");
  // اولین روز ماه اجرا (میلادی)
  const { jalaliMonthRange } = await import("../utils/jalaliDate");
  const effectiveDate = jalaliMonthRange(ey, em).start;
  let fixedValue: number | null = null;
  if (method === "FIXED") {
    fixedValue = Number(b.fixedValue);
    if (b.fixedValue === undefined || b.fixedValue === null || b.fixedValue === "" || !isFinite(fixedValue)) throw new PayrollCalcError("مقدار ثابت الزامی است");
  }
  const conditionText = str(b.conditionText);
  const formulaText = str(b.formulaText);
  await validateFactorMethod({ node, kind: kind as any, method, conditionText, formulaText });
  const isCalc = method === "CALCULATED";
  return {
    basis,
    factorId,
    data: {
      method,
      valueType: b.valueType,
      issueYear: iy,
      issueMonth: im,
      execYear: ey,
      execMonth: em,
      effectiveDate,
      fixedValue,
      conditionText: isCalc ? conditionText : null,
      formulaText: isCalc ? formulaText : null,
      isProvisional: false,
    },
  };
}

router.post("/payroll-methods", can(`${F_METH}.create`), async (req, res) => {
  try {
    const { basis, factorId, data } = await methodData(req.body, null);
    const where = basis === "decree" ? { decreeComponentId: factorId } : { payrollComponentId: factorId };
    const latest = await prisma.payrollFactorMethod.findFirst({ where, orderBy: { effectiveDate: "desc" } });
    if (latest && data.effectiveDate <= latest.effectiveDate) {
      throw new PayrollCalcError(`ماه اجرا باید بعد از ماه اجرای آخرین روش این عامل (${latest.execYear}/${latest.execMonth}) باشد`);
    }
    const created = await prisma.payrollFactorMethod.create({ data: { ...where, ...data } });
    res.status(201).json({ id: created.id });
  } catch (e) {
    fail(res, e, "خطا در ثبت روش محاسبه");
  }
});

router.put("/payroll-methods/:id", can(`${F_METH}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  try {
    const m = await prisma.payrollFactorMethod.findUnique({ where: { id } });
    if (!m) return res.status(404).json({ error: "روش یافت نشد" });
    const lockMsg = await methodLockMessage(m);
    if (lockMsg) throw new PayrollCalcError(lockMsg);
    // عامل و مبنای یک رکورد تغییر نمی‌کند
    const body = { ...req.body, basis: m.decreeComponentId ? "decree" : "payroll", factorId: m.decreeComponentId ?? m.payrollComponentId };
    const { data } = await methodData(body, id);
    const same = m.decreeComponentId ? { decreeComponentId: m.decreeComponentId } : { payrollComponentId: m.payrollComponentId };
    const [prev, next] = await Promise.all([
      prisma.payrollFactorMethod.findFirst({ where: { ...same, effectiveDate: { lt: m.effectiveDate } }, orderBy: { effectiveDate: "desc" } }),
      prisma.payrollFactorMethod.findFirst({ where: { ...same, effectiveDate: { gt: m.effectiveDate } }, orderBy: { effectiveDate: "asc" } }),
    ]);
    if (prev && data.effectiveDate <= prev.effectiveDate) throw new PayrollCalcError(`ماه اجرا باید بعد از روش قبلی (${prev.execYear}/${prev.execMonth}) بماند`);
    if (next && data.effectiveDate >= next.effectiveDate) throw new PayrollCalcError(`ماه اجرا باید قبل از روش بعدی (${next.execYear}/${next.execMonth}) بماند`);
    await prisma.payrollFactorMethod.update({ where: { id }, data });
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
    const emps = await prisma.employee.findMany({
      where: { periods: { some: { startDate: { lte: range.end }, OR: [{ endDate: null }, { endDate: { gte: range.start } }] } } },
      include: { party: { select: { firstName: true, lastName: true, name: true } } },
      orderBy: { personnelCode: "asc" },
    });
    const slips = await prisma.payrollSlip.findMany({ where: { year, month, employeeId: { in: emps.map((e) => e.id) } } });
    const decrees = await getEffectiveDecrees(emps.map((e) => e.id), range.end);
    res.json({
      monthDays: range.days,
      rows: emps.map((e) => {
        const s = slips.find((x) => x.employeeId === e.id);
        return {
          employeeId: e.id,
          personnelCode: e.personnelCode,
          fullName: [e.party.firstName, e.party.lastName].filter(Boolean).join(" ") || e.party.name || "",
          decreeValidity: decrees.get(e.id)?.validity ?? "NONE",
          slip: s ? { id: s.id, netPay: s.netPay.toString(), hasErrors: s.hasErrors, calculatedAt: s.calculatedAt } : null,
        };
      }),
    });
  } catch (e) {
    fail(res, e, "خطا در بارگذاری فهرست پرسنل");
  }
});

// محاسبه‌ی گروهیِ کارمندان انتخاب‌شده در یک ماه؛ هر کارمند مستقل است و خطای یکی مانع بقیه نمی‌شود
router.post("/payroll-calculations/calculate", can(`${F_CALC}.calculate`), async (req, res) => {
  const b = req.body as { year: number; month: number; employeeIds: number[] };
  try {
    const ids = Array.isArray(b.employeeIds) ? [...new Set(b.employeeIds.map(Number).filter(Boolean))] : [];
    if (ids.length === 0) throw new PayrollCalcError("هیچ کارمندی انتخاب نشده است");
    if (ids.length > 500) throw new PayrollCalcError("حداکثر ۵۰۰ کارمند در هر بار محاسبه");
    const results: { employeeId: number; ok: boolean; slipId?: number; error?: string }[] = [];
    for (const employeeId of ids) {
      try {
        const r = await calculatePayroll(employeeId, Number(b.year), Number(b.month));
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
  const b = req.body as { year: number; month: number; employeeIds: number[]; digits?: string };
  try {
    const ids = Array.isArray(b.employeeIds) ? [...new Set(b.employeeIds.map(Number).filter(Boolean))] : [];
    if (ids.length === 0) throw new PayrollCalcError("هیچ کارمندی انتخاب نشده است");
    if (ids.length > 500) throw new PayrollCalcError("حداکثر ۵۰۰ فیش در هر بار چاپ");
    const r = await buildPayrollSlipsPrint(Number(b.year), Number(b.month), ids, b.digits === "LATIN" ? "LATIN" : "PERSIAN");
    if (r.count === 0) throw new PayrollCalcError("برای کارمندان انتخاب‌شده در این ماه محاسبه‌ای ثبت نشده است؛ ابتدا محاسبه کنید");
    res.json(r);
  } catch (e) {
    fail(res, e, "خطا در آماده‌سازی چاپ فیش");
  }
});

// حذف محاسبه‌ی کارمندان انتخاب‌شده‌ی یک ماه (بدون حذف، محاسبه‌ی مجدد ممکن نیست)
router.post("/payroll-calculations/delete", can(`${F_CALC}.delete`), async (req, res) => {
  const b = req.body as { year: number; month: number; employeeIds: number[] };
  try {
    const ids = Array.isArray(b.employeeIds) ? [...new Set(b.employeeIds.map(Number).filter(Boolean))] : [];
    if (ids.length === 0) throw new PayrollCalcError("هیچ کارمندی انتخاب نشده است");
    const r = await prisma.payrollSlip.deleteMany({ where: { year: Number(b.year), month: Number(b.month), employeeId: { in: ids } } });
    res.json({ deleted: r.count });
  } catch (e) {
    fail(res, e, "خطا در حذف محاسبه");
  }
});

router.delete("/payroll-calculations/:id", can(`${F_CALC}.delete`), async (req, res) => {
  await prisma.payrollSlip.deleteMany({ where: { id: Number(req.params.id) } });
  res.status(204).send();
});

export default router;
