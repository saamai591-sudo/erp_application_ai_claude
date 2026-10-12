import { prisma } from "../lib/prisma";
import { getEffectiveDecree } from "./employmentDecreeService";
import { getParameterValues, type ParameterValue } from "./payrollParameterService";
import {
  Cond,
  FormulaError,
  Node,
  RefInfo,
  BASE_INFO,
  DECREE_VARIANTS,
  FACTOR_VARIANTS,
  KIND_FA,
  collectCondRefs,
  collectRefs,
  evaluate,
  evaluateCondition,
  parseCondition,
  parseFormula,
  type EvalEnv,
  type Operand,
} from "./payrollFormula";
import { jalaliMonthRange } from "../utils/jalaliDate";

// محاسبه‌ی حقوق یک کارمند در یک ماه شمسی بر اساس «روش محاسبه عامل»ها:
//  • هر عامل حکم موجود در حکم مؤثر و هر عامل حقوق فعال، روش مؤثر خودش را (آخرین رکورد با ماه اجرا ≤ پایان ماه) دارد؛
//  • ترتیب محاسبه از وابستگی عملوندها (و جمع طبقه [S:…]) به‌دست می‌آید؛ دور رد می‌شود؛
//  • عامل با روش ورودی (دستی/تردد/خزانه) مقدارش را از PayrollFactorInput همین ماه می‌گیرد؛ مقدار ثابت از خود روش؛
//  • شرط اگر برقرار نباشد مقدار عامل صفر است. هر مبلغ به ریال گرد می‌شود.
// حکم و پارامترهای قانونی در «آخرین روز ماه» خوانده می‌شوند. نتیجه با همه‌ی ورودی‌ها و ریز عملوندها ذخیره می‌شود تا گزارش نیازی به محاسبه‌ی دوباره نداشته باشد.

export class PayrollCalcError extends Error {}

type Kind = "EARNING" | "DEDUCTION" | "EMPLOYER_COST" | "INFO";
type Method = "CALCULATED" | "FIXED" | "MANUAL" | "ATTENDANCE" | "TREASURY";

export const METHOD_FA: Record<string, string> = {
  CALCULATED: "محاسباتی",
  FIXED: "مقدار ثابت",
  MANUAL: "ورود دستی",
  ATTENDANCE: "ورود از سیستم تردد",
  TREASURY: "ورود از سیستم خزانه‌داری",
};
export const INPUT_METHODS: Method[] = ["MANUAL", "ATTENDANCE", "TREASURY"];

const DECREE_VALUE_FA: Record<string, string> = { MONTHLY_AMOUNT: "ماهانه", DAILY_AMOUNT: "روزانه", HOURLY_AMOUNT: "ساعتی", PERCENT: "درصد" };

// ── اعتبارسنجی روش (هنگام ذخیره) ──

interface CandidateMethod {
  /** گره‌ی روش: D:<کد> یا C:<کلید> */
  node: string;
  kind: Kind;
  method: Method;
  conditionText: string | null;
  formulaText: string | null;
}

function parseTexts(m: { conditionText: string | null; formulaText: string | null }): { cond: Cond | null; formula: Node | null } {
  let cond: Cond | null = null;
  let formula: Node | null = null;
  if (m.conditionText && m.conditionText.trim()) cond = parseCondition(m.conditionText);
  if (m.formulaText && m.formulaText.trim()) formula = parseFormula(m.formulaText);
  return { cond, formula };
}

function allRefs(p: { cond: Cond | null; formula: Node | null }): RefInfo[] {
  const out: RefInfo[] = [];
  if (p.cond) collectCondRefs(p.cond, out);
  if (p.formula) collectRefs(p.formula, out);
  return out;
}

/** یال‌های وابستگی یک روش: عملوندهایی که مقدار «همین ماه»ِ گره‌ی دیگر را می‌خواهند */
function edgesOf(
  self: string,
  refs: RefInfo[],
  nodes: { node: string; kind: Kind }[]
): string[] {
  const out = new Set<string>();
  for (const r of refs) {
    if (r.ns === "D" && r.variant === "VALUE") out.add(`D:${r.key}`);
    else if (r.ns === "C" && (r.variant === "VALUE" || r.variant === "YTD")) out.add(`C:${r.key}`);
    else if (r.ns === "S") nodes.filter((n) => n.kind === r.key).forEach((n) => out.add(n.node));
  }
  return [...out];
}

