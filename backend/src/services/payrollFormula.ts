// موتور فرمول حقوق: متن فرمول/شرط → درخت → ارزیابی امن (بدون eval). عملوندها با نام‌فضا می‌آیند:
//   [D:<کد عامل حکم>[:نوع]]   LAST آخرین مقدار حکم، AVG میانگین حکم، VALUE مقدار محاسبه‌شده (پیش‌فرض)، YTD_PREV سال تا ماه قبل، ALL_PREV تا ماه قبل، PREV ماه قبل
//   [C:<کلید عامل حقوق>[:نوع]]  VALUE مقدار (پیش‌فرض)، YTD سال تا ماه (با ماه جاری)، YTD_PREV، ALL_PREV، PREV
//   [P:<کلید پارامتر مبنا>]   مقدار معتبر پارامتر (جدول پلکانی فقط داخل PROGRESSIVE)
//   [B:<اطلاعات پایه>]          MONTH_DAYS, YEAR_DAYS, SERVICE_DAYS, SERVICE_YEARS, MONTH_NO
//   [S:<طبقه>]                  جمع همه‌ی عوامل آن طبقه در همین ماه: EARNING (پرداختی)، DEDUCTION (کسر)، EMPLOYER_COST (هزینه کارفرما)، INFO (اطلاعاتی)؛ [S:LOANS] = جمع اقساط وام
// توابع: MIN(...), MAX(...), ROUND(x[, ارقام]), PROGRESSIVE([P:جدول], مبلغ). عملگرها: + - * / و پرانتز.
// شرط: مقایسه‌ها (> >= < <= = <>) با AND/OR (و/یا) و پرانتز؛ شرط خالی = همیشه برقرار.

import { AGG_VARIANTS, ATT_BASE_INFO, BAND_KEY_RE, DAY_VARS } from "./attendanceFormulaDefs";

// V F A T M = نام‌فضاهای فرمول‌ساز تردد (attendanceFormulaDefs.ts)؛ در گویش حقوق پذیرفته نمی‌شوند و برعکس
export type Ns = "D" | "C" | "P" | "B" | "S" | "V" | "F" | "A" | "T" | "M";
export type Dialect = "PAYROLL" | "ATTENDANCE";

export type Node =
  | { t: "num"; v: number }
  | { t: "ref"; ns: Ns; key: string; variant: string }
  | { t: "neg"; a: Node }
  | { t: "bin"; op: "+" | "-" | "*" | "/"; a: Node; b: Node }
  | { t: "fn"; name: string; args: Node[] };

export type Cond =
  | { t: "cmp"; op: ">" | ">=" | "<" | "<=" | "=" | "<>"; a: Node; b: Node }
  | { t: "and" | "or"; a: Cond; b: Cond };

export class FormulaError extends Error {}

export const BASE_INFO: Record<string, string> = {
  MONTH_DAYS: "تعداد روزهای ماه",
  YEAR_DAYS: "تعداد روزهای سال",
  SERVICE_DAYS: "مدت همکاری (روز)",
  SERVICE_YEARS: "مدت همکاری (سال)",
  MONTH_NO: "شماره ماه محاسبه",
  STANDARD_DAYS: "روزهای استاندارد ماه (تقویم کاری)",
  ALLOWED_DAYS: "روزهای مجاز ماه (تقویم کاری)",
  STANDARD_HOURS: "ساعات استاندارد ماه (تقویم کاری)",
  ALLOWED_HOURS: "ساعات مجاز ماه (تقویم کاری)",
};
export const KIND_FA: Record<string, string> = { WORK: "کارکرد", EARNING: "پرداختی", DEDUCTION: "کسر", EMPLOYER_COST: "هزینه کارفرما", INFO: "اطلاعاتی" };
/** [S:LOANS] = جمع اقساط وام‌های کارمند در همین ماه (از «وام» می‌آید، نه از جمع یک طبقه‌ی عامل‌ها) */
export const LOAN_SUM_KEY = "LOANS";
export const LOAN_SUM_LABEL = "جمع اقساط وام";

