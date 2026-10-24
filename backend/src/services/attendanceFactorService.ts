import { prisma } from "../lib/prisma";
import { AttendanceError, dayStr } from "./attendancePunchService";
import { buildWorksheet } from "./attendanceWorksheetService";
import { getCalendarMonth } from "./workCalendarService";
import { getParameterValue } from "./payrollParameterService";
import { evaluate, evaluateCondition, parseCondition, parseFormula, collectRefs, collectCondRefs, FormulaError, type Cond, type EvalEnv, type Node, type Ns, type RefInfo } from "./payrollFormula";
import { AGG_VARIANTS, ALLOWED_NS, ATT_BASE_INFO, ATT_LEVEL_FA, ATT_VALUE_TYPE_FA, DAY_VARS, type AttLevel, type AttValueType } from "./attendanceFormulaDefs";

// مدیریت تردد › عوامل و فرمول. تنها محل قواعد: تعریف عامل (روزانه/ماهانه)، روش‌های تاریخ‌دار (ماه اجرا از «تقویم کاری») با شاخه‌های شرط ← فرمول، اعتبارسنجی (نام‌فضاهای مجاز هر سطح،
// وجود عامل‌های ارجاع‌شده، ارجاع دوری) و محاسبه‌ی نتایج یک ماه تقویم کاری. نتایج ذخیره نمی‌شوند (مشتق از کارکرد روزانه‌اند؛ ذخیره با «بستن ماه تردد» می‌آید).
// عامل روزانه: برای هر روزِ هر کارمند از متغیرهای [V:…] همان روز، عوامل روزانه‌ی دیگر [F:…]، پارامترها و اطلاعات پایه.
// عامل ماهانه: از تجمیع عوامل روزانه [A:…:SUM|MAX|DAYS]، تجمیع متغیرهای روز [T:…:SUM|MAX|DAYS] و عوامل ماهانه‌ی دیگر [M:…].
// همه‌ی زمان‌ها دقیقه‌اند. روزی که بازه‌ی ناقص (تعداد فردِ تردد) دارد محاسبه می‌شود ولی «ناقص» علامت می‌خورد و از متغیرهایش فقط بازه‌های کامل می‌آید.

const DAY_MS = 86400000;

export const levelOf = (v: unknown): AttLevel => {
  if (v !== "DAY" && v !== "MONTH") throw new AttendanceError("سطح عامل را انتخاب کنید (روزانه یا ماهانه)");
  return v;
};
const valueTypeOf = (v: unknown): AttValueType => {
  if (v === undefined || v === null || v === "") return "TIME";
  if (v !== "NUMBER" && v !== "TIME" && v !== "DAYS") throw new AttendanceError("نوع مقدار نامعتبر است");
  return v;
};

export interface BranchInput {
  conditionText: string;
  formulaText: string;
}

// ───────────────────────── تعریف عامل ─────────────────────────

export function factorShape(f: any) {
  return {
    id: f.id,
    title: f.title,
    level: f.level as AttLevel,
    levelTitle: ATT_LEVEL_FA[f.level as AttLevel],
    valueType: f.valueType as AttValueType,
    valueTypeTitle: ATT_VALUE_TYPE_FA[f.valueType as AttValueType],
    isActive: f.isActive,
    description: f.description ?? "",
    methodCount: f._count?.methods,
    updatedAt: f.updatedAt,
  };
}

/** عامل‌هایی که متنِ یکی از شاخه‌های روش‌هایشان به این عامل ارجاع می‌دهد */
export async function factorsReferencing(key: string): Promise<string[]> {
  const re = new RegExp(`\\[(F|A|M):${key}(:[A-Za-z_]+)?\\]`, "i");
  const rows = await prisma.attendanceFactor.findMany({ include: { methods: { include: { branches: true } } } });
  return rows.filter((f) => f.key !== key && f.methods.some((m) => m.branches.some((b) => re.test(b.formulaText) || re.test(b.conditionText ?? "")))).map((f) => f.title);
}