/** اعتبارسنجی یک روش در کنار روش‌های فعلی بقیه‌ی عامل‌ها: دستور، وجود عملوندها، دور */
export async function validateFactorMethod(cand: CandidateMethod): Promise<void> {
  const needsFormula = cand.method === "CALCULATED" || cand.node.startsWith("D:");
  if (needsFormula && !(cand.formulaText && cand.formulaText.trim())) throw new PayrollCalcError("فرمول الزامی است (آیکن فرمول را بزنید)");
  let parsed: { cond: Cond | null; formula: Node | null };
  try {
    parsed = needsFormula ? parseTexts(cand) : { cond: null, formula: null };
  } catch (e: any) {
    throw new PayrollCalcError(e.message);
  }
  const refs = allRefs(parsed);
  const [decree, comps, params] = await Promise.all([
    prisma.decreeComponent.findMany({ select: { code: true, title: true } }),
    prisma.payrollComponent.findMany({ select: { key: true, title: true } }),
    prisma.payrollParameter.findMany({ select: { key: true } }),
  ]);
  const dCodes = new Set(decree.map((d) => String(d.code)));
  const cKeys = new Set(comps.map((c) => c.key));
  const pKeys = new Set(params.map((p) => p.key));
  const titles = new Map<string, string>([...decree.map((d) => [`D:${d.code}`, d.title] as [string, string]), ...comps.map((x) => [`C:${x.key}`, x.title] as [string, string])]);
  for (const r of refs) {
    if (r.ns === "D" && !dCodes.has(r.key)) throw new PayrollCalcError("عامل حکم انتخاب‌شده در فرمول وجود ندارد");
    if (r.ns === "C" && !cKeys.has(r.key)) throw new PayrollCalcError("عامل حقوق انتخاب‌شده در فرمول وجود ندارد");
    if (r.ns === "P" && !pKeys.has(r.key)) throw new PayrollCalcError("پارامتر قانونی انتخاب‌شده در فرمول تعریف نشده است");
  }

  // گراف وابستگی با آخرین روش هر عامل + نامزد
  const latest = await prisma.payrollFactorMethod.findMany({ orderBy: { effectiveDate: "desc" }, include: { decreeComponent: { select: { code: true } }, payrollComponent: { select: { key: true } } } });
  const seen = new Set<string>();
  const nodes: { node: string; kind: Kind; method: Method; cond: string | null; formula: string | null }[] = [];
  for (const m of latest) {
    const node = m.decreeComponent ? `D:${m.decreeComponent.code}` : `C:${m.payrollComponent!.key}`;
    if (seen.has(node) || node === cand.node) continue;
    seen.add(node);
    nodes.push({ node, kind: m.kind as Kind, method: m.method as Method, cond: m.conditionText, formula: m.formulaText });
  }
  nodes.push({ node: cand.node, kind: cand.kind, method: cand.method, cond: cand.conditionText, formula: cand.formulaText });
  const kindNodes = nodes.map((n) => ({ node: n.node, kind: n.kind }));
  const graph = new Map<string, string[]>();
  for (const n of nodes) {
    let es: string[] = [];
    if (n.method === "CALCULATED" || n.node.startsWith("D:")) {
      try {
        es = edgesOf(n.node, allRefs(parseTexts({ conditionText: n.cond, formulaText: n.formula })), kindNodes);
      } catch {
        es = [];
      }
    }
    graph.set(n.node, es);
  }
  const state = new Map<string, number>();
  const label = (k: string) => `«${titles.get(k) ?? (k === cand.node ? "این عامل" : k.slice(2))}»`;
  const visit = (k: string, path: string[]) => {
    if (state.get(k) === 2) return;
    if (state.get(k) === 1) throw new PayrollCalcError(`ارجاع دوری بین عوامل: ${[...path, k].map(label).join(" ← ")}`);
    state.set(k, 1);
    for (const d of graph.get(k) ?? []) if (graph.has(d)) visit(d, [...path, k]);
    state.set(k, 2);
  };
  visit(cand.node, []);
}

// ── محاسبه ──

interface LineOut {
  kind: Kind;
  source: "DECREE_COMPONENT" | "PAYROLL_COMPONENT";
  refId: number;
  title: string;
  formula: string | null;
  amount: number;
  error: string | null;
  trace: { expression: string; operands: Operand[]; note?: string; method: string; valueType?: string; condition?: { text: string; expression: string; result: boolean } };
}