export const DECREE_VARIANTS: Record<string, string> = {
  LAST: "آخرین مقدار حکم",
  AVG: "میانگین حکم",
  VALUE: "مقدار محاسبه‌شده",
  YTD_PREV: "مقدار سال تا ماه قبل",
  ALL_PREV: "مقدار تا ماه قبل",
  PREV: "مقدار ماه قبل",
};
export const FACTOR_VARIANTS: Record<string, string> = {
  VALUE: "مقدار",
  YTD: "مقدار سال تا ماه",
  YTD_PREV: "مقدار سال تا ماه قبل",
  ALL_PREV: "مقدار تا ماه قبل",
  PREV: "مقدار ماه قبل",
};

const FUNCTIONS: Record<string, { min: number; max: number }> = { MIN: { min: 2, max: 8 }, MAX: { min: 2, max: 8 }, ROUND: { min: 1, max: 2 }, PROGRESSIVE: { min: 2, max: 2 } };

// ── تجزیه ──
type Tok = { k: "num" | "ref" | "id" | "op" | "cmp" | "lp" | "rp" | "comma"; s: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === "[") {
      const j = src.indexOf("]", i);
      if (j < 0) throw new FormulaError("کروشه‌ی عملوند بسته نشده است");
      out.push({ k: "ref", s: src.slice(i + 1, j) });
      i = j + 1;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      out.push({ k: "num", s: src.slice(i, j) });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      out.push({ k: "id", s: src.slice(i, j).toUpperCase() });
      i = j;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (two === ">=" || two === "<=" || two === "<>" || two === "!=" || two === "==") {
      out.push({ k: "cmp", s: two === "!=" ? "<>" : two === "==" ? "=" : two });
      i += 2;
      continue;
    }
    if (c === ">" || c === "<" || c === "=") {
      out.push({ k: "cmp", s: c });
      i++;
      continue;
    }
    if ("+-*/".includes(c)) {
      out.push({ k: "op", s: c });
      i++;
      continue;
    }
    if (c === "(") {
      out.push({ k: "lp", s: c });
      i++;
      continue;
    }
    if (c === ")") {
      out.push({ k: "rp", s: c });
      i++;
      continue;
    }
    if (c === ",") {
      out.push({ k: "comma", s: c });
      i++;
      continue;
    }
    throw new FormulaError(`نویسه‌ی نامعتبر «${c}»`);
  }
  return out;
}

class Parser {
  p = 0;
  constructor(public toks: Tok[], public dialect: Dialect = "PAYROLL") {}
  peek() {
    return this.toks[this.p];
  }
  next() {
    return this.toks[this.p++];
  }

  expr(): Node {
    let n = this.term();
    while (this.peek() && this.peek().k === "op" && (this.peek().s === "+" || this.peek().s === "-")) {
      const op = this.next().s as "+" | "-";
      n = { t: "bin", op, a: n, b: this.term() };
    }
    return n;
  }
  term(): Node {
    let n = this.factor();
    while (this.peek() && this.peek().k === "op" && (this.peek().s === "*" || this.peek().s === "/")) {
      const op = this.next().s as "*" | "/";
      n = { t: "bin", op, a: n, b: this.factor() };
    }
    return n;
  }
  factor(): Node {
    const t = this.next();
    if (!t) throw new FormulaError("عبارت ناقص است");
    if (t.k === "op" && t.s === "-") return { t: "neg", a: this.factor() };
    if (t.k === "num") {
      const v = Number(t.s);
      if (!isFinite(v)) throw new FormulaError(`عدد نامعتبر «${t.s}»`);
      return { t: "num", v };
    }
    if (t.k === "ref") return parseRef(t.s, this.dialect);
    if (t.k === "lp") {
      const n = this.expr();
      const c = this.next();
      if (!c || c.k !== "rp") throw new FormulaError("پرانتز بسته نشده است");
      return n;
    }
    if (t.k === "id") {
      const spec = FUNCTIONS[t.s];
      if (!spec) throw new FormulaError(`تابع ناشناخته «${t.s}»`);
      const lp = this.next();
      if (!lp || lp.k !== "lp") throw new FormulaError(`بعد از ${t.s} پرانتز لازم است`);
      const args: Node[] = [];
      for (;;) {
        args.push(this.expr());
        const s = this.next();
        if (!s) throw new FormulaError("پرانتز تابع بسته نشده است");
        if (s.k === "rp") break;
        if (s.k !== "comma") throw new FormulaError("بین آرگومان‌ها ویرگول لازم است");
      }
      if (args.length < spec.min || args.length > spec.max) throw new FormulaError(`تعداد آرگومان‌های ${t.s} نامعتبر است`);
      if (t.s === "PROGRESSIVE" && !(args[0].t === "ref" && args[0].ns === "P")) {
        throw new FormulaError("آرگومان اول PROGRESSIVE باید یک جدول پلکانی قانونی باشد");
      }
      return { t: "fn", name: t.s, args };
    }
    throw new FormulaError(`جای نامعتبر برای «${t.s}»`);
  }