export async function saveFactor(body: any, id?: number) {
  const title = String(body?.title ?? "").trim().replace(/\s+/g, " ");
  if (!title) throw new AttendanceError("عنوان عامل الزامی است");
  const valueType = valueTypeOf(body?.valueType);
  const data = { title, valueType, isActive: body?.isActive !== false, description: String(body?.description ?? "").trim() || null };
  if (!id) {
    const level = levelOf(body?.level);
    return prisma.$transaction(async (tx) => {
      const f = await tx.attendanceFactor.create({ data: { ...data, level, key: `TMP${Date.now()}${Math.floor(Math.random() * 1000)}` } });
      return tx.attendanceFactor.update({ where: { id: f.id }, data: { key: `AF${f.id}` } });
    });
  }
  const ex = await prisma.attendanceFactor.findUnique({ where: { id }, include: { _count: { select: { methods: true } } } });
  if (!ex) throw new AttendanceError("عامل یافت نشد");
  const level = body?.level ? levelOf(body.level) : ex.level;
  if (level !== ex.level) {
    if (ex._count.methods > 0) throw new AttendanceError("سطح عاملی که روش محاسبه دارد قابل تغییر نیست؛ ابتدا روش‌هایش را حذف کنید");
    const by = await factorsReferencing(ex.key);
    if (by.length) throw new AttendanceError(`سطح عاملی که در فرمول عامل دیگر استفاده شده قابل تغییر نیست (${by.slice(0, 5).join("، ")})`);
  }
  if (data.valueType !== ex.valueType && ex._count.methods > 0) {
    const by = await factorsReferencing(ex.key);
    if (by.length) throw new AttendanceError(`نوع مقدارِ عاملی که در فرمول عامل دیگر استفاده شده قابل تغییر نیست (${by.slice(0, 5).join("، ")})`);
  }
  return prisma.attendanceFactor.update({ where: { id }, data: { ...data, level } });
}

export async function deleteFactor(id: number) {
  const f = await prisma.attendanceFactor.findUnique({ where: { id } });
  if (!f) throw new AttendanceError("عامل یافت نشد");
  const by = await factorsReferencing(f.key);
  if (by.length) throw new AttendanceError(`این عامل در فرمول عامل‌های دیگر استفاده شده است و حذف نمی‌شود: ${by.slice(0, 5).join("، ")}${by.length > 5 ? " …" : ""}`);
  await prisma.attendanceFactor.delete({ where: { id } });
}

// ───────────────────────── اعتبارسنجی فرمول ─────────────────────────

export function cleanBranches(raw: unknown): BranchInput[] {
  if (!Array.isArray(raw)) throw new AttendanceError("شاخه‌های روش نامعتبر است");
  const out: BranchInput[] = [];
  for (const b of raw) {
    const conditionText = String(b?.conditionText ?? "").trim();
    const formulaText = String(b?.formulaText ?? "").trim();
    if (!conditionText && !formulaText) continue;
    out.push({ conditionText, formulaText });
  }
  if (out.length === 0) throw new AttendanceError("حداقل یک فرمول لازم است");
  return out;
}

interface Parsed {
  cond: Cond | null;
  formula: Node;
  refs: RefInfo[];
}
function parseBranch(b: BranchInput, i: number, multi: boolean): Parsed {
  const tag = multi ? `شاخه‌ی ${i + 1}: ` : "";
  try {
    if (!b.formulaText) throw new FormulaError("فرمول خالی است");
    const cond = b.conditionText ? parseCondition(b.conditionText, "ATTENDANCE") : null;
    const formula = parseFormula(b.formulaText, "ATTENDANCE");
    return { cond, formula, refs: [...(cond ? collectCondRefs(cond) : []), ...collectRefs(formula)] };
  } catch (e: any) {
    throw new AttendanceError(tag + (e instanceof FormulaError ? e.message : e?.message || "فرمول نامعتبر است"));
  }
}

