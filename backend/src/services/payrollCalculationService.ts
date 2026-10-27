import { prisma } from "../lib/prisma";
import { getEffectiveDecree } from "./employmentDecreeService";
import { getParameterValues, type ParameterValue } from "./payrollParameterService";
import { isPersonnelKind, loadEmployeeParamValues } from "./personnelValueService";
import {
  Cond,
  FormulaError,
  Node,
  RefInfo,
  BASE_INFO,
  DECREE_VARIANTS,
  FACTOR_VARIANTS,
  KIND_FA,
  LOAN_SUM_KEY,
  LOAN_SUM_LABEL,
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
import { getCalendarMonth, missingMonthMessage } from "./workCalendarService";
import { computeLoanMonth, loanChainMessage, storedLoanSum, type LoanMonthItem } from "./payrollLoanService";
import { getPeriods } from "./employmentStatusService";

// محاسبه‌ی حقوق یک کارمند در یک ماه شمسی بر اساس «روش محاسبه عامل»ها:
//  • هر عامل حکم موجود در حکم مؤثر و هر عامل حقوق فعال، روش مؤثر خودش را (آخرین رکورد با ماه اجرا ≤ پایان ماه) دارد؛
//  • ترتیب محاسبه از وابستگی عملوندها (و جمع طبقه [S:…]) به‌دست می‌آید؛ دور رد می‌شود؛
//  • عامل با روش ورودی (دستی/تردد/خزانه) مقدارش را از PayrollFactorInput همین ماه می‌گیرد؛ مقدار ثابت از خود روش؛
//  • شرط اگر برقرار نباشد مقدار عامل صفر است. هر مبلغ به ریال گرد می‌شود.
// «نوع محاسبه»: حقوق ماهانه (پایه) یا انواع دیگر (عیدی، ذخیره سنوات، بازخرید …). هر عامل حقوق به یک نوع تعلق دارد و هر نوع فیش جدا (کارمند+ماه+نوع) دارد؛
// محاسبه‌ی نوعِ غیرپایه فقط وقتی مجاز است که فیش «حقوق ماهانه»ی همان کارمند و ماه محاسبه شده باشد و فرمولش می‌تواند مقدار عامل‌های حقوق ماهانه را
// بخواند ([C:کلید] و [D:کد:VALUE] از روی همان فیش؛ [C:کلید:YTD] = همان مقدار + سال‌به‌تاریخ قبلی).
// حکم و پارامترهای مبنا در «آخرین روز ماه» خوانده می‌شوند. نتیجه با همه‌ی ورودی‌ها و ریز عملوندها ذخیره می‌شود تا گزارش نیازی به محاسبه‌ی دوباره نداشته باشد.

export class PayrollCalcError extends Error {}

type Kind = "WORK" | "EARNING" | "DEDUCTION" | "EMPLOYER_COST" | "INFO";
type Method = "CALCULATED" | "MANUAL" | "ATTENDANCE" | "TREASURY";

export const METHOD_FA: Record<string, string> = {
  CALCULATED: "محاسباتی",
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
  /** شاخه‌های «شرط ← فرمول» (ترتیب = اولویت) */
  branches: BranchInput[];
  /** نوع محاسبه‌ی عاملِ حقوق (برای عامل حکم لازم نیست: همیشه حقوق ماهانه) */
  calcTypeId?: number | null;
  /** مبناهایی (پارامتر نوع «مبنا») که این روش عضو آن‌هاست؛ برای کنترل دور */
  basisIds?: number[];
}

/** یک شاخه‌ی روش: شرطِ اختیاری + فرمول؛ شرط خالی فقط برای آخرین شاخه («در غیر این صورت») مجاز است */
export interface BranchInput {
  conditionText: string | null;
  formulaText: string;
}
interface ParsedBranch {
  cond: Cond | null;
  formula: Node;
  conditionText: string;
  formulaText: string;
}

/** تجزیه‌ی شاخه‌ها؛ خطاها با شماره‌ی شاخه می‌آیند (وقتی بیش از یکی است) */
function parseBranches(bs: BranchInput[]): ParsedBranch[] {
  if (bs.length === 0) throw new PayrollCalcError("فرمول الزامی است (آیکن فرمول را بزنید)");
  return bs.map((b, i) => {
    const tag = bs.length > 1 ? `شاخه‌ی ${i + 1}: ` : "";
    try {
      const hasCond = !!(b.conditionText && b.conditionText.trim());
      if (!hasCond && i < bs.length - 1) throw new FormulaError("شرط خالی (در غیر این صورت) فقط برای آخرین شاخه مجاز است؛ شاخه‌های بعدی هرگز اجرا نمی‌شوند");
      if (!(b.formulaText && b.formulaText.trim())) throw new FormulaError("فرمول تعریف نشده است");
      return {
        cond: hasCond ? parseCondition(b.conditionText!) : null,
        formula: parseFormula(b.formulaText),
        conditionText: hasCond ? b.conditionText!.trim() : "",
        formulaText: b.formulaText.trim(),
      };
    } catch (e: any) {
      throw new PayrollCalcError(tag + e.message);
    }
  });
}

function allRefs(ps: ParsedBranch[]): RefInfo[] {
  const out: RefInfo[] = [];
  for (const p of ps) {
    if (p.cond) collectCondRefs(p.cond, out);
    collectRefs(p.formula, out);
  }
  return out;
}

/** یال‌های وابستگی یک روش: عملوندهایی که مقدار «همین ماه»ِ گره‌ی دیگر را می‌خواهند */
function edgesOf(
  self: string,
  refs: RefInfo[],
  nodes: { node: string; kind: Kind; bases?: Set<number>; noSum?: boolean }[],
  basisByKey?: Map<string, { id: number; source: string | null }>
): string[] {
  const out = new Set<string>();
  for (const r of refs) {
    if (r.ns === "D" && r.variant === "VALUE") out.add(`D:${r.key}`);
    else if (r.ns === "C" && (r.variant === "VALUE" || r.variant === "YTD")) out.add(`C:${r.key}`);
    else if (r.ns === "S") nodes.filter((n) => n.kind === r.key && !n.noSum).forEach((n) => out.add(n.node));
    else if (r.ns === "P") {
      // مبنای «محاسبات»: مقدار از مبلغ همین ماهِ عضوها می‌آید ⇒ به همه‌ی اعضا وابسته است (اگر خودِ عامل عضو باشد، دور است)
      const b = basisByKey?.get(r.key);
      if (b && b.source === "CALC") nodes.filter((n) => n.bases?.has(b.id)).forEach((n) => out.add(n.node));
    }
  }
  return [...out];
}

/** اعتبارسنجی یک روش در کنار روش‌های فعلی بقیه‌ی عامل‌ها: دستور، وجود عملوندها، دور */
export async function validateFactorMethod(cand: CandidateMethod): Promise<void> {
  const needsFormula = cand.method === "CALCULATED" || cand.node.startsWith("D:");
  const parsed: ParsedBranch[] = needsFormula ? parseBranches(cand.branches) : [];
  const refs = allRefs(parsed);
  const [decree, comps, params, baseType] = await Promise.all([
    prisma.decreeComponent.findMany({ select: { code: true, title: true } }),
    prisma.payrollComponent.findMany({ select: { key: true, title: true, kind: true, calcTypeId: true, excludeFromSums: true } }),
    prisma.payrollParameter.findMany({ select: { id: true, key: true, kind: true, basisSource: true } }),
    prisma.payrollCalcType.findFirst({ where: { isBase: true }, select: { id: true } }),
  ]);
  const basisByKey = new Map(params.filter((p) => p.kind === "BASIS").map((p) => [p.key, { id: p.id, source: p.basisSource as string | null }]));
  const baseId = baseType?.id ?? 0;
  // نوع عاملِ در دست تعریف: عامل حکم همیشه حقوق ماهانه است
  const candType = cand.node.startsWith("D:") ? baseId : cand.calcTypeId ?? baseId;
  const typeByKey = new Map(comps.map((c) => [c.key, c.calcTypeId]));
  const dCodes = new Set(decree.map((d) => String(d.code)));
  const cKeys = new Set(comps.map((c) => c.key));
  const pKeys = new Set(params.map((p) => p.key));
  const titles = new Map<string, string>([...decree.map((d) => [`D:${d.code}`, d.title] as [string, string]), ...comps.map((x) => [`C:${x.key}`, x.title] as [string, string])]);
  for (const r of refs) {
    if (r.ns === "D" && !dCodes.has(r.key)) throw new PayrollCalcError("عامل حکم انتخاب‌شده در فرمول وجود ندارد");
    if (r.ns === "C" && !cKeys.has(r.key)) throw new PayrollCalcError("عامل حقوق انتخاب‌شده در فرمول وجود ندارد");
    // هر نوع فقط عامل‌های خودش و (برای انواع غیرپایه) عامل‌های حقوق ماهانه را می‌بیند
    if (r.ns === "C") {
      const t = typeByKey.get(r.key);
      if (t !== candType && !(candType !== baseId && t === baseId)) {
        throw new PayrollCalcError(`عامل «${comps.find((c) => c.key === r.key)?.title ?? r.key}» متعلق به نوع محاسبه‌ی دیگری است و در این فرمول قابل استفاده نیست`);
      }
    }
    if (r.ns === "P" && !pKeys.has(r.key)) throw new PayrollCalcError("پارامتر مبنا انتخاب‌شده در فرمول تعریف نشده است");
  }

  // گراف وابستگی با آخرین روش هر عامل + نامزد
  const latest = await prisma.payrollFactorMethod.findMany({ orderBy: { execCalendarMonth: { startDate: "desc" } }, include: { branches: { orderBy: { seq: "asc" } }, bases: { where: { effective: true }, select: { parameterId: true } }, decreeComponent: { select: { code: true } }, payrollComponent: { select: { key: true, calcTypeId: true } } } });
  // طبقه از خود عامل می‌آید (عامل حکم همیشه «پرداختی» است)
  const kindByNode = new Map<string, Kind>([...decree.map((d) => [`D:${d.code}`, "EARNING" as Kind] as [string, Kind]), ...comps.map((x) => [`C:${x.key}`, x.kind as Kind] as [string, Kind])]);
  const noSumKeys = new Set(comps.filter((x) => x.excludeFromSums).map((x) => `C:${x.key}`));
  const seen = new Set<string>();
  const nodes: { node: string; kind: Kind; method: Method; branches: BranchInput[]; bases: Set<number>; noSum: boolean }[] = [];
  for (const m of latest) {
    const node = m.decreeComponent ? `D:${m.decreeComponent.code}` : `C:${m.payrollComponent!.key}`;
    // دور فقط بین عامل‌های هم‌نوع معنا دارد (مقدار نوع پایه از فیش ماهانه‌ی آماده خوانده می‌شود)
    const t = m.decreeComponent ? baseId : m.payrollComponent!.calcTypeId;
    if (t !== candType) continue;
    if (seen.has(node) || node === cand.node) continue;
    seen.add(node);
    nodes.push({ node, kind: (kindByNode.get(node) ?? "INFO") as Kind, method: m.method as Method, branches: m.branches.map((b) => ({ conditionText: b.conditionText, formulaText: b.formulaText })), bases: new Set(m.bases.map((x) => x.parameterId)), noSum: noSumKeys.has(node) });
  }
  nodes.push({ node: cand.node, kind: cand.kind, method: cand.method, branches: cand.branches, bases: new Set(cand.basisIds ?? []), noSum: noSumKeys.has(cand.node) });
  const kindNodes = nodes.map((n) => ({ node: n.node, kind: n.kind, bases: n.bases, noSum: n.noSum }));
  const graph = new Map<string, string[]>();
  for (const n of nodes) {
    let es: string[] = [];
    if (n.method === "CALCULATED" || n.node.startsWith("D:")) {
      try {
        es = edgesOf(n.node, allRefs(parseBranches(n.branches)), kindNodes, basisByKey);
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
  methodId: number | null;
  title: string;
  formula: string | null;
  amount: number;
  error: string | null;
  trace: {
    expression: string;
    operands: Operand[];
    note?: string;
    method: string;
    valueType?: string;
    condition?: { text: string; expression: string; result: boolean };
    /** روش چند شاخه‌ای: شماره‌ی شاخه‌ی اجراشده (۰ = هیچ‌کدام)، تعداد شاخه‌ها و شرط‌های بررسی‌شده به ترتیب */
    branch?: { index: number; total: number; checked: { index: number; text: string; expression: string; result: boolean }[] };
  };
}

interface MethodRow {
  id: number;
  method: Method;
  valueType: string;
  branches: BranchInput[];
  isProvisional: boolean;
  /** شناسه‌ی مبناهایی که این روش عضو آن‌هاست */
  bases: number[];
}

interface FactorNode {
  node: string; // D:<code> | C:<key>
  source: "DECREE_COMPONENT" | "PAYROLL_COMPONENT";
  refId: number;
  title: string;
  kind: Kind;
  method: MethodRow | null;
  parsed: ParsedBranch[] | null;
  parseError: string | null;
  refs: RefInfo[];
  deps: string[];
  /** شناسه‌ی مبناهایی که روش مؤثر این عامل عضو آن‌هاست */
  bases: Set<number>;
  /** عامل با «در جمع طبقه‌ها نیاید» */
  noSum?: boolean;
  /** سازمان ذینفع مرتبط با عامل حقوق: کارمندِ غیرمشمول در آن سازمان ⇒ مبلغ صفر؛ مشمولیتِ تعیین‌نشده ⇒ خطا */
  orgId?: number | null;
  orgTitle?: string | null;
  decreeValue?: number; // مقدار حکم (برای D)
  decreeValueType?: string;
}

const rial = (v: number) => Math.round(v);

function prevMonth(y: number, m: number) {
  return m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
}

const COMPONENT_KINDS = ["WORK", "EARNING", "DEDUCTION", "EMPLOYER_COST", "INFO"];

/** ساخت «عامل حقوق» (فرم و ورود از اکسل هر دو از همین تابع): عنوان یکتا، طبقه‌ی معتبر، نوع محاسبه‌ی موجود؛ کلید داخلی را سیستم می‌سازد */
export async function createPayrollComponent(input: { title: string; kind: string; calcTypeId: number; description?: string | null; isActive?: boolean; excludeFromSums?: boolean; beneficiaryOrgId?: number | null }): Promise<{ id: number }> {
  const title = input.title.trim();
  if (!title) throw new PayrollCalcError("عنوان الزامی است");
  if (!COMPONENT_KINDS.includes(input.kind)) throw new PayrollCalcError("طبقه را انتخاب کنید");
  const calcType = input.calcTypeId ? await prisma.payrollCalcType.findUnique({ where: { id: input.calcTypeId } }) : null;
  if (!calcType) throw new PayrollCalcError("نوع محاسبه را انتخاب کنید");
  if (await prisma.payrollComponent.findFirst({ where: { title } })) throw new PayrollCalcError("عامل دیگری با همین عنوان وجود دارد");
  if (input.beneficiaryOrgId && !(await prisma.beneficiaryOrg.findUnique({ where: { id: input.beneficiaryOrgId } }))) throw new PayrollCalcError("سازمان ذینفع یافت نشد");
  const last = await prisma.payrollComponent.findFirst({ orderBy: { id: "desc" }, select: { id: true } });
  let n = (last?.id ?? 0) + 1;
  let key = `F${n}`;
  while (await prisma.payrollComponent.findUnique({ where: { key } })) key = `F${++n}`;
  const created = await prisma.payrollComponent.create({
    data: { key, title, kind: input.kind as any, calcTypeId: calcType.id, description: input.description?.trim() || null, isActive: input.isActive ?? true, excludeFromSums: !!input.excludeFromSums, beneficiaryOrgId: input.beneficiaryOrgId || null },
  });
  return { id: created.id };
}

export async function getBaseCalcType() {
  const t = await prisma.payrollCalcType.findFirst({ where: { isBase: true } });
  if (!t) throw new PayrollCalcError("نوع محاسبه‌ی پایه (حقوق ماهانه) تعریف نشده است");
  return t;
}

/** حذف فیش «حقوق ماهانه» وقتی فیش نوع دیگری برای همان کارمند و ماه هست ممنوع است؛ پیام برای اولین مورد، null = آزاد */
export async function dependentSlipMessage(baseSlips: { employeeId: number; year: number; month: number }[]): Promise<string | null> {
  if (baseSlips.length === 0) return null;
  const chain = await loanChainMessage(baseSlips);
  if (chain) return chain;
  const dep = await prisma.payrollSlip.findFirst({
    where: { calcType: { isBase: false }, OR: baseSlips.map((b) => ({ employeeId: b.employeeId, year: b.year, month: b.month })) },
    select: { calcType: { select: { title: true } }, employee: { select: { personnelCode: true } }, year: true, month: true },
  });
  if (!dep) return null;
  return `برای کارمند ${dep.employee.personnelCode} در ${dep.year}/${dep.month} محاسبه‌ی «${dep.calcType.title}» هم انجام شده است؛ ابتدا آن را حذف کنید`;
}

export async function calculatePayroll(employeeId: number, year: number, month: number, calcTypeId?: number): Promise<{ slipId: number }> {
  if (!Number.isInteger(year) || year < 1300 || year > 1600 || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new PayrollCalcError("سال یا ماه نامعتبر است");
  }
  const emp = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!emp) throw new PayrollCalcError("کارمند یافت نشد");
  // ماه باید در «تقویم کاری» تعریف شده باشد (روز/ساعت استاندارد و مجاز از همان می‌آید)
  const calMonth = await getCalendarMonth(year, month);
  if (!calMonth) throw new PayrollCalcError((await missingMonthMessage(year, month))!);
  const baseType = await getBaseCalcType();
  const calcType = calcTypeId ? await prisma.payrollCalcType.findUnique({ where: { id: calcTypeId } }) : baseType;
  if (!calcType) throw new PayrollCalcError("نوع محاسبه یافت نشد");
  if (!calcType.isActive) throw new PayrollCalcError(`نوع محاسبه‌ی «${calcType.title}» غیرفعال است`);
  const typeId = calcType.id;
  const isBase = calcType.isBase;
  if (await prisma.payrollSlip.findUnique({ where: { employeeId_year_month_calcTypeId: { employeeId, year, month, calcTypeId: typeId } }, select: { id: true } })) {
    throw new PayrollCalcError(`برای این کارمند در این ماه «${calcType.title}» محاسبه شده است؛ ابتدا محاسبه را حذف کنید`);
  }
  // کنترل: نوع غیرپایه فقط پس از محاسبه‌ی «حقوق ماهانه»ی همان ماه
  const baseSlip = isBase
    ? null
    : await prisma.payrollSlip.findUnique({
        where: { employeeId_year_month_calcTypeId: { employeeId, year, month, calcTypeId: baseType.id } },
        include: { lines: { select: { source: true, refId: true, amount: true, error: true, methodId: true, title: true } } },
      });
  if (!isBase && !baseSlip) throw new PayrollCalcError(`ابتدا «${baseType.title}» این کارمند برای همین ماه را محاسبه کنید`);
  const baseLines = new Map((baseSlip?.lines ?? []).map((l) => [`${l.source}:${l.refId}`, l]));
  const range = jalaliMonthRange(year, month);
  const yearDays = jalaliMonthRange(year, 12).days === 30 ? 366 : 365;
  const warnings: string[] = [];

  // ── حکم مؤثر (نوع غیرپایه: همان حکمِ فیش حقوق ماهانه) ──
  let decreeId: number;
  if (baseSlip?.decreeId) {
    decreeId = baseSlip.decreeId;
  } else {
    const eff = await getEffectiveDecree(employeeId, range.end);
    if (!eff.decree || eff.validity !== "VALID") {
      throw new PayrollCalcError(eff.validity === "EXPIRED" ? "حکم این کارمند در این ماه منقضی شده است" : "برای این کارمند در این ماه حکم تاییدشده‌ی معتبر وجود ندارد");
    }
    decreeId = eff.decree.id;
  }
  const decree = await prisma.employmentDecree.findUnique({
    where: { id: decreeId },
    include: { lines: { include: { component: true }, orderBy: { id: "asc" } } },
  });
  if (!decree) throw new PayrollCalcError("حکم یافت نشد");
  if (baseSlip?.hasErrors) warnings.push("فیش حقوق ماهانه‌ی این ماه خطا دارد؛ مقدار عامل‌های آن ممکن است ناقص باشد");
  const changed = isBase
    ? await prisma.employmentDecree.findFirst({
        where: { employeeId, status: "APPROVED", effectiveDate: { gt: range.start, lte: range.end }, NOT: { id: decree.id } },
        select: { number: true },
      })
    : null;
  if (isBase && (changed || decree.effectiveDate > range.start)) {
    warnings.push("حکم کارمند در طول همین ماه تغییر کرده یا شروع شده است؛ در این نسخه کل ماه با آخرین حکم ماه محاسبه می‌شود (تفکیک روزانه انجام نمی‌شود)");
  }

  // ── روش‌های مؤثر ──
  const methods = await prisma.payrollFactorMethod.findMany({ where: { execCalendarMonth: { startDate: { lte: range.end } } }, orderBy: { execCalendarMonth: { startDate: "desc" } }, include: { branches: { orderBy: { seq: "asc" } }, bases: { where: { effective: true }, select: { parameterId: true } } } });
  const toRow = (m: (typeof methods)[number]): MethodRow => ({
    id: m.id,
    method: m.method as Method,
    valueType: m.valueType,
    branches: m.branches.map((b) => ({ conditionText: b.conditionText, formulaText: b.formulaText })),
    isProvisional: m.isProvisional,
    bases: m.bases.map((x) => x.parameterId),
  });
  const decreeMethod = (id: number) => {
    const m = methods.find((x) => x.decreeComponentId === id);
    return m ? toRow(m) : null;
  };
  const payrollMethod = (id: number) => {
    const m = methods.find((x) => x.payrollComponentId === id);
    return m ? toRow(m) : null;
  };

  const allComps = await prisma.payrollComponent.findMany({ where: { isActive: true }, orderBy: { id: "asc" }, include: { beneficiaryOrg: { select: { title: true } } } });
  const payrollComps = allComps.filter((c) => c.calcTypeId === typeId);
  const allDecreeComps = await prisma.decreeComponent.findMany();
  const decreeByCode = new Map(allDecreeComps.map((d) => [String(d.code), d]));
  const compByKey = new Map(allComps.map((c) => [c.key, c]));
  const decreeLineValue = new Map(decree.lines.map((l) => [String(l.component.code), Number(l.value)]));

  // ── ورودی‌های ماه (ثبت‌شده در «ورود اطلاعات») ──
  const inputRows = await prisma.payrollFactorInput.findMany({ where: { employeeId, year, month } });
  const inputByComp = new Map(inputRows.map((r) => [r.componentId, Number(r.value)]));

  // ── گره‌ها ──
  const nodes: FactorNode[] = [];
  const mk = (n: Omit<FactorNode, "parsed" | "parseError" | "refs" | "deps" | "bases">): FactorNode => {
    let parsed: FactorNode["parsed"] = null;
    let parseError: string | null = null;
    if (n.method && (n.method.method === "CALCULATED" || n.source === "DECREE_COMPONENT")) {
      try {
        parsed = parseBranches(n.method.branches);
      } catch (e: any) {
        parseError = e.message;
      }
    }
    return { ...n, parsed, parseError, refs: parsed ? allRefs(parsed) : [], deps: [], bases: new Set(n.method?.bases ?? []) };
  };
  // روش عامل‌های حکم فقط در حقوق ماهانه محاسبه می‌شود؛ انواع دیگر مقدار آن‌ها را با [D:کد:…] می‌خوانند
  for (const l of isBase ? decree.lines : []) {
    nodes.push(
      mk({
        node: `D:${l.component.code}`,
        source: "DECREE_COMPONENT",
        refId: l.component.id,
        title: l.component.title,
        kind: "EARNING",
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
    nodes.push(mk({ node: `C:${c.key}`, source: "PAYROLL_COMPONENT", refId: c.id, title: c.title, kind: c.kind as Kind, method: m, noSum: c.excludeFromSums, orgId: c.beneficiaryOrgId, orgTitle: c.beneficiaryOrg?.title ?? null }));
  }
  const paramDefs = new Map((await prisma.payrollParameter.findMany()).map((p) => [p.key, p]));
  const basisByKey = new Map([...paramDefs.values()].filter((p) => p.kind === "BASIS").map((p) => [p.key, { id: p.id, source: p.basisSource as string | null }]));
  const kindNodes = nodes.map((n) => ({ node: n.node, kind: n.kind, bases: n.bases, noSum: n.noSum }));
  // اقساط وام: حقوق ماهانه از وضعیت وام‌ها محاسبه می‌کند و مانده را ثبت می‌کند؛ نوع‌های دیگر مقدار ثبت‌شده‌ی همان فیش ماهانه را می‌خوانند
  const loanItems: LoanMonthItem[] = isBase ? await computeLoanMonth(employeeId, year, month) : [];
  const loanSum = isBase ? loanItems.reduce((a, x) => a + x.installment, 0) : baseSlip ? await storedLoanSum(baseSlip.id) : 0;
  for (const n of nodes) n.deps = edgesOf(n.node, n.refs, kindNodes, basisByKey);

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
  const usedParams = new Map<string, ParameterValue>();
  // مقدار ثابت پرسنلی: مقدار مؤثر همین کارمند در پایان ماه؛ ثبت‌نشده = صفر
  const empParams = await loadEmployeeParamValues(employeeId, range.end);
  const usedPersonnel = new Map<string, { value: number; effectiveDate: Date | null; source: string; type: string }>();

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
  const periods = await getPeriods(employeeId);
  const cur = periods.find((p) => p.startDate <= range.end && (!p.endDate || p.endDate >= range.end)) ?? periods[periods.length - 1];
  const serviceDays = cur ? Math.max(0, Math.floor((range.end.getTime() - cur.startDate.getTime()) / 86400000) + 1) : 0;
  const base: Record<string, number> = {
    MONTH_DAYS: range.days,
    YEAR_DAYS: yearDays,
    SERVICE_DAYS: serviceDays,
    SERVICE_YEARS: Math.round((serviceDays / 365) * 100) / 100,
    MONTH_NO: month,
    STANDARD_DAYS: calMonth.standardDays,
    ALLOWED_DAYS: calMonth.allowedDays,
    STANDARD_HOURS: calMonth.standardMinutes / 60,
    ALLOWED_HOURS: calMonth.allowedMinutes / 60,
  };

  // ── محیط ارزیابی ──
  const amounts = new Map<string, number>(); // گره → مبلغ این ماه
  const errored = new Map<string, string>();
  const lines: LineOut[] = [];

  // مبناها (پارامتر نوع «مبنا»): جمع مبلغ عضوها. منبع «حکم» = مقدار خام عامل‌های حکمِ عضو؛ منبع «محاسبات» = مبلغ همین ماهِ عضوها (نوع غیرپایه: اعضای فیش ماهانه هم می‌آیند)
  const baseLineBases = new Map<number, Set<number>>();
  if (!isBase && baseSlip) {
    const ids = [...new Set(baseSlip.lines.map((l) => l.methodId).filter((x): x is number => x !== null))];
    const mem = ids.length ? await prisma.payrollFactorMethodBasis.findMany({ where: { methodId: { in: ids }, effective: true }, select: { methodId: true, parameterId: true } }) : [];
    for (const x of mem) baseLineBases.set(x.methodId, (baseLineBases.get(x.methodId) ?? new Set<number>()).add(x.parameterId));
  }
  const basisInfo = new Map<string, { title: string; source: string; decreeMode: string | null; value: number; members: { label: string; value: number }[] }>();
  const basisValue = (def: (typeof paramDefs extends Map<string, infer V> ? V : never)): number => {
    const got = basisInfo.get(def.key);
    if (got) return got.value;
    const members: { label: string; value: number }[] = [];
    if (def.basisSource === "DECREE") {
      if (def.decreeValueMode === "AVG") {
        // میانگین حکم: برای هر عامل حکمِ عضو، میانگین وزنی بر روزِ مقدارهای حکم (همان «میانگین حکم» فرمول‌ها)، حتی اگر در آخرین حکم نباشد
        for (const c of allDecreeComps) {
          if (decreeMethod(c.id)?.bases.includes(def.id)) members.push({ label: `${c.title} (میانگین)`, value: averageOf(String(c.code)) });
        }
      } else {
        for (const l of decree.lines) {
          const m = decreeMethod(l.component.id);
          if (m?.bases.includes(def.id)) members.push({ label: l.component.title, value: Number(l.value) });
        }
      }
    } else {
      for (const n of nodes) {
        if (!n.bases.has(def.id)) continue;
        if (errored.has(n.node)) throw new FormulaError(`«${n.title}» خطا دارد و در مبنای «${def.title}» نمی‌آید`);
        const v = amounts.get(n.node);
        if (v === undefined) throw new FormulaError(`«${n.title}» هنوز محاسبه نشده است (عضو مبنای «${def.title}»)`);
        members.push({ label: n.title, value: v });
      }
      if (!isBase) {
        for (const l of baseSlip?.lines ?? []) {
          if (l.methodId === null || !baseLineBases.get(l.methodId)?.has(def.id)) continue;
          if (l.error) throw new FormulaError(`«${l.title}» در حقوق ماهانه خطا دارد و در مبنای «${def.title}» نمی‌آید`);
          members.push({ label: `${l.title} (${baseType.title})`, value: Number(l.amount) });
        }
      }
    }
    const value = members.reduce((a, x) => a + x.value, 0);
    if (members.length === 0) warnings.push(`مبنای «${def.title}» در این ماه هیچ عضوی ندارد؛ مقدار آن صفر است`);
    basisInfo.set(def.key, { title: def.title, source: def.basisSource ?? "CALC", decreeMode: def.basisSource === "DECREE" ? def.decreeValueMode ?? "LAST" : null, value, members });
    return value;
  };

  const titleOf = (ns: string, key: string): string => {
    if (ns === "D") return decreeByCode.get(key)?.title ?? `عامل حکم ${key}`;
    if (ns === "C") return compByKey.get(key)?.title ?? key;
    if (ns === "P") return paramDefs.get(key)?.title ?? key;
    if (ns === "B") return BASE_INFO[key] ?? key;
    return key === LOAN_SUM_KEY ? LOAN_SUM_LABEL : `جمع ${KIND_FA[key] ?? key}`;
  };
  const env: EvalEnv = {
    label(ns, key, variant) {
      const t = titleOf(ns, key);
      if (ns === "D") return `${t} — ${DECREE_VARIANTS[variant] ?? variant}`;
      if (ns === "C" && variant && variant !== "VALUE") return `${t} — ${FACTOR_VARIANTS[variant] ?? variant}`;
      return t;
    },
    parts(ns, key) {
      return ns === "P" ? basisInfo.get(key)?.members : undefined;
    },
    scalar(ns, key, variant) {
      if (ns === "P" && paramDefs.get(key)?.kind === "BASIS") return basisValue(paramDefs.get(key)!);
      if (ns === "B") {
        if (!(key in base)) throw new FormulaError(`اطلاعات پایه‌ی ${key} موجود نیست`);
        return base[key];
      }
      if (ns === "P" && isPersonnelKind(paramDefs.get(key)?.kind)) {
        const def = paramDefs.get(key)!;
        const ev = empParams.get(def.id);
        usedPersonnel.set(key, { value: ev?.value ?? 0, effectiveDate: ev?.effectiveDate ?? null, source: def.kind, type: def.type });
        return ev?.value ?? 0;
      }
      if (ns === "P") {
        const pv = params.get(key);
        const def = paramDefs.get(key);
        if (!def) throw new FormulaError(`پارامتر ${key} تعریف نشده است`);
        if (!pv || pv.value === null) throw new FormulaError(`پارامتر مبنا «${def.title}» برای این ماه مقدار ندارد (در «پارامترهای مبنا» تعریف کنید)`);
        usedParams.set(key, pv);
        return pv.value;
      }
      if (ns === "S" && key === LOAN_SUM_KEY) return loanSum;
      if (ns === "S") {
        let sum = 0;
        for (const n of nodes) {
          if (n.kind !== key || n.noSum) continue;
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
      if (ns === "D" && variant === "LAST") return decreeLineValue.get(key) ?? 0;
      if (ns === "D" && variant === "AVG") return averageOf(key);
      if (variant === "PREV" || variant === "YTD_PREV" || variant === "ALL_PREV") return history(source, comp.id, variant);
      const compType = (comp as { calcTypeId?: number }).calcTypeId;
      // نوع غیرپایه: مقدار همین ماهِ عامل‌های حقوق ماهانه از روی فیش ماهانه (نه از محاسبه‌ی همین اجرا)
      if (!isBase && (ns === "D" || (ns === "C" && compType !== typeId))) {
        if (ns === "C" && compType !== baseType.id) throw new FormulaError(`عامل «${comp.title}» متعلق به نوع محاسبه‌ی دیگری است`);
        const bl = baseLines.get(`${source}:${comp.id}`);
        if (!bl) {
          if (ns === "D") return 0; // عامل در حکم نیامده
          throw new FormulaError(`عامل «${comp.title}» در فیش حقوق ماهانه‌ی این ماه نیست`);
        }
        if (bl.error) throw new FormulaError(`«${comp.title}» در حقوق ماهانه خطا دارد`);
        const bv = Number(bl.amount);
        return variant === "YTD" ? bv + history(source, comp.id, "YTD_PREV") : bv;
      }
      if (isBase && ns === "C" && compType !== typeId) throw new FormulaError(`عامل «${comp.title}» متعلق به نوع محاسبه‌ی دیگری است`);
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
  // مشمولیت کارمند در سازمان‌های ذینفع (برای عامل‌های دارای سازمان)
  const benefByOrg = new Map((await prisma.employeeBeneficiary.findMany({ where: { employeeId }, select: { organizationId: true, isIncluded: true } })).map((b) => [b.organizationId, b.isIncluded]));
  for (const n of order) {
    const m = n.method;
    let amount = 0;
    let error: string | null = null;
    let matchedFormula: string | null = null;
    let trace: LineOut["trace"] = { expression: "", operands: [], method: "" };
    try {
      if (cycleErr.has(n.node)) throw new FormulaError("ارجاع دوری بین عوامل");
      if (!m) throw new FormulaError(n.source === "DECREE_COMPONENT" ? "روش محاسبه‌ی این عامل حکم تعریف نشده است" : "روش محاسبه تعریف نشده است");
      if (m.isProvisional) provisionalNotes.add(n.title);
      const compId = n.refId;
      const orgIncluded = n.source === "PAYROLL_COMPONENT" && n.orgId ? benefByOrg.get(n.orgId) : true;
      if (n.source === "PAYROLL_COMPONENT" && n.orgId && orgIncluded === undefined) throw new FormulaError(`مشمولیت کارمند در سازمان «${n.orgTitle ?? ""}» تعیین نشده است؛ در فرم کارمند مشمول یا غیرمشمول را انتخاب کنید`);
      if (orgIncluded === false) {
        amount = 0;
        trace = { expression: "0", operands: [], method: METHOD_FA[m.method], note: `کارمند در سازمان «${n.orgTitle ?? ""}» غیرمشمول است؛ مبلغ صفر در نظر گرفته شد` };
      } else if (n.source === "PAYROLL_COMPONENT" && INPUT_METHODS.includes(m.method)) {
        const stored = inputByComp.get(compId);
        // ورود دستی و ورود از تردد: مقدار ثبت‌نشده = صفر (ISNULL(x, 0)). ورود از خزانه: نبودن مقدار یعنی خوراک سیستم نرسیده؛ خطای روشن می‌دهد
        if (stored === undefined && m.method === "TREASURY") throw new FormulaError(`مقدار ورودی (${METHOD_FA[m.method]}) برای این ماه ثبت نشده است`);
        const v = stored ?? 0;
        amount = v;
        trace = { expression: String(v), operands: [], method: METHOD_FA[m.method], note: stored === undefined ? (m.method === "ATTENDANCE" ? "مقداری از «محاسبه تردد» به حقوق ارسال نشده بود؛ صفر در نظر گرفته شد" : "مقداری در «ورود اطلاعات» ثبت نشده بود؛ صفر در نظر گرفته شد") : undefined };
      } else {
        if (n.parseError) throw new FormulaError(n.parseError);
        const branches = n.parsed!;
        // از بالا به پایین: اولین شاخه‌ای که شرطش برقرار است (یا بدون شرط است) اجرا می‌شود؛ هیچ‌کدام برقرار نباشد ⇒ صفر
        const condOperands: Operand[] = [];
        const checked: { index: number; text: string; expression: string; result: boolean }[] = [];
        let matched = -1;
        let condInfo: LineOut["trace"]["condition"];
        for (let i = 0; i < branches.length; i++) {
          const b = branches[i];
          if (b.cond) {
            const c = evaluateCondition(b.cond, env);
            for (const o of c.operands) if (!condOperands.some((x) => x.ref === o.ref)) condOperands.push(o);
            checked.push({ index: i + 1, text: b.conditionText, expression: c.expression, result: c.value });
            if (!c.value) continue;
            condInfo = { text: b.conditionText, expression: c.expression, result: true };
          }
          matched = i;
          break;
        }
        const branchInfo = { index: matched + 1, total: branches.length, checked };
        if (matched < 0) {
          amount = 0;
          const last = checked[checked.length - 1];
          trace = {
            expression: branches.length > 1 ? "هیچ‌یک از شرط‌ها برقرار نبود" : "شرط برقرار نبود",
            operands: condOperands,
            method: METHOD_FA[n.source === "DECREE_COMPONENT" ? "CALCULATED" : m.method],
            condition: last ? { text: last.text, expression: last.expression, result: false } : undefined,
            branch: branchInfo,
          };
        } else {
          matchedFormula = branches[matched].formulaText;
          const r = evaluate(branches[matched].formula, env);
          amount = r.value;
          trace = {
            expression: r.expression,
            operands: [...condOperands, ...r.operands.filter((o) => !condOperands.some((c) => c.ref === o.ref))],
            method: METHOD_FA.CALCULATED,
            condition: condInfo,
            branch: branchInfo,
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
      kind: n.kind,
      source: n.source,
      refId: n.refId,
      methodId: m?.id ?? null,
      title: n.title,
      formula: matchedFormula,
      amount: error ? 0 : amount,
      error,
      trace,
    });
  }
  if (isBase && loanItems.some((x) => x.installment > 0) && !nodes.some((n) => n.refs.some((r) => r.ns === "S" && r.key === LOAN_SUM_KEY))) {
    warnings.push("کارمند قسط وام دارد و مانده‌ی وام کم شد، ولی هیچ عاملی از «جمع اقساط وام» در فرمولش استفاده نمی‌کند؛ قسط در فیش کسر نشد");
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
      value: pv.value,
      brackets: pv.brackets,
    };
  }

  for (const [k, u] of usedPersonnel) {
    paramsOut[k] = {
      title: paramDefs.get(k)?.title ?? k,
      type: u.type,
      personnel: u.source === "PERSONNEL_HR" ? "HR" : "PAYROLL",
      effectiveDate: u.effectiveDate ? u.effectiveDate.toISOString().slice(0, 10) : null,
      value: u.value,
      brackets: [],
    };
  }
  for (const [k, b] of basisInfo) paramsOut[k] = { title: b.title, type: "BASIS", source: b.source, decreeMode: b.decreeMode, value: b.value, members: b.members };

  // ترتیب نمایش: طبقه‌ها (پرداختی، کسر، هزینه کارفرما، اطلاعاتی) و داخل هر طبقه به ترتیب محاسبه
  const kindOrder: Kind[] = ["WORK", "EARNING", "DEDUCTION", "EMPLOYER_COST", "INFO"];
  const sorted = [...lines].sort((a, b) => kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind));

  const slip = await prisma.$transaction(async (tx) => {
    // محاسبه‌ی مجدد روی ردیف محاسبه‌شده ممنوع است؛ کاربر باید ابتدا «حذف محاسبه» کند
    if (await tx.payrollSlip.findUnique({ where: { employeeId_year_month_calcTypeId: { employeeId, year, month, calcTypeId: typeId } }, select: { id: true } })) {
      throw new PayrollCalcError(`برای این کارمند در این ماه «${calcType.title}» محاسبه شده است؛ ابتدا محاسبه را حذف کنید`);
    }
    // کنترل دوباره داخل تراکنش: فیش ماهانه در فاصله‌ی محاسبه حذف نشده باشد
    if (!isBase && !(await tx.payrollSlip.findUnique({ where: { employeeId_year_month_calcTypeId: { employeeId, year, month, calcTypeId: baseType.id } }, select: { id: true } }))) {
      throw new PayrollCalcError(`ابتدا «${baseType.title}» این کارمند برای همین ماه را محاسبه کنید`);
    }
    const created = await tx.payrollSlip.create({
      data: {
        employeeId,
        year,
        month,
        calcTypeId: typeId,
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
            methodId: l.methodId,
            title: l.title,
            formula: l.formula,
            amount: l.amount,
            error: l.error,
            trace: l.trace as any,
          })),
        },
      },
    });
    // مانده‌ی ماهانه‌ی وام‌ها (با حذف فیش خودکار پاک می‌شود)
    if (loanItems.length > 0) {
      await tx.loanMonthlyBalance.createMany({
        data: loanItems.map((x) => ({ loanId: x.loanId, slipId: created.id, year, month, installment: x.installment, balanceBefore: x.balanceBefore, balanceAfter: x.balanceAfter })),
      });
    }
    return created;
  });
  return { slipId: slip.id };
}

/**
 * پیام قفل «روش محاسبه عامل»: اگر هر ردیفِ فیشی با این روش محاسبه شده باشد (یا ردیف قدیمیِ بدون methodId برای همان عامل)، تا حذف آن فیش‌ها
 * روش قابل ویرایش/حذف/تایید نیست. null = قفل نیست.
 */
export async function methodLockMessage(method: { id: number; decreeComponentId: number | null; payrollComponentId: number | null }): Promise<string | null> {
  const factor = method.decreeComponentId
    ? { source: "DECREE_COMPONENT" as const, refId: method.decreeComponentId }
    : { source: "PAYROLL_COMPONENT" as const, refId: method.payrollComponentId! };
  const line = await prisma.payrollSlipLine.findFirst({
    where: { OR: [{ methodId: method.id }, { methodId: null, source: factor.source, refId: factor.refId }] },
    select: { slip: { select: { year: true, month: true } } },
    orderBy: { id: "asc" },
  });
  if (!line) return null;
  return `این روش در محاسبه‌ی حقوق ${line.slip.year}/${line.slip.month} استفاده شده و قفل است؛ ابتدا محاسبه‌های مربوط را حذف کنید`;
}

/** مجموعه‌ی شناسه‌ی روش‌های قفل‌شده (برای فهرست) */
export async function lockedMethodIds(): Promise<Set<number>> {
  const lines = await prisma.payrollSlipLine.findMany({ distinct: ["methodId", "source", "refId"], select: { methodId: true, source: true, refId: true } });
  const ids = new Set<number>();
  const legacy: { source: string; refId: number | null }[] = [];
  for (const l of lines) {
    if (l.methodId !== null) ids.add(l.methodId);
    else legacy.push({ source: l.source, refId: l.refId });
  }
  if (legacy.length) {
    const methods = await prisma.payrollFactorMethod.findMany({ select: { id: true, decreeComponentId: true, payrollComponentId: true } });
    for (const m of methods) {
      if (legacy.some((l) => (l.source === "DECREE_COMPONENT" ? l.refId === m.decreeComponentId : l.refId === m.payrollComponentId))) ids.add(m.id);
    }
  }
  return ids;
}