  // شرط
  cond(): Cond {
    let n = this.andC();
    while (this.peek() && this.peek().k === "id" && this.peek().s === "OR") {
      this.next();
      n = { t: "or", a: n, b: this.andC() };
    }
    return n;
  }
  andC(): Cond {
    let n = this.cmp();
    while (this.peek() && this.peek().k === "id" && this.peek().s === "AND") {
      this.next();
      n = { t: "and", a: n, b: this.cmp() };
    }
    return n;
  }
  cmp(): Cond {
    if (this.peek() && this.peek().k === "lp") {
      const save = this.p;
      try {
        this.next();
        const c = this.cond();
        const r = this.next();
        if (r && r.k === "rp") return c;
      } catch {
        /* پرانتز مربوط به عبارت محاسباتی است */
      }
      this.p = save;
    }
    const a = this.expr();
    const o = this.next();
    if (!o || o.k !== "cmp") throw new FormulaError("در شرط، بین دو مقدار یک عملگر مقایسه (> < = …) لازم است");
    const b = this.expr();
    return { t: "cmp", op: o.s as any, a, b };
  }
}

const DIALECT_NS: Record<Dialect, string> = { PAYROLL: "DCPBS", ATTENDANCE: "VFATMPB" };

function parseRef(raw: string, dialect: Dialect = "PAYROLL"): Node {
  const m = /^([A-Z]):([A-Za-z0-9_]+)(?::([A-Za-z_]+))?$/.exec(raw.trim());
  if (!m || !DIALECT_NS[dialect].includes(m[1])) throw new FormulaError(`عملوند نامعتبر [${raw}]`);
  const ns = m[1] as Ns;
  const key = ns === "D" ? m[2] : m[2].toUpperCase();
  const variant = (m[3] ?? "").toUpperCase();
  if (dialect === "ATTENDANCE") {
    if (ns === "V") {
      if (!DAY_VARS[key] && !BAND_KEY_RE.test(key)) throw new FormulaError(`متغیر روز ناشناخته [${raw}]`);
    } else if (ns === "B") {
      if (!ATT_BASE_INFO[key]) throw new FormulaError(`اطلاعات پایه‌ی ناشناخته [${raw}]`);
    } else if (ns === "T" && !DAY_VARS[key] && !BAND_KEY_RE.test(key)) throw new FormulaError(`متغیر روز ناشناخته [${raw}]`);
    if (ns === "A" || ns === "T") {
      const v = variant || "SUM";
      if (!AGG_VARIANTS[v]) throw new FormulaError(`نوع تجمیع [${raw}] نامعتبر است`);
      return { t: "ref", ns, key, variant: v };
    }
    if (variant) throw new FormulaError(`[${raw}] نوع مقدار ندارد`);
    return { t: "ref", ns, key, variant: "" };
  }
  if (ns === "D") {
    const v = variant || "VALUE";
    if (!DECREE_VARIANTS[v]) throw new FormulaError(`نوع مقدار [${raw}] برای عامل حکم نامعتبر است`);
    return { t: "ref", ns, key, variant: v };
  }
  if (ns === "C") {
    const v = variant || "VALUE";
    if (!FACTOR_VARIANTS[v]) throw new FormulaError(`نوع مقدار [${raw}] برای عامل حقوق نامعتبر است`);
    return { t: "ref", ns, key, variant: v };
  }
  if (ns === "B" && !BASE_INFO[key]) throw new FormulaError(`اطلاعات پایه‌ی ناشناخته [${raw}]`);
  if (ns === "S" && !KIND_FA[key] && key !== LOAN_SUM_KEY) throw new FormulaError(`طبقه‌ی ناشناخته [${raw}]`);
  if (variant) throw new FormulaError(`[${raw}] نوع مقدار ندارد`);
  return { t: "ref", ns, key, variant: "" };
}