/** وابستگی‌های «همین ماه/روز» بین عامل‌ها: روزانه‌ها با [F]، ماهانه‌ها با [M] (ارجاع [A] به عامل روزانه است و حلقه نمی‌سازد) */
function sameLevelDeps(refs: RefInfo[], level: AttLevel): string[] {
  return refs.filter((r) => r.ns === (level === "DAY" ? "F" : "M")).map((r) => r.key);
}

/** حلقه‌یابی روی گراف عامل‌ها (همه‌ی روش‌های ذخیره‌شده + شاخه‌های در دست ذخیره). برمی‌گرداند مسیر حلقه (کلیدها) یا null */
function findCycle(graph: Map<string, Set<string>>, start: string): string[] | null {
  const path: string[] = [];
  const onPath = new Set<string>();
  const done = new Set<string>();
  const dfs = (n: string): string[] | null => {
    if (onPath.has(n)) return [...path.slice(path.indexOf(n)), n];
    if (done.has(n)) return null;
    onPath.add(n);
    path.push(n);
    for (const m of graph.get(n) ?? []) {
      const c = dfs(m);
      if (c) return c;
    }
    path.pop();
    onPath.delete(n);
    done.add(n);
    return null;
  };
  return dfs(start);
}

/** بررسی کامل شاخه‌های روشِ یک عامل (ساختار، نام‌فضای مجاز سطح، وجود عامل‌های ارجاع‌شده، حلقه) */
export async function validateBranches(factor: { id: number | null; key: string; level: AttLevel }, branches: BranchInput[]) {
  const multi = branches.length > 1;
  branches.forEach((b, i) => {
    if (!b.conditionText && i !== branches.length - 1) throw new AttendanceError(`شاخه‌ی ${i + 1}: شاخه‌ی بدون شرط فقط می‌تواند آخرین شاخه باشد`);
  });
  const parsed = branches.map((b, i) => parseBranch(b, i, multi));
  const all = await prisma.attendanceFactor.findMany({ include: { methods: { include: { branches: true } } } });
  const byKey = new Map(all.map((f) => [f.key, f]));
  const myRefs: RefInfo[] = [];
  parsed.forEach((p, i) => {
    const tag = multi ? `شاخه‌ی ${i + 1}: ` : "";
    for (const r of p.refs) {
      if (!ALLOWED_NS[factor.level].includes(r.ns)) {
        throw new AttendanceError(`${tag}در عامل ${ATT_LEVEL_FA[factor.level]} استفاده از «${nsTitle(r.ns)}» مجاز نیست`);
      }
      if (r.ns === "F" || r.ns === "A" || r.ns === "M") {
        const t = byKey.get(r.key);
        if (!t) throw new AttendanceError(`${tag}عامل ارجاع‌شده یافت نشد`);
        if (r.key === factor.key) throw new AttendanceError(`${tag}یک عامل نمی‌تواند به خودش ارجاع بدهد`);
        const want: AttLevel = r.ns === "M" ? "MONTH" : "DAY";
        if (t.level !== want) throw new AttendanceError(`${tag}عامل «${t.title}» ${ATT_LEVEL_FA[t.level as AttLevel]} است و در این جای فرمول مجاز نیست`);
        if (!t.isActive) throw new AttendanceError(`${tag}عامل «${t.title}» غیرفعال است`);
      }
      if (r.ns === "P") {
        // پارامتر مبنا: مقدار ثابتِ عددی/مبلغی (نه جدول پلکانی/مبنا/پرسنلی)
      }
    }
    myRefs.push(...p.refs);
  });
  // حلقه
  const graph = new Map<string, Set<string>>();
  for (const f of all) {
    const set = new Set<string>();
    for (const m of f.methods) for (const b of m.branches) {
      try {
        const pb = parseBranch({ conditionText: b.conditionText ?? "", formulaText: b.formulaText }, 0, false);
        sameLevelDeps(pb.refs, f.level as AttLevel).forEach((k) => set.add(k));
      } catch {
        /* روش قدیمیِ نامعتبر در بررسی حلقه نادیده گرفته می‌شود */
      }
    }
    graph.set(f.key, set);
  }
  graph.set(factor.key, new Set(sameLevelDeps(myRefs, factor.level)));
  const cyc = findCycle(graph, factor.key);
  if (cyc) {
    const titleOf = (k: string) => (k === factor.key && !byKey.has(k) ? "این عامل" : byKey.get(k)?.title ?? k);
    throw new AttendanceError(`ارجاع دوری بین عامل‌ها: ${cyc.map(titleOf).join(" ← ")}`);
  }
}

