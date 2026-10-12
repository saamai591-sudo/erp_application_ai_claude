// موتور فرمول حقوق: متن فرمول → درخت → ارزیابی امن (بدون eval). عملوندها با نام‌فضا و کلید می‌آیند:
//   [D:<کد جزء حکم>]  مبلغ محاسبه‌شده‌ی جزء حکم در همین ماه
//   [C:<کلید جزء حقوق>]  مبلغ محاسبه‌شده‌ی جزء حقوق دیگر (ترتیب محاسبه از همین وابستگی می‌آید)
//   [P:<کلید پارامتر قانونی>]  مقدار معتبر پارامتر در تاریخ ماه (جدول پلکانی فقط داخل PROGRESSIVE)
//   [V:<متغیر ماه>]  WORK_DAYS, MONTH_DAYS, OVERTIME_HOURS, OVERTIME_BASE_TOTAL, INSURABLE_TOTAL, TAXABLE_TOTAL, EARNINGS_TOTAL
// توابع: MIN(...), MAX(...), ROUND(x[, ارقام]), PROGRESSIVE([P:جدول], مبلغ). عملگرها: + - * / و پرانتز.

export type Node =
  | { t: "num"; v: number }
  | { t: "ref"; ns: "D" | "C" | "P" | "V"; key: string }
  | { t: "neg"; a: Node }
  | { t: "bin"; op: "+" | "-" | "*" | "/"; a: Node; b: Node }
  | { t: "fn"; name: string; args: Node[] };

export class FormulaError extends Error {}

/** متغیرهایی که جمع «مزایا»ی نهایی را می‌خوانند؛ فقط برای اجزای غیر مزیت مجازند */
export const TOTAL_VARS = ["INSURABLE_TOTAL", "TAXABLE_TOTAL", "EARNINGS_TOTAL"];
export const VARIABLES: Record<string, string> = {
  WORK_DAYS: "روز کارکرد",
  MONTH_DAYS: "روزهای ماه",
  OVERTIME_HOURS: "ساعت اضافه‌کار",
  OVERTIME_BASE_TOTAL: "مبنای اضافه‌کار (جمع ماهانه‌ی اجزای مشمول)",
  INSURABLE_TOTAL: "جمع مشمول بیمه",
  TAXABLE_TOTAL: "جمع مشمول مالیات",
  EARNINGS_TOTAL: "جمع مزایا",
};
const FUNCTIONS: Record<string, { min: number; max: number }> = { MIN: { min: 2, max: 8 }, MAX: { min: 2, max: 8 }, ROUND: { min: 1, max: 2 }, PROGRESSIVE: { min: 2, max: 2 } };

// ── تجزیه ──
type Tok = { k: "num" | "ref" | "id" | "op" | "lp" | "rp" | "comma"; s: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
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
    if ("+-*/".includes(c)) { out.push({ k: "op", s: c }); i++; continue; }
    if (c === "(") { out.push({ k: "lp", s: c }); i++; continue; }
    if (c === ")") { out.push({ k: "rp", s: c }); i++; continue; }
    if (c === ",") { out.push({ k: "comma", s: c }); i++; continue; }
    throw new FormulaError(`نویسه‌ی نامعتبر «${c}» در فرمول`);
  }
  return out;
}

export function parseFormula(src: string): Node {
  const toks = tokenize(src);
  if (toks.length === 0) throw new FormulaError("فرمول خالی است");
  let p = 0;
  const peek = () => toks[p];
  const next = () => toks[p++];

  function expr(): Node {
    let n = term();
    while (peek() && peek().k === "op" && (peek().s === "+" || peek().s === "-")) {
      const op = next().s as "+" | "-";
      n = { t: "bin", op, a: n, b: term() };
    }
    return n;
  }
  function term(): Node {
    let n = factor();
    while (peek() && peek().k === "op" && (peek().s === "*" || peek().s === "/")) {
      const op = next().s as "*" | "/";
      n = { t: "bin", op, a: n, b: factor() };
    }
    return n;
  }
  function factor(): Node {
    const t = next();
    if (!t) throw new FormulaError("فرمول ناقص است");
    if (t.k === "op" && t.s === "-") return { t: "neg", a: factor() };
    if (t.k === "num") {
      const v = Number(t.s);
      if (!isFinite(v)) throw new FormulaError(`عدد نامعتبر «${t.s}»`);
      return { t: "num", v };
    }
    if (t.k === "ref") {
      const m = /^([DCPV]):([A-Za-z0-9_]+)$/.exec(t.s.trim());
      if (!m) throw new FormulaError(`عملوند نامعتبر [${t.s}] — شکل درست: [D:کد] [C:کلید] [P:کلید] [V:کلید]`);
      const ns = m[1] as "D" | "C" | "P" | "V";
      const key = ns === "D" ? m[2] : m[2].toUpperCase();
      if (ns === "V" && !VARIABLES[key]) throw new FormulaError(`متغیر ناشناخته [V:${key}]`);
      return { t: "ref", ns, key };
    }
    if (t.k === "lp") {
      const n = expr();
      if (!next() || toks[p - 1].k !== "rp") throw new FormulaError("پرانتز بسته نشده است");
      return n;
    }
    if (t.k === "id") {
      const spec = FUNCTIONS[t.s];
      if (!spec) throw new FormulaError(`تابع ناشناخته «${t.s}»`);
      if (!peek() || peek().k !== "lp") throw new FormulaError(`بعد از ${t.s} پرانتز لازم است`);
      next();
      const args: Node[] = [];
      if (peek() && peek().k === "rp") throw new FormulaError(`تابع ${t.s} آرگومان لازم دارد`);
      for (;;) {
        args.push(expr());
        const s = next();
        if (!s) throw new FormulaError("پرانتز تابع بسته نشده است");
        if (s.k === "rp") break;
        if (s.k !== "comma") throw new FormulaError("بین آرگومان‌ها ویرگول لازم است");
      }
      if (args.length < spec.min || args.length > spec.max) throw new FormulaError(`تعداد آرگومان‌های ${t.s} نامعتبر است`);
      if (t.s === "PROGRESSIVE" && !(args[0].t === "ref" && args[0].ns === "P")) {
        throw new FormulaError("آرگومان اول PROGRESSIVE باید یک پارامتر جدولی مثل [P:TAX_BRACKETS] باشد");
      }
      return { t: "fn", name: t.s, args };
    }
    throw new FormulaError(`جای نامعتبر برای «${t.s}»`);
  }

  const n = expr();
  if (p < toks.length) throw new FormulaError(`بخش اضافه در انتهای فرمول: «${toks[p].s}»`);
  return n;
}