export function parseFormula(src: string, dialect: Dialect = "PAYROLL"): Node {
  const toks = tokenize(src);
  if (toks.length === 0) throw new FormulaError("فرمول خالی است");
  const ps = new Parser(toks, dialect);
  const n = ps.expr();
  if (ps.p < toks.length) throw new FormulaError(`بخش اضافه در انتهای فرمول: «${toks[ps.p].s}»`);
  return n;
}

export function parseCondition(src: string, dialect: Dialect = "PAYROLL"): Cond {
  const toks = tokenize(src);
  const ps = new Parser(toks, dialect);
  const c = ps.cond();
  if (ps.p < toks.length) throw new FormulaError(`بخش اضافه در انتهای شرط: «${toks[ps.p].s}»`);
  return c;
}

export interface RefInfo {
  ns: Ns;
  key: string;
  variant: string;
}
function refsOfNode(n: Node, out: RefInfo[]) {
  if (n.t === "ref") out.push({ ns: n.ns, key: n.key, variant: n.variant });
  else if (n.t === "neg") refsOfNode(n.a, out);
  else if (n.t === "bin") {
    refsOfNode(n.a, out);
    refsOfNode(n.b, out);
  } else if (n.t === "fn") n.args.forEach((a) => refsOfNode(a, out));
}
export function collectRefs(n: Node, out: RefInfo[] = []) {
  refsOfNode(n, out);
  return out;
}
export function collectCondRefs(c: Cond, out: RefInfo[] = []) {
  if (c.t === "cmp") {
    refsOfNode(c.a, out);
    refsOfNode(c.b, out);
  } else {
    collectCondRefs(c.a, out);
    collectCondRefs(c.b, out);
  }
  return out;
}

// ── ارزیابی ──
export interface Bracket {
  from: number;
  to: number | null;
  rate: number;
}
export interface EvalEnv {
  scalar: (ns: Ns, key: string, variant: string) => number;
  brackets: (key: string) => Bracket[];
  label: (ns: Ns, key: string, variant: string) => string;
  /** ریز اجزای یک عملوند (مثلاً اعضای یک مبنا) برای نمایش در گزارش */
  parts?: (ns: Ns, key: string, variant: string) => { label: string; value: number }[] | undefined;
}
export interface Operand {
  ref: string;
  label: string;
  value: number | null;
  steps?: { from: number; to: number | null; rate: number; taxable: number; tax: number }[];
  /** ریز اجزا (اعضای مبنا و مبلغ هر کدام) */
  parts?: { label: string; value: number }[];
}
export interface EvalResult {
  value: number;
  operands: Operand[];
  expression: string;
}

const fmt = (v: number) => {
  const r = Math.round(v * 10000) / 10000;
  return Math.abs(r) >= 1000 ? r.toLocaleString("en-US", { maximumFractionDigits: 4 }) : String(r);
};
const refText = (n: { ns: Ns; key: string; variant: string }) => `[${n.ns}:${n.key}${n.variant && n.variant !== "VALUE" ? ":" + n.variant : ""}]`;