const nsTitle = (ns: Ns) =>
  ns === "V" ? "متغیر روز" : ns === "F" ? "عامل روزانه" : ns === "A" ? "تجمیع عامل روزانه" : ns === "T" ? "تجمیع متغیر روز" : ns === "M" ? "عامل ماهانه" : ns === "P" ? "پارامتر" : "اطلاعات پایه";

// ───────────────────────── روش‌ها ─────────────────────────

export function methodShape(m: any) {
  return {
    id: m.id,
    factorId: m.factorId,
    execYear: m.execCalendarMonth.year,
    execMonth: m.execCalendarMonth.month,
    branches: [...m.branches].sort((a: any, b: any) => a.seq - b.seq).map((b: any) => ({ conditionText: b.conditionText ?? "", formulaText: b.formulaText })),
    updatedAt: m.updatedAt,
  };
}

export async function listMethods(factorId: number) {
  const rows = await prisma.attendanceFactorMethod.findMany({ where: { factorId }, include: { branches: true, execCalendarMonth: true }, orderBy: { execCalendarMonth: { startDate: "desc" } } });
  return rows.map(methodShape);
}

export async function saveMethod(factorId: number, body: any, methodId?: number) {
  const factor = await prisma.attendanceFactor.findUnique({ where: { id: factorId } });
  if (!factor) throw new AttendanceError("عامل یافت نشد");
  const year = Number(body?.execYear), month = Number(body?.execMonth);
  const cal = await getCalendarMonth(year, month);
  if (!cal) throw new AttendanceError(`ماه ${month} سال ${year} در «تقویم کاری» تعریف نشده است؛ ابتدا تقویم کاری آن سال را بسازید`);
  const branches = cleanBranches(body?.branches);
  await validateBranches({ id: factor.id, key: factor.key, level: factor.level as AttLevel }, branches);
  const clash = await prisma.attendanceFactorMethod.findFirst({ where: { factorId, execCalendarMonthId: cal.id, ...(methodId ? { id: { not: methodId } } : {}) } });
  if (clash) throw new AttendanceError("برای این ماه اجرا قبلاً روشی ثبت شده است؛ آن را ویرایش کنید");
  const rows = branches.map((b, i) => ({ seq: i + 1, conditionText: b.conditionText || null, formulaText: b.formulaText }));
  if (!methodId) {
    return prisma.attendanceFactorMethod.create({ data: { factorId, execCalendarMonthId: cal.id, branches: { create: rows } }, include: { branches: true, execCalendarMonth: true } });
  }
  const ex = await prisma.attendanceFactorMethod.findFirst({ where: { id: methodId, factorId } });
  if (!ex) throw new AttendanceError("روش یافت نشد");
  return prisma.$transaction(async (tx) => {
    await tx.attendanceFactorMethodBranch.deleteMany({ where: { methodId } });
    return tx.attendanceFactorMethod.update({ where: { id: methodId }, data: { execCalendarMonthId: cal.id, branches: { create: rows } }, include: { branches: true, execCalendarMonth: true } });
  });
}

export async function deleteMethod(factorId: number, methodId: number) {
  const m = await prisma.attendanceFactorMethod.findFirst({ where: { id: methodId, factorId } });
  if (!m) throw new AttendanceError("روش یافت نشد");
  await prisma.attendanceFactorMethod.delete({ where: { id: methodId } });
}