interface MethodRow {
  id: number;
  method: Method;
  kind: Kind;
  valueType: string;
  fixedValue: number | null;
  conditionText: string | null;
  formulaText: string | null;
  isProvisional: boolean;
}

interface FactorNode {
  node: string; // D:<code> | C:<key>
  source: "DECREE_COMPONENT" | "PAYROLL_COMPONENT";
  refId: number;
  title: string;
  method: MethodRow | null;
  parsed: { cond: Cond | null; formula: Node | null } | null;
  parseError: string | null;
  refs: RefInfo[];
  deps: string[];
  decreeValue?: number; // مقدار حکم (برای D)
  decreeValueType?: string;
}

const rial = (v: number) => Math.round(v);

function prevMonth(y: number, m: number) {
  return m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
}

export async function calculatePayroll(
  employeeId: number,
  year: number,
  month: number,
  inputs?: { componentId: number; value: number }[]
): Promise<{ slipId: number }> {
  if (!Number.isInteger(year) || year < 1300 || year > 1600 || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new PayrollCalcError("سال یا ماه نامعتبر است");
  }
  const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!emp) throw new PayrollCalcError("کارمند یافت نشد");
  const range = jalaliMonthRange(year, month);
  const yearDays = jalaliMonthRange(year, 12).days === 30 ? 366 : 365;
  const warnings: string[] = [];

  // ── حکم مؤثر ──
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

  // ── روش‌های مؤثر ──
  const methods = await prisma.payrollFactorMethod.findMany({ where: { effectiveDate: { lte: range.end } }, orderBy: { effectiveDate: "desc" } });
  const toRow = (m: (typeof methods)[number]): MethodRow => ({
    id: m.id,
    method: m.method as Method,
    kind: m.kind as Kind,
    valueType: m.valueType,
    fixedValue: m.fixedValue === null ? null : Number(m.fixedValue),
    conditionText: m.conditionText,
    formulaText: m.formulaText,
    isProvisional: m.isProvisional,
  });
  const decreeMethod = (id: number) => {
    const m = methods.find((x) => x.decreeComponentId === id);
    return m ? toRow(m) : null;
  };
  const payrollMethod = (id: number) => {
    const m = methods.find((x) => x.payrollComponentId === id);
    return m ? toRow(m) : null;
  };

  const payrollComps = await prisma.payrollComponent.findMany({ where: { isActive: true }, orderBy: { id: "asc" } });
  const allDecreeComps = await prisma.decreeComponent.findMany();
  const decreeByCode = new Map(allDecreeComps.map((d) => [String(d.code), d]));
  const compByKey = new Map(payrollComps.map((c) => [c.key, c]));

  // ── ورودی‌های ماه (و ذخیره‌ی ورودی‌های ارسالی) ──
  if (inputs && inputs.length) {
    for (const i of inputs) {
      const c = payrollComps.find((x) => x.id === i.componentId);
      if (!c) throw new PayrollCalcError("عامل ورودی یافت نشد");
      const m = payrollMethod(c.id);
      if (!m || !INPUT_METHODS.includes(m.method)) throw new PayrollCalcError(`عامل «${c.title}» روش ورودی ندارد`);
      if (!isFinite(i.value) || i.value < 0) throw new PayrollCalcError(`مقدار «${c.title}» نامعتبر است`);
      await prisma.payrollFactorInput.upsert({
        where: { employeeId_year_month_componentId: { employeeId, year, month, componentId: c.id } },
        create: { employeeId, year, month, componentId: c.id, value: i.value },
        update: { value: i.value },
      });
    }
  }
  const inputRows = await prisma.payrollFactorInput.findMany({ where: { employeeId, year, month } });
  const inputByComp = new Map(inputRows.map((r) => [r.componentId, Number(r.value)]));

  // ── گره‌ها ──
  const nodes: FactorNode[] = [];
  const mk = (n: Omit<FactorNode, "parsed" | "parseError" | "refs" | "deps">): FactorNode => {
    let parsed: FactorNode["parsed"] = null;
    let parseError: string | null = null;
    if (n.method && (n.method.method === "CALCULATED" || n.source === "DECREE_COMPONENT")) {
      try {
        parsed = parseTexts(n.method);
        if (!parsed.formula) throw new FormulaError("فرمول تعریف نشده است");
      } catch (e: any) {
        parseError = e.message;
      }
    }
    return { ...n, parsed, parseError, refs: parsed ? allRefs(parsed) : [], deps: [] };
  };
  for (const l of decree.lines) {
    nodes.push(
      mk({
        node: `D:${l.component.code}`,
        source: "DECREE_COMPONENT",
        refId: l.component.id,
        title: l.component.title,
        method: decreeMethod(l.component.id),
        decreeValue: Number(l.value),
        decreeValueType: l.component.valueType,
      })
    );
  }
  for (const c of payrollComps) {
    const m = payrollMethod(c.id);
    if (!m) {
      warnings.push(`برای عامل حقوق «${c.title}» روش محاسبه‌ای تعریف نشده است؛ در محاسبه نیامد`);
      continue;
    }
    nodes.push(mk({ node: `C:${c.key}`, source: "PAYROLL_COMPONENT", refId: c.id, title: c.title, method: m }));
  }
  const kindNodes = nodes.map((n) => ({ node: n.node, kind: (n.method?.kind ?? "INFO") as Kind }));
  for (const n of nodes) n.deps = edgesOf(n.node, n.refs, kindNodes);

  // ترتیب توپولوژیک
  const byNode = new Map(nodes.map((n) => [n.node, n]));
  const order: FactorNode[] = [];
  const mark = new Map<string, number>();
  const cycleErr = new Set<string>();
  const visit = (n: FactorNode, path: string[]) => {
    if (mark.get(n.node) === 2) return;
    if (mark.get(n.node) === 1) {
      cycleErr.add(n.node);
      return;
    }
    mark.set(n.node, 1);
    for (const d of n.deps) {
      const x = byNode.get(d);
      if (x && x !== n) visit(x, [...path, n.node]);
      else if (x === n) cycleErr.add(n.node);
    }
    mark.set(n.node, 2);
    order.push(n);
  };
  nodes.forEach((n) => visit(n, []));

  // ── پارامترها ──
  const params = await getParameterValues(range.end);
  const paramDefs = new Map((await prisma.payrollParameter.findMany()).map((p) => [p.key, p]));
  const usedParams = new Map<string, ParameterValue>();

  // ── تاریخچه‌ی فیش‌های قبلی ──
  const prevSlips = await prisma.payrollSlip.findMany({
    where: { employeeId, OR: [{ year: { lt: year } }, { year, month: { lt: month } }] },
    include: { lines: { select: { source: true, refId: true, amount: true } } },
  });
  const history = (source: string, refId: number, variant: "PREV" | "YTD_PREV" | "ALL_PREV") => {
    const pm = prevMonth(year, month);
    let sum = 0;
    for (const s of prevSlips) {
      const inScope = variant === "ALL_PREV" ? true : variant === "YTD_PREV" ? s.year === year : s.year === pm.y && s.month === pm.m;
      if (!inScope) continue;
      for (const l of s.lines) if (l.source === source && l.refId === refId) sum += Number(l.amount);
    }
    return sum;
  };

  // میانگین حکم (وزنی بر روز) از ابتدای سال شمسی (یا اولین حکم) تا پایان ماه
  const allDecrees = await prisma.employmentDecree.findMany({
    where: { employeeId, status: "APPROVED", effectiveDate: { lte: range.end } },
    orderBy: { effectiveDate: "asc" },
    include: { lines: { include: { component: { select: { code: true } } } } },
  });
  const averageOf = (code: string) => {
    if (allDecrees.length === 0) return 0;
    const yearStart = jalaliMonthRange(year, 1).start;
    const start = new Date(Math.max(yearStart.getTime(), allDecrees[0].effectiveDate.getTime()));
    let total = 0;
    let acc = 0;
    allDecrees.forEach((d, i) => {
      const segStart = new Date(Math.max(d.effectiveDate.getTime(), start.getTime()));
      const next = allDecrees[i + 1];
      const segEnd = next ? new Date(Math.min(next.effectiveDate.getTime() - 86400000, range.end.getTime())) : range.end;
      const days = Math.floor((segEnd.getTime() - segStart.getTime()) / 86400000) + 1;
      if (days <= 0) return;
      const line = d.lines.find((l) => String(l.component.code) === code);
      acc += (line ? Number(line.value) : 0) * days;
      total += days;
    });
    return total ? acc / total : 0;
  };

  // اطلاعات پایه
  const periods = await prisma.employmentPeriod.findMany({ where: { employeeId }, orderBy: { startDate: "asc" } });
  const cur = periods.find((p) => p.startDate <= range.end && (!p.endDate || p.endDate >= range.end)) ?? periods[periods.length - 1];
  const serviceDays = cur ? Math.max(0, Math.floor((range.end.getTime() - cur.startDate.getTime()) / 86400000) + 1) : 0;
  const base: Record<string, number> = {
    MONTH_DAYS: range.days,
    YEAR_DAYS: yearDays,
    SERVICE_DAYS: serviceDays,
    SERVICE_YEARS: Math.round((serviceDays / 365) * 100) / 100,
    MONTH_NO: month,
  };

  // ── محیط ارزیابی ──
  const amounts = new Map<string, number>(); // گره → مبلغ این ماه
  const errored = new Map<string, string>();
  const lines: LineOut[] = [];

  const titleOf = (ns: string, key: string): string => {
    if (ns === "D") return decreeByCode.get(key)?.title ?? `عامل حکم ${key}`;
    if (ns === "C") return compByKey.get(key)?.title ?? key;
    if (ns === "P") return paramDefs.get(key)?.title ?? key;
    if (ns === "B") return BASE_INFO[key] ?? key;
    return `جمع ${KIND_FA[key] ?? key}`;
  };
  const env: EvalEnv = {
    label(ns, key, variant) {
      const t = titleOf(ns, key);
      if (ns === "D") return `${t} — ${DECREE_VARIANTS[variant] ?? variant}`;
      if (ns === "C" && variant && variant !== "VALUE") return `${t} — ${FACTOR_VARIANTS[variant] ?? variant}`;
      return t;
    },
    scalar(ns, key, variant) {
      if (ns === "B") {
        if (!(key in base)) throw new FormulaError(`اطلاعات پایه‌ی ${key} موجود نیست`);
        return base[key];
      }
      if (ns === "P") {
        const pv = params.get(key);
        const def = paramDefs.get(key);
        if (!def) throw new FormulaError(`پارامتر ${key} تعریف نشده است`);
        if (!pv || pv.value === null) throw new FormulaError(`پارامتر قانونی «${def.title}» برای این ماه مقدار ندارد (در «پارامترهای قانونی» تعریف کنید)`);
        usedParams.set(key, pv);
        return pv.value;
      }
      if (ns === "S") {
        let sum = 0;
        for (const n of nodes) {
          if ((n.method?.kind ?? "INFO") !== key) continue;
          if (errored.has(n.node)) throw new FormulaError(`«${n.title}» خطا دارد و در جمع ${KIND_FA[key]} نمی‌آید`);
          sum += amounts.get(n.node) ?? 0;
        }
        return sum;
      }
      const node = `${ns}:${key}`;
      const n = byNode.get(node);
      const comp = ns === "D" ? decreeByCode.get(key) : compByKey.get(key);
      if (!comp) throw new FormulaError(`${ns === "D" ? "عامل حکم" : "عامل حقوق"} ${key} وجود ندارد`);
      const source = ns === "D" ? "DECREE_COMPONENT" : "PAYROLL_COMPONENT";
      if (ns === "D" && variant === "LAST") return n?.decreeValue ?? 0;
      if (ns === "D" && variant === "AVG") return averageOf(key);
      if (variant === "PREV" || variant === "YTD_PREV" || variant === "ALL_PREV") return history(source, comp.id, variant);
      // مقدار همین ماه
      if (errored.has(node)) throw new FormulaError(`«${comp.title}» خطا دارد`);
      let v: number;
      if (!n) {
        if (ns === "D") v = 0; // عامل در حکم نیامده
        else throw new FormulaError(`عامل «${comp.title}» در این ماه روش محاسبه ندارد`);
      } else {
        const got = amounts.get(node);
        if (got === undefined) throw new FormulaError(`عامل «${comp.title}» هنوز محاسبه نشده است`);
        v = got;
      }
      if (variant === "YTD") return v + history(source, comp.id, "YTD_PREV");
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

  const provisionalNotes = new Set<string>();
  for (const n of order) {
    const m = n.method;
    let amount = 0;
    let error: string | null = null;
    let trace: LineOut["trace"] = { expression: "", operands: [], method: "" };
    try {
      if (cycleErr.has(n.node)) throw new FormulaError("ارجاع دوری بین عوامل");
      if (!m) throw new FormulaError(n.source === "DECREE_COMPONENT" ? "روش محاسبه‌ی این عامل حکم تعریف نشده است" : "روش محاسبه تعریف نشده است");
      if (m.isProvisional) provisionalNotes.add(n.title);
      const compId = n.refId;
      if (n.source === "PAYROLL_COMPONENT" && m.method === "FIXED") {
        if (m.fixedValue === null) throw new FormulaError("مقدار ثابت تعریف نشده است");
        amount = m.fixedValue;
        trace = { expression: String(m.fixedValue), operands: [], method: METHOD_FA.FIXED };
      } else if (n.source === "PAYROLL_COMPONENT" && INPUT_METHODS.includes(m.method)) {
        const v = inputByComp.get(compId);
        if (v === undefined) throw new FormulaError(`مقدار ورودی (${METHOD_FA[m.method]}) برای این ماه ثبت نشده است`);
        amount = v;
        trace = { expression: String(v), operands: [], method: METHOD_FA[m.method] };
      } else {
        if (n.parseError) throw new FormulaError(n.parseError);
        const p = n.parsed!;
        let skip = false;
        let condInfo: LineOut["trace"]["condition"];
        let condOperands: Operand[] = [];
        if (p.cond) {
          const c = evaluateCondition(p.cond, env);
          condInfo = { text: m.conditionText ?? "", expression: c.expression, result: c.value };
          condOperands = c.operands;
          if (!c.value) skip = true;
        }
        if (skip) {
          amount = 0;
          trace = { expression: "شرط برقرار نبود", operands: condOperands, method: METHOD_FA[n.source === "DECREE_COMPONENT" ? "CALCULATED" : m.method], condition: condInfo };
        } else {
          const r = evaluate(p.formula!, env);
          amount = r.value;
          trace = {
            expression: r.expression,
            operands: [...condOperands, ...r.operands.filter((o) => !condOperands.some((c) => c.ref === o.ref))],
            method: METHOD_FA.CALCULATED,
            condition: condInfo,
          };
          if (n.source === "DECREE_COMPONENT" && n.decreeValueType && !["MONTHLY_AMOUNT", "DAILY_AMOUNT"].includes(n.decreeValueType)) {
            trace.note = `نوع مقدار «${DECREE_VALUE_FA[n.decreeValueType]}» عامل حکم؛ فرمول عامل مبنای تبدیل است`;
          }
        }
      }
      amount = rial(amount);
      amounts.set(n.node, amount);
    } catch (e: any) {
      error = e.message;
      errored.set(n.node, e.message);
    }
    trace.valueType = m?.valueType;
    lines.push({
      kind: (m?.kind ?? "INFO") as Kind,
      source: n.source,
      refId: n.refId,
      title: n.title,
      formula: m?.formulaText ?? null,
      amount: error ? 0 : amount,
      error,
      trace,
    });
  }
  for (const t of provisionalNotes) warnings.push(`روش محاسبه‌ی «${t}» پیش‌فرض نصب و تاییدنشده است`);

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

  // ترتیب نمایش: طبقه‌ها (پرداختی، کسر، هزینه کارفرما، اطلاعاتی) و داخل هر طبقه به ترتیب محاسبه
  const kindOrder: Kind[] = ["EARNING", "DEDUCTION", "EMPLOYER_COST", "INFO"];
  const sorted = [...lines].sort((a, b) => kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind));

  const slip = await prisma.$transaction(async (tx) => {
    await tx.payrollSlip.deleteMany({ where: { employeeId, year, month } });
    return tx.payrollSlip.create({
      data: {
        employeeId,
        year,
        month,
        decreeId: decree.id,
        monthDays: range.days,
        earnings,
        deductions,
        employerCosts,
        netPay: earnings - deductions,
        hasErrors,
        parameters: paramsOut as any,
        warnings: [...new Set(warnings)] as any,
        lines: {
          create: sorted.map((l, i) => ({
            seq: i + 1,
            kind: l.kind,
            source: l.source,
            refId: l.refId,
            title: l.title,
            formula: l.formula,
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