function makeEvaluator(env: EvalEnv) {
  const operands: Operand[] = [];
  const seen = new Set<string>();
  const note = (o: Operand) => {
    if (seen.has(o.ref)) return;
    seen.add(o.ref);
    operands.push(o);
  };
  function ev(n: Node): [number, string] {
    switch (n.t) {
      case "num":
        return [n.v, fmt(n.v)];
      case "ref": {
        const v = env.scalar(n.ns, n.key, n.variant);
        const parts = env.parts?.(n.ns, n.key, n.variant);
        note({ ref: refText(n), label: env.label(n.ns, n.key, n.variant), value: v, ...(parts ? { parts } : {}) });
        return [v, fmt(v)];
      }
      case "neg": {
        const [v, s] = ev(n.a);
        return [-v, `-${s}`];
      }
      case "bin": {
        const [a, sa] = ev(n.a);
        const [b, sb] = ev(n.b);
        if (n.op === "/" && b === 0) throw new FormulaError("تقسیم بر صفر");
        const v = n.op === "+" ? a + b : n.op === "-" ? a - b : n.op === "*" ? a * b : a / b;
        return [v, `(${sa} ${n.op === "*" ? "×" : n.op === "/" ? "÷" : n.op} ${sb})`];
      }
      case "fn": {
        if (n.name === "PROGRESSIVE") {
          const key = (n.args[0] as { key: string }).key;
          const [amount, sa] = ev(n.args[1]);
          const br = env.brackets(key);
          let tax = 0;
          const steps: NonNullable<Operand["steps"]> = [];
          for (const b of br) {
            const top = b.to === null ? amount : Math.min(amount, b.to);
            const taxable = Math.max(0, top - b.from);
            const t = (taxable * b.rate) / 100;
            steps.push({ from: b.from, to: b.to, rate: b.rate, taxable, tax: t });
            tax += t;
          }
          note({ ref: `[P:${key}]`, label: env.label("P", key, ""), value: null, steps });
          return [tax, `PROGRESSIVE(جدول، ${sa})`];
        }
        const vals = n.args.map(ev);
        const nums = vals.map((x) => x[0]);
        const strs = vals.map((x) => x[1]).join("، ");
        if (n.name === "MIN") return [Math.min(...nums), `MIN(${strs})`];
        if (n.name === "MAX") return [Math.max(...nums), `MAX(${strs})`];
        if (n.name === "ROUND") {
          const f = Math.pow(10, nums[1] ?? 0);
          return [Math.round(nums[0] * f) / f, `ROUND(${strs})`];
        }
        throw new FormulaError(`تابع ${n.name} پشتیبانی نمی‌شود`);
      }
    }
  }
  function cond(c: Cond): [boolean, string] {
    if (c.t === "cmp") {
      const [a, sa] = ev(c.a);
      const [b, sb] = ev(c.b);
      const eps = 1e-9;
      const r = c.op === ">" ? a > b : c.op === ">=" ? a >= b : c.op === "<" ? a < b : c.op === "<=" ? a <= b : c.op === "=" ? Math.abs(a - b) < eps : Math.abs(a - b) >= eps;
      return [r, `${sa} ${c.op} ${sb}`];
    }
    const [x, sx] = cond(c.a);
    const [y, sy] = cond(c.b);
    return c.t === "and" ? [x && y, `(${sx} و ${sy})`] : [x || y, `(${sx} یا ${sy})`];
  }
  return { operands, ev, cond };
}

export function evaluate(root: Node, env: EvalEnv): EvalResult {
  const m = makeEvaluator(env);
  const [value, expression] = m.ev(root);
  if (!isFinite(value)) throw new FormulaError("نتیجه‌ی فرمول عدد معتبر نیست");
  return { value, operands: m.operands, expression };
}

export function evaluateCondition(c: Cond, env: EvalEnv): { value: boolean; operands: Operand[]; expression: string } {
  const m = makeEvaluator(env);
  const [value, expression] = m.cond(c);
  return { value, operands: m.operands, expression };
}