// ───────────────────────── پالت فرمول‌ساز ─────────────────────────

export async function palette(level: AttLevel, factorId?: number) {
  const [factors, params] = await Promise.all([
    prisma.attendanceFactor.findMany({ where: { isActive: true }, orderBy: { id: "asc" } }),
    prisma.payrollParameter.findMany({ where: { isActive: true, kind: "CONSTANT", type: { in: ["NUMBER", "AMOUNT"] } }, orderBy: { id: "asc" } }),
  ]);
  const self = factorId ? factors.find((f) => f.id === factorId) : undefined;
  const pick = (lv: AttLevel) => factors.filter((f) => f.level === lv && f.id !== self?.id).map((f) => ({ key: f.key, title: f.title }));
  const aggVariants = Object.entries(AGG_VARIANTS).map(([key, title]) => ({ key, title }));
  const dayVars = Object.entries(DAY_VARS).map(([key, title]) => ({ key, title }));
  const groups =
    level === "DAY"
      ? [
          { ns: "V", title: "متغیرهای روز", items: dayVars, variants: null },
          { ns: "F", title: "عوامل روزانه", items: pick("DAY"), variants: null },
        ]
      : [
          { ns: "A", title: "تجمیع عوامل روزانه در ماه", items: pick("DAY"), variants: aggVariants },
          { ns: "T", title: "تجمیع متغیرهای روز در ماه", items: dayVars, variants: aggVariants },
          { ns: "M", title: "عوامل ماهانه", items: pick("MONTH"), variants: null },
        ];
  return {
    level,
    groups,
    baseInfo: Object.entries(ATT_BASE_INFO).map(([key, title]) => ({ key, title })),
    params: params.map((p) => ({ key: p.key, title: p.title, type: p.type })),
  };
}

// ───────────────────────── محاسبه ─────────────────────────

interface Compiled {
  id: number;
  key: string;
  title: string;
  level: AttLevel;
  valueType: AttValueType;
  branches: { cond: Cond | null; formula: Node; condText: string; formulaText: string }[] | null;
  error: string | null;
  deps: string[];
}
interface Val {
  value: number | null;
  /** شماره‌ی شاخه‌ی اجراشده (۰ = هیچ‌کدام) */
  branch?: number;
  expression?: string;
  error?: string;
}

const dayNum = (d: Date) => Math.floor(d.getTime() / DAY_MS);

async function compileFactors(monthEnd: Date): Promise<Compiled[]> {
  const rows = await prisma.attendanceFactor.findMany({
    where: { isActive: true },
    orderBy: { id: "asc" },
    include: { methods: { include: { branches: true, execCalendarMonth: true } } },
  });
  return rows.map((f) => {
    const level = f.level as AttLevel;
    const eff = f.methods.filter((m) => m.execCalendarMonth.startDate <= monthEnd).sort((a, b) => b.execCalendarMonth.startDate.getTime() - a.execCalendarMonth.startDate.getTime())[0];
    const base: Compiled = { id: f.id, key: f.key, title: f.title, level, valueType: f.valueType as AttValueType, branches: null, error: null, deps: [] };
    if (!eff) return { ...base, error: "برای این ماه روش محاسبه‌ای تعریف نشده است" };
    try {
      const sorted = [...eff.branches].sort((a, b) => a.seq - b.seq);
      const branches = sorted.map((b, i) => {
        const p = parseBranch({ conditionText: b.conditionText ?? "", formulaText: b.formulaText }, i, sorted.length > 1);
        return { cond: p.cond, formula: p.formula, condText: b.conditionText ?? "", formulaText: b.formulaText, refs: p.refs };
      });
      return { ...base, branches, deps: sameLevelDeps(branches.flatMap((b) => b.refs), level) };
    } catch (e: any) {
      return { ...base, error: e?.message || "روش نامعتبر است" };
    }
  });
}

