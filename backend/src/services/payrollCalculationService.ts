import { prisma } from "../lib/prisma";
import { getEffectiveDecree } from "./employmentDecreeService";
import { getParameterValues, type ParameterValue } from "./payrollParameterService";
import { Node, FormulaError, parseFormula, collectRefs, evaluate, TOTAL_VARS, VARIABLES, type EvalEnv } from "./payrollFormula";
import { jalaliMonthRange } from "../utils/jalaliDate";

// محاسبه‌ی حقوق یک کارمند در یک ماه شمسی. ترتیب: خطوط حکم (مزایا) ← اجزای حقوقِ مزیت (به ترتیب وابستگی) ← جمع‌های مشمول ←
// کسورات/سهم کارفرما/اطلاعاتی (به ترتیب وابستگی). مقدارهای قانونی و حکم در «آخرین روز ماه» خوانده می‌شوند؛ هر مبلغ به ریال گرد می‌شود.
// نتیجه با همه‌ی ورودی‌ها و ریز عملوندهای هر جزء ذخیره می‌شود تا گزارش بتواند هر محاسبه را نشان دهد.

export class PayrollCalcError extends Error {}

type Kind = "EARNING" | "DEDUCTION" | "EMPLOYER_COST" | "INFO";

export interface FormulaIssue {
  message: string;
}

/**
 * اعتبارسنجی یک فرمول در کنار بقیه‌ی اجزا: دستور، وجود عملوندها، مجازبودن جمع‌ها، وابستگی مجاز و نبودن دور.
 * others = سایر اجزای حقوق (key → {kind, formula}).
 */
export async function validateComponentFormula(
  key: string,
  kind: Kind,
  formula: string,
  others: { key: string; kind: Kind; formula: string }[]
): Promise<{ refs: { ns: string; key: string }[] }> {
  let ast: Node;
  try {
    ast = parseFormula(formula);
  } catch (e: any) {
    throw new PayrollCalcError(e.message);
  }
  const refs = collectRefs(ast);
  const byKey = new Map(others.filter((o) => o.key !== key).map((o) => [o.key, o]));
  const params = new Map((await prisma.payrollParameter.findMany()).map((p) => [p.key, p]));
  const decreeCodes = new Set((await prisma.decreeComponent.findMany({ select: { code: true } })).map((d) => String(d.code)));
  for (const r of refs) {
    if (r.ns === "D" && !decreeCodes.has(r.key)) throw new PayrollCalcError(`جزء حکم با کد ${r.key} وجود ندارد`);
    if (r.ns === "P" && !params.has(r.key)) throw new PayrollCalcError(`پارامتر قانونی ${r.key} تعریف نشده است`);
    if (r.ns === "V" && kind === "EARNING" && TOTAL_VARS.includes(r.key)) {
      throw new PayrollCalcError(`جزء مزیت نمی‌تواند [V:${r.key}] را بخواند (جمع مزایا بعد از محاسبه‌ی مزایا ساخته می‌شود)`);
    }
    if (r.ns === "C") {
      if (r.key === key) throw new PayrollCalcError("جزء نمی‌تواند به خودش ارجاع بدهد");
      const o = byKey.get(r.key);
      if (!o) throw new PayrollCalcError(`جزء حقوق ${r.key} وجود ندارد`);
      if (kind === "EARNING" && o.kind !== "EARNING") throw new PayrollCalcError(`جزء مزیت فقط می‌تواند به اجزای مزیت ارجاع بدهد (${r.key})`);
    }
  }
  // دور: DFS روی گراف وابستگی با فرمول جدید
  const graph = new Map<string, string[]>();
  for (const o of others) {
    if (o.key === key) continue;
    try {
      graph.set(o.key, collectRefs(parseFormula(o.formula)).filter((x) => x.ns === "C").map((x) => x.key));
    } catch {
      graph.set(o.key, []);
    }
  }
  graph.set(key, refs.filter((x) => x.ns === "C").map((x) => x.key));
  const state = new Map<string, number>();
  const visit = (k: string, path: string[]) => {
    if (state.get(k) === 2) return;
    if (state.get(k) === 1) throw new PayrollCalcError(`ارجاع دوری بین اجزا: ${[...path, k].join(" ← ")}`);
    state.set(k, 1);
    for (const d of graph.get(k) ?? []) visit(d, [...path, k]);
    state.set(k, 2);
  };
  visit(key, []);
  return { refs };
}

function topoSort<T extends { key: string; deps: string[] }>(items: T[]): T[] {
  const by = new Map(items.map((i) => [i.key, i]));
  const out: T[] = [];
  const done = new Set<string>();
  const visit = (i: T) => {
    if (done.has(i.key)) return;
    done.add(i.key);
    for (const d of i.deps) {
      const x = by.get(d);
      if (x) visit(x);
    }
    out.push(i);
  };
  items.forEach(visit);
  return out;
}