/** همه‌ی عملوندهای درخت (برای وابستگی و اعتبارسنجی) */
export function collectRefs(n: Node, out: { ns: "D" | "C" | "P" | "V"; key: string }[] = []) {
  if (n.t === "ref") out.push({ ns: n.ns, key: n.key });
  else if (n.t === "neg") collectRefs(n.a, out);
  else if (n.t === "bin") {
    collectRefs(n.a, out);
    collectRefs(n.b, out);
  } else if (n.t === "fn") n.args.forEach((a) => collectRefs(a, out));
  return out;
}

// ── ارزیابی ──
export interface Bracket {
  from: number;
  to: number | null;
  rate: number;
}
export interface EvalEnv {
  /** مقدار عملوند؛ خطا (FormulaError) = مقدار ناموجود */
  scalar: (ns: "D" | "C" | "P" | "V", key: string) => number;
  /** جدول پلکانی پارامتر */
  brackets: (key: string) => Bracket[];
  label: (ns: "D" | "C" | "P" | "V", key: string) => string;
}
export interface Operand {
  ref: string;
  label: string;
  value: number | null;
  /** برای جدول پلکانی: ریز محاسبه‌ی هر پله */
  steps?: { from: number; to: number | null; rate: number; taxable: number; tax: number }[];
}
export interface EvalResult {
  value: number;
  operands: Operand[];
  /** فرمول با مقدارهای جایگزین‌شده، برای نمایش در گزارش */
  expression: string;
}

const fmt = (v: number) => {
  const r = Math.round(v * 10000) / 10000;
  return Math.abs(r) >= 1000 ? r.toLocaleString("en-US", { maximumFractionDigits: 4 }) : String(r);
};

export function evaluate(root: Node, env: EvalEnv): EvalResult {
  const operands: Operand[] = [];
  const seen = new Set<string>();
  const note = (o: Operand) => {
    if (seen.has(o.ref)) return;
    seen.add(o.ref);
    operands.push(o);
  };

  // هر گره: [مقدار، متن جایگزین‌شده]
  function ev(n: Node): [number, string] {
    switch (n.t) {
      case "num":
        return [n.v, fmt(n.v)];
      case "ref": {
        const v = env.scalar(n.ns, n.key);
        note({ ref: `[${n.ns}:${n.key}]`, label: env.label(n.ns, n.key), value: v });
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
          note({ ref: `[P:${key}]`, label: env.label("P", key), value: null, steps });
          return [tax, `PROGRESSIVE(جدول، ${sa})`];
        }
        const vals = n.args.map(ev);
        const nums = vals.map((x) => x[0]);
        const strs = vals.map((x) => x[1]).join("، ");
        if (n.name === "MIN") return [Math.min(...nums), `MIN(${strs})`];
        if (n.name === "MAX") return [Math.max(...nums), `MAX(${strs})`];
        if (n.name === "ROUND") {
          const d = nums[1] ?? 0;
          const f = Math.pow(10, d);
          return [Math.round(nums[0] * f) / f, `ROUND(${strs})`];
        }
        throw new FormulaError(`تابع ${n.name} پشتیبانی نمی‌شود`);
      }
    }
  }
  const [value, expression] = ev(root);
  if (!isFinite(value)) throw new FormulaError("نتیجه‌ی فرمول عدد معتبر نیست");
  return { value, operands, expression };
}