/** ترتیب محاسبه (وابسته‌ها بعد از وابستگی‌ها)؛ عامل‌های درگیر حلقه خطا می‌گیرند */
function orderFactors(list: Compiled[]): Compiled[] {
  const byKey = new Map(list.map((f) => [f.key, f]));
  const out: Compiled[] = [];
  const state = new Map<string, 1 | 2>();
  const visit = (f: Compiled) => {
    if (state.get(f.key) === 2) return;
    if (state.get(f.key) === 1) {
      f.error = f.error ?? "ارجاع دوری بین عامل‌ها";
      return;
    }
    state.set(f.key, 1);
    for (const d of f.deps) {
      const t = byKey.get(d);
      if (t) visit(t);
    }
    state.set(f.key, 2);
    out.push(f);
  };
  list.forEach(visit);
  return out;
}

function runBranches(f: Compiled, env: EvalEnv): Val {
  if (f.error || !f.branches) return { value: null, error: f.error ?? "روش نامعتبر است" };
  try {
    for (let i = 0; i < f.branches.length; i++) {
      const b = f.branches[i];
      let condText: string | null = null;
      if (b.cond) {
        const c = evaluateCondition(b.cond, env);
        if (!c.value) continue;
        condText = c.expression;
      }
      const r = evaluate(b.formula, env);
      return { value: r.value, branch: i + 1, expression: `${condText ? `اگر ${condText} ← ` : ""}${r.expression}` };
    }
    return { value: 0, branch: 0, expression: "هیچ‌یک از شرط‌ها برقرار نبود" };
  } catch (e: any) {
    return { value: null, error: e instanceof FormulaError ? e.message : e?.message || "خطا در محاسبه" };
  }
}

/** متغیرهای یک روز از ردیف‌های «کارکرد روزانه» همان روز */
function dayVariables(rows: any[]): { vars: Record<string, number>; incomplete: boolean; shiftTitle: string } {
  const work = rows.filter((r) => !r.rest);
  const rest = rows.filter((r) => r.rest);
  const ok = work.filter((r) => r.status === "OK");
  const sum = (arr: any[], f: string) => arr.reduce((n, r) => n + (r[f] ?? 0), 0);
  const isWork = work.length > 0;
  const first = rows[0];
  const vars: Record<string, number> = {
    PLANNED: isWork ? first.dayNetMinutes : 0,
    PRESENCE: sum(ok, "presenceMinutes"),
    REST_PRESENCE: sum(rest.filter((r) => r.status === "WORK_ON_REST"), "presenceMinutes"),
    LATE: sum(ok, "lateMinutes"),
    EARLY_LEAVE: sum(ok, "earlyLeaveMinutes"),
    OT_BEFORE: sum(ok, "overtimeBeforeMinutes"),
    OT_AFTER: sum(ok, "overtimeAfterMinutes"),
    BREAK: isWork ? first.dayBreakMinutes : 0,
    LEAVE_MINUTES: isWork ? first.dayLeaveMinutes : 0,
    IS_WORK_DAY: isWork ? 1 : 0,
    IS_REST_DAY: isWork ? 0 : 1,
    ABSENT: isWork && work.every((r) => r.status === "NO_PUNCH") ? 1 : 0,
    ROWS: work.length,
    INCOMPLETE_ROWS: rows.filter((r) => r.status === "INCOMPLETE").length,
  };
  return { vars, incomplete: vars.INCOMPLETE_ROWS > 0, shiftTitle: first.shiftTitle };
}

export interface ComputeOpts {
  year: number;
  month: number;
  employeeId?: number;
}