const rial = (v: number) => Math.round(v);
const fmtInt = (v: number) => Math.round(v).toLocaleString("en-US");

interface LineOut {
  kind: Kind;
  source: "DECREE_COMPONENT" | "PAYROLL_COMPONENT";
  refId: number | null;
  title: string;
  formula: string | null;
  insurable: boolean;
  taxable: boolean;
  amount: number;
  error: string | null;
  trace: { expression: string; operands: unknown[]; note?: string };
}

interface ProfileLite {
  prorate: boolean;
  insurable: boolean;
  taxable: boolean;
  overtimeBase: boolean;
  isProvisional: boolean;
  effectiveDate: Date;
}

export async function calculatePayroll(
  employeeId: number,
  year: number,
  month: number,
  input?: { workDays?: number; overtimeHours?: number }
): Promise<{ slipId: number }> {
  if (!Number.isInteger(year) || year < 1300 || year > 1600 || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new PayrollCalcError("سال یا ماه نامعتبر است");
  }
  const emp = await prisma.employee.findUnique({ where: { id: employeeId }, include: { party: true } });
  if (!emp) throw new PayrollCalcError("کارمند یافت نشد");
  const range = jalaliMonthRange(year, month);
  const warnings: string[] = [];

  // ── کارکرد ماهانه ──
  let work = await prisma.payrollMonthlyWork.findUnique({ where: { employeeId_year_month: { employeeId, year, month } } });
  if (input && (input.workDays !== undefined || input.overtimeHours !== undefined)) {
    const wd = input.workDays ?? (work ? Number(work.workDays) : NaN);
    const ot = input.overtimeHours ?? (work ? Number(work.overtimeHours) : 0);
    if (!isFinite(wd) || wd < 0 || wd > range.days) throw new PayrollCalcError(`روز کارکرد باید بین ۰ و ${range.days} باشد`);
    if (!isFinite(ot) || ot < 0) throw new PayrollCalcError("ساعت اضافه‌کار نامعتبر است");
    work = await prisma.payrollMonthlyWork.upsert({
      where: { employeeId_year_month: { employeeId, year, month } },
      create: { employeeId, year, month, workDays: wd, overtimeHours: ot },
      update: { workDays: wd, overtimeHours: ot },
    });
  }
  if (!work) throw new PayrollCalcError("کارکرد ماهانه‌ی این کارمند برای این ماه ثبت نشده است");
  const workDays = Number(work.workDays);
  const overtimeHours = Number(work.overtimeHours);
  if (workDays > range.days) throw new PayrollCalcError(`روز کارکرد (${workDays}) بیشتر از روزهای ماه (${range.days}) است`);

  // ── حکم مؤثر (در آخرین روز ماه) ──
  const eff = await getEffectiveDecree(employeeId, range.end);
  if (!eff.decree || eff.validity !== "VALID") {
    throw new PayrollCalcError(eff.validity === "EXPIRED" ? "حکم این کارمند در این ماه منقضی شده است" : "برای این کارمند در این ماه حکم تاییدشده‌ی معتبر وجود ندارد");
  }
  const decree = await prisma.employmentDecree.findUnique({
    where: { id: eff.decree.id },
    include: { lines: { include: { component: true }, orderBy: { id: "asc" } } },
  });
  if (!decree) throw new PayrollCalcError("حکم یافت نشد");
  const changed = await prisma.employmentDecree.findFirst({
    where: { employeeId, status: "APPROVED", effectiveDate: { gt: range.start, lte: range.end }, NOT: { id: decree.id } },
    select: { number: true },
  });
  if (changed || decree.effectiveDate > range.start) {
    warnings.push("حکم کارمند در طول همین ماه تغییر کرده یا شروع شده است؛ در این نسخه کل ماه با آخرین حکم ماه محاسبه می‌شود (تفکیک روزانه انجام نمی‌شود)");
  }

  // ── پارامترها، مشخصات، اجزا ──
  const params = await getParameterValues(range.end);
  const paramDefs = new Map((await prisma.payrollParameter.findMany()).map((p) => [p.key, p]));
  const components = await prisma.payrollComponent.findMany({ where: { isActive: true }, orderBy: { id: "asc" } });
  const allProfiles = await prisma.payrollItemProfile.findMany({ where: { effectiveDate: { lte: range.end } }, orderBy: { effectiveDate: "desc" } });
  const profileOf = (kind: "decree" | "payroll", id: number): ProfileLite | null =>
    allProfiles.find((p) => (kind === "decree" ? p.decreeComponentId === id : p.payrollComponentId === id)) ?? null;
  const decreeByCode = new Map((await prisma.decreeComponent.findMany()).map((d) => [String(d.code), d]));

  const lines: LineOut[] = [];
  const decreeAmounts = new Map<string, number>(); // کد جزء حکم → مبلغ این ماه
  const compAmounts = new Map<string, number>(); // کلید جزء حقوق → مبلغ
  const compErrors = new Set<string>();
  let overtimeBase = 0;

  const profileNote = (p: ProfileLite | null, title: string) => {
    if (!p) warnings.push(`برای «${title}» مشخصات محاسبه‌ای تعریف نشده است؛ مشمول بیمه/مالیات در نظر گرفته نشد`);
    else if (p.isProvisional) warnings.push(`مشخصات محاسبه‌ی «${title}» پیش‌فرض نصب و تاییدنشده است`);
  };

  // ۱) خطوط حکم
  for (const l of decree.lines) {
    const c = l.component;
    const v = Number(l.value);
    const prof = profileOf("decree", c.id);
    profileNote(prof, c.title);
    let amount = 0;
    let full = 0;
    let expr = "";
    let err: string | null = null;
    const operands: unknown[] = [{ ref: `[D:${c.code}]`, label: `مقدار در حکم (${DECREE_VALUE_FA[c.valueType]})`, value: v }];
    if (c.valueType === "MONTHLY_AMOUNT") {
      full = v;
      if (prof?.prorate ?? true) {
        amount = (v * workDays) / range.days;
        operands.push({ ref: "[V:WORK_DAYS]", label: VARIABLES.WORK_DAYS, value: workDays }, { ref: "[V:MONTH_DAYS]", label: VARIABLES.MONTH_DAYS, value: range.days });
        expr = `${fmtInt(v)} × ${workDays} ÷ ${range.days}`;
      } else {
        amount = v;
        expr = `${fmtInt(v)} (بدون تناسب با روز کارکرد)`;
      }
    } else if (c.valueType === "DAILY_AMOUNT") {
      full = v * range.days;
      amount = v * workDays;
      operands.push({ ref: "[V:WORK_DAYS]", label: VARIABLES.WORK_DAYS, value: workDays });
      expr = `${fmtInt(v)} × ${workDays}`;
    } else {
      err = `نوع مقدار «${DECREE_VALUE_FA[c.valueType]}» در این نسخه‌ی محاسبه پشتیبانی نمی‌شود`;
      expr = "—";
    }
    amount = rial(amount);
    decreeAmounts.set(String(c.code), amount);
    if (prof?.overtimeBase && !err) overtimeBase += full;
    lines.push({
      kind: "EARNING",
      source: "DECREE_COMPONENT",
      refId: c.id,
      title: c.title,
      formula: null,
      insurable: !!prof?.insurable,
      taxable: !!prof?.taxable,
      amount: err ? 0 : amount,
      error: err,
      trace: { expression: expr, operands, note: prof?.overtimeBase ? `در مبنای اضافه‌کار با مبلغ ماهانه‌ی کامل ${fmtInt(full)}` : undefined },
    });
  }

  // ── محیط ارزیابی ──
  const vars: Record<string, number | undefined> = {
    WORK_DAYS: workDays,
    MONTH_DAYS: range.days,
    OVERTIME_HOURS: overtimeHours,
    OVERTIME_BASE_TOTAL: rial(overtimeBase),
  };
  const usedParams = new Map<string, ParameterValue>();
  const titleOf = (ns: "D" | "C" | "P" | "V", key: string) => {
    if (ns === "D") return decreeByCode.get(key)?.title ?? `جزء حکم ${key}`;
    if (ns === "C") return components.find((c) => c.key === key)?.title ?? key;
    if (ns === "P") return paramDefs.get(key)?.title ?? key;
    return VARIABLES[key] ?? key;
  };
  const env: EvalEnv = {
    label: titleOf,
    scalar(ns, key) {
      if (ns === "D") {
        if (!decreeByCode.has(key)) throw new FormulaError(`جزء حکم ${key} وجود ندارد`);
        return decreeAmounts.get(key) ?? 0;
      }
      if (ns === "C") {
        if (compErrors.has(key)) throw new FormulaError(`جزء «${titleOf("C", key)}» خطا دارد`);
        const v = compAmounts.get(key);
        if (v === undefined) throw new FormulaError(`جزء «${titleOf("C", key)}» هنوز محاسبه نشده است`);
        return v;
      }
      if (ns === "P") {
        const pv = params.get(key);
        const def = paramDefs.get(key);
        if (!def) throw new FormulaError(`پارامتر ${key} تعریف نشده است`);
        if (!pv || pv.value === null) throw new FormulaError(`پارامتر قانونی «${def.title}» برای این ماه مقدار ندارد (در «پارامترهای قانونی» تعریف کنید)`);
        usedParams.set(key, pv);
        return pv.value;
      }
      const v = vars[key];
      if (v === undefined) throw new FormulaError(`متغیر ${key} در این مرحله در دسترس نیست`);
      return v;
    },
    brackets(key) {
      const pv = params.get(key);
      const def = paramDefs.get(key);
      if (!pv || pv.type !== "BRACKETS" || pv.brackets.length === 0) throw new FormulaError(`جدول پلکانی «${def?.title ?? key}» برای این ماه تعریف نشده است`);
      usedParams.set(key, pv);
      return pv.brackets;
    },
  };

  // جزء حقوق → آماده‌ی ترتیب
  const prepared = components.map((c) => {
    let ast: Node | null = null;
    let parseErr: string | null = null;
    try {
      ast = parseFormula(c.formula);
    } catch (e: any) {
      parseErr = e.message;
    }
    return { ...c, ast, parseErr, deps: ast ? collectRefs(ast).filter((r) => r.ns === "C").map((r) => r.key) : [] };
  });

  const runComponent = (c: (typeof prepared)[number]) => {
    const prof = profileOf("payroll", c.id);
    let amount = 0;
    let error: string | null = null;
    let trace: LineOut["trace"] = { expression: "", operands: [] };
    try {
      if (!c.ast) throw new FormulaError(c.parseErr ?? "فرمول نامعتبر");
      const r = evaluate(c.ast, env);
      amount = rial(r.value);
      trace = { expression: r.expression, operands: r.operands };
    } catch (e: any) {
      error = e.message;
      compErrors.add(c.key);
    }
    if (!error) compAmounts.set(c.key, amount);
    if (c.kind === "EARNING") profileNote(prof, c.title);
    lines.push({
      kind: c.kind,
      source: "PAYROLL_COMPONENT",
      refId: c.id,
      title: c.title,
      formula: c.formula,
      insurable: c.kind === "EARNING" && !!prof?.insurable,
      taxable: c.kind === "EARNING" && !!prof?.taxable,
      amount: error ? 0 : amount,
      error,
      trace,
    });
  };

  // ۲) اجزای مزیت
  for (const c of topoSort(prepared.filter((x) => x.kind === "EARNING"))) runComponent(c);
  // ۳) جمع‌ها
  const earningLines = lines.filter((l) => l.kind === "EARNING" && !l.error);
  vars.EARNINGS_TOTAL = earningLines.reduce((a, l) => a + l.amount, 0);
  vars.INSURABLE_TOTAL = earningLines.filter((l) => l.insurable).reduce((a, l) => a + l.amount, 0);
  vars.TAXABLE_TOTAL = earningLines.filter((l) => l.taxable).reduce((a, l) => a + l.amount, 0);
  // ۴) کسورات / سهم کارفرما / اطلاعاتی
  for (const c of topoSort(prepared.filter((x) => x.kind !== "EARNING"))) runComponent(c);

  const sum = (k: Kind) => lines.filter((l) => l.kind === k && !l.error).reduce((a, l) => a + l.amount, 0);
  const earnings = sum("EARNING");
  const deductions = sum("DEDUCTION");
  const employerCosts = sum("EMPLOYER_COST");
  const hasErrors = lines.some((l) => !!l.error);

  const paramsOut: Record<string, unknown> = {};
  for (const [k, pv] of usedParams) {
    paramsOut[k] = {
      title: paramDefs.get(k)?.title ?? k,
      type: pv.type,
      effectiveDate: pv.effectiveDate.toISOString().slice(0, 10),
      isProvisional: pv.isProvisional,
      value: pv.value,
      brackets: pv.brackets,
    };
    if (pv.isProvisional) warnings.push(`پارامتر قانونی «${paramDefs.get(k)?.title ?? k}» پیش‌فرض نصب و تاییدنشده است`);
  }

  const slip = await prisma.$transaction(async (tx) => {
    await tx.payrollSlip.deleteMany({ where: { employeeId, year, month } });
    return tx.payrollSlip.create({
      data: {
        employeeId,
        year,
        month,
        decreeId: decree.id,
        monthDays: range.days,
        workDays,
        overtimeHours,
        earnings,
        deductions,
        employerCosts,
        netPay: earnings - deductions,
        hasErrors,
        parameters: paramsOut as any,
        warnings: [...new Set(warnings)] as any,
        lines: {
          create: lines.map((l, i) => ({
            seq: i + 1,
            kind: l.kind,
            source: l.source,
            refId: l.refId,
            title: l.title,
            formula: l.formula,
            insurable: l.insurable,
            taxable: l.taxable,
            amount: l.amount,
            error: l.error,
            trace: l.trace as any,
          })),
        },
      },
    });
  });
  return { slipId: slip.id };
}

const DECREE_VALUE_FA: Record<string, string> = { MONTHLY_AMOUNT: "ماهانه", DAILY_AMOUNT: "روزانه", HOURLY_AMOUNT: "ساعتی", PERCENT: "درصد" };