export async function computeAttendanceResults(opts: ComputeOpts) {
  const cal = await prisma.workCalendarMonth.findFirst({ where: { month: opts.month, calendar: { year: opts.year } }, include: { calendar: true } });
  if (!cal) throw new AttendanceError(`ماه ${opts.month} سال ${opts.year} در «تقویم کاری» تعریف نشده است`);
  const from = cal.trafficStartDate, to = cal.trafficEndDate;
  const compiled = orderFactors(await compileFactors(cal.endDate));
  const dayFactors = compiled.filter((f) => f.level === "DAY");
  const monthFactors = compiled.filter((f) => f.level === "MONTH");
  const factorsOut = compiled.map((f) => ({ key: f.key, id: f.id, title: f.title, level: f.level, valueType: f.valueType, error: f.error }));

  // پارامترهای مبنا: مقدار معتبر در پایان ماه (یک بار)
  const paramCache = new Map<string, number>();
  const param = async (key: string) => {
    if (!paramCache.has(key)) {
      const v = await getParameterValue(key, cal.endDate);
      if (!v || v.type === "BRACKETS" || v.value === null) throw new FormulaError(`برای پارامتر مبنا ${key} در این ماه مقداری تعریف نشده است`);
      paramCache.set(key, v.value);
    }
    return paramCache.get(key)!;
  };
  const paramRows = await prisma.payrollParameter.findMany({ select: { key: true, title: true } });
  const paramTitle = new Map(paramRows.map((p) => [p.key, p.title]));
  const factorTitle = new Map(compiled.map((f) => [f.key, f.title]));
  // پارامترهای استفاده‌شده را پیش‌خوانی می‌کنیم تا ارزیابی همگام بماند
  const used = new Set<string>();
  for (const f of compiled) for (const b of f.branches ?? []) {
    for (const r of [...(b.cond ? collectCondRefs(b.cond) : []), ...collectRefs(b.formula)]) if (r.ns === "P") used.add(r.key);
  }
  const paramErr = new Map<string, string>();
  for (const k of used) {
    try {
      await param(k);
    } catch (e: any) {
      paramErr.set(k, e?.message || "پارامتر نامعتبر است");
    }
  }
  const baseInfo: Record<string, number> = {
    MONTH_DAYS: dayNum(cal.endDate) - dayNum(cal.startDate) + 1,
    STANDARD_DAYS: cal.standardDays,
    ALLOWED_DAYS: cal.allowedDays,
    STANDARD_MINUTES: cal.standardMinutes,
    ALLOWED_MINUTES: cal.allowedMinutes,
    DAILY_MINUTES: cal.calendar.dailyMinutes,
  };
  const scalarCommon = (ns: Ns, key: string): number | undefined => {
    if (ns === "B") return baseInfo[key];
    if (ns === "P") {
      if (paramErr.has(key)) throw new FormulaError(paramErr.get(key)!);
      return paramCache.get(key);
    }
    return undefined;
  };
  const labelOf = (ns: Ns, key: string, variant: string) => {
    if (ns === "V" || ns === "T") return DAY_VARS[key] ? `${ns === "T" ? "تجمیع " : ""}${DAY_VARS[key]}${ns === "T" ? ` (${AGG_VARIANTS[variant] ?? variant})` : ""}` : key;
    if (ns === "F" || ns === "M") return factorTitle.get(key) ?? key;
    if (ns === "A") return `${factorTitle.get(key) ?? key} (${AGG_VARIANTS[variant] ?? variant})`;
    if (ns === "B") return ATT_BASE_INFO[key] ?? key;
    if (ns === "P") return paramTitle.get(key) ?? key;
    return key;
  };
  const noBrackets = () => {
    throw new FormulaError("جدول پلکانی در فرمول تردد پشتیبانی نمی‌شود");
  };

  const ws = await buildWorksheet({ from, to, employeeId: opts.employeeId, includeRest: true });
  const rowsByEmp = new Map<number, any[]>();
  for (const r of ws.rows) (rowsByEmp.get(r.employeeId) ?? rowsByEmp.set(r.employeeId, []).get(r.employeeId)!).push(r);

  const employees: any[] = [];
  const days: any[] = [];
  for (const [empId, rows] of rowsByEmp) {
    const byDate = new Map<string, any[]>();
    for (const r of rows) (byDate.get(r.workDate) ?? byDate.set(r.workDate, []).get(r.workDate)!).push(r);
    const dates = [...byDate.keys()].sort();
    const dayRows: { date: string; vars: Record<string, number>; incomplete: boolean; shiftTitle: string; values: Record<string, Val> }[] = [];

    for (const date of dates) {
      const dv = dayVariables(byDate.get(date)!);
      const values: Record<string, Val> = {};
      const env: EvalEnv = {
        scalar: (ns, key) => {
          if (ns === "V") return dv.vars[key];
          if (ns === "F") {
            const v = values[key];
            if (!v || v.value === null) throw new FormulaError(`عامل «${factorTitle.get(key) ?? key}» مقدار ندارد${v?.error ? ` (${v.error})` : ""}`);
            return v.value;
          }
          const c = scalarCommon(ns, key);
          if (c === undefined) throw new FormulaError(`عملوند [${ns}:${key}] در عامل روزانه مجاز نیست`);
          return c;
        },
        brackets: noBrackets,
        label: labelOf,
      };
      for (const f of dayFactors) values[f.key] = runBranches(f, env);
      dayRows.push({ date, vars: dv.vars, incomplete: dv.incomplete, shiftTitle: dv.shiftTitle, values });
    }

    // تجمیع ماهانه
    const agg = (get: (d: (typeof dayRows)[number]) => number | null, variant: string): number | null => {
      let sum = 0, max = 0, cnt = 0;
      for (const d of dayRows) {
        const v = get(d);
        if (v === null) return null;
        sum += v;
        if (v > max) max = v;
        if (v > 0) cnt++;
      }
      return variant === "SUM" ? sum : variant === "MAX" ? max : cnt;
    };
    const mvals: Record<string, Val> = {};
    const menv: EvalEnv = {
      scalar: (ns, key, variant) => {
        if (ns === "T") return agg((d) => d.vars[key], variant) as number;
        if (ns === "A") {
          const bad = dayRows.filter((d) => d.values[key] === undefined || d.values[key].value === null).length;
          if (bad > 0) throw new FormulaError(`عامل روزانه‌ی «${factorTitle.get(key) ?? key}» در ${bad} روز مقدار نداشت (خطا یا روش تعریف‌نشده)`);
          return agg((d) => d.values[key]?.value ?? 0, variant) as number;
        }
        if (ns === "M") {
          const v = mvals[key];
          if (!v || v.value === null) throw new FormulaError(`عامل «${factorTitle.get(key) ?? key}» مقدار ندارد${v?.error ? ` (${v.error})` : ""}`);
          return v.value;
        }
        const c = scalarCommon(ns, key);
        if (c === undefined) throw new FormulaError(`عملوند [${ns}:${key}] در عامل ماهانه مجاز نیست`);
        return c;
      },
      brackets: noBrackets,
      label: labelOf,
    };
    for (const f of monthFactors) mvals[f.key] = runBranches(f, menv);

    const emp = rows[0];
    employees.push({
      employeeId: empId,
      personnelCode: emp.personnelCode,
      employeeName: emp.employeeName,
      days: dayRows.length,
      incompleteDays: dayRows.filter((d) => d.incomplete).length,
      values: mvals,
    });
    for (const d of dayRows) days.push({ employeeId: empId, personnelCode: emp.personnelCode, employeeName: emp.employeeName, date: d.date, shiftTitle: d.shiftTitle, incomplete: d.incomplete, vars: d.vars, values: d.values });
  }
  employees.sort((a, b) => (a.personnelCode < b.personnelCode ? -1 : 1));
  days.sort((a, b) => (a.personnelCode < b.personnelCode ? -1 : a.personnelCode > b.personnelCode ? 1 : a.date < b.date ? -1 : 1));
  return {
    year: opts.year,
    month: opts.month,
    from: dayStr(from),
    to: dayStr(to),
    factors: factorsOut,
    employees,
    days,
    summary: { employees: employees.length, days: days.length, incompleteDays: days.filter((d) => d.incomplete).length, factorErrors: factorsOut.filter((f) => f.error).length },
  };
}
