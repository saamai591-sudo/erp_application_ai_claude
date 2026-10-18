import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "./Modal";
import { ErrorToast } from "./ErrorToast";
import { api, ApiError } from "../lib/api";

// پنجره‌ی فرمول‌نویس حقوق: روش می‌تواند چند «شاخه» داشته باشد (شرط ← فرمول)؛ هر شاخه «عبارت شرطی» و «عبارت محاسباتی» به‌صورت چیپ دارد و در پایین
// سه زبانه‌ی عوامل / توابع / مقادیر ثابت است. از بالا به پایین اولین شاخه‌ای که شرطش برقرار است اجرا می‌شود؛ شاخه‌ی بدون شرط («در غیر این صورت»)
// فقط آخرین شاخه می‌تواند باشد و اگر هیچ شاخه‌ای برقرار نباشد مقدار عامل صفر است.
// زبانه‌ی عوامل چهار گرید دارد: دسته ← طبقه ← عامل ← مقدار (نوع مقدار بر اساس دسته). ذخیره‌ی متن همان زبان فرمول سرور است
// ([D:کد:نوع] [C:کلید:نوع] [P:کلید] [B:کلید] [S:طبقه])؛ کلیدها به کاربر نشان داده نمی‌شوند و چیپ‌ها عنوان فارسی دارند.
// ویرایش مثل یک ویرایشگر متن: مکان‌نما (caret) بین چیپ‌ها با کلیک روی هر چیپ (نیمه‌ی چپ = قبل، نیمه‌ی راست = بعد) جابه‌جا می‌شود و درج از پالت یا تایپ
// همیشه در همان نقطه‌ی «ناحیه‌ی فعال» انجام می‌شود (فوکوس بعد از درج در ناحیه می‌ماند و کلیک اضافه لازم نیست)؛ فلش‌ها/Home/End، Shift برای انتخاب بازه،
// Ctrl+A/C/X/V، Backspace/Delete.

interface Palette {
  decree: { title: string; factors: { code: string; title: string }[]; variants: { key: string; title: string }[] };
  payroll: {
    method: string;
    title: string;
    classes: { kind: string; title: string; factors: { key: string; title: string }[] }[];
    variants: { key: string; title: string }[];
  }[];
  baseInfo: { key: string; title: string }[];
  /** مبناها (پارامتر نوع «مبنا»): در فرمول [P:کلید] جمع مبلغ عضوها را می‌دهد */
  bases?: { key: string; title: string; source: string | null }[];
  classTotals: { key: string; title: string }[];
  /** personnel = مقدار ثابت پرسنلی (مقدار اختصاصی هر کارمند؛ ثبت‌نشده صفر) */
  params: { key: string; title: string; type: string; personnel?: "HR" | "PAYROLL" | null }[];
}

type Area = "cond" | "calc";
/** یک ناحیه‌ی قابل ویرایش: شرط یا فرمولِ شاخه‌ی b */
interface Slot {
  b: number;
  a: Area;
}
const sk = (s: Slot) => `${s.b}:${s.a}`;

export interface FormulaBranch {
  conditionText: string;
  formulaText: string;
}

/** ارقام فارسی/عربی → انگلیسی؛ «٫» (جداکننده‌ی اعشار فارسی) → «.» */
function normalizeDigits(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/٫/g, ".");
}

/** متن فرمول → فهرست توکن‌ها (هر توکن یک رشته) */
function tokenize(src: string): string[] {
  src = normalizeDigits(src);
  return src.match(/\[[^\]]+\]|\d+(?:\.\d+)?|\.\d+|>=|<=|<>|[+\-*/(),<>=]|[A-Za-z_]+/g) ?? [];
}

/** ورودی عدد: فقط رقم و یک اعشار (ارقام فارسی و «٫» و «/» هم قبول است) */
function cleanNumber(raw: string): string {
  const t = normalizeDigits(raw).replace(/\//g, ".").replace(/[^0-9.]/g, "");
  const i = t.indexOf(".");
  return i < 0 ? t : t.slice(0, i + 1) + t.slice(i + 1).replace(/\./g, "");
}

const OPS_CALC = ["+", "-", "*", "/", "(", ")", ","];
const OPS_COND = [">", ">=", "<", "<=", "=", "<>"];

interface Draft {
  cond: string[];
  calc: string[];
}

export function FormulaBuilder({
  basis,
  factorId,
  factorTitle,
  method,
  branches,
  basisIds,
  onClose,
  onSave,
}: {
  basis: "decree" | "payroll";
  factorId: string;
  /** عنوان عاملی که فرمولش تعریف می‌شود؛ در عنوان پنجره نمایش داده می‌شود */
  factorTitle: string;
  method: string;
  branches: FormulaBranch[];
  /** مبناهایی که این عامل عضو آن‌هاست (برای کنترل ارجاع دوری هنگام «بررسی») */
  basisIds?: number[];
  onClose: () => void;
  onSave: (branches: FormulaBranch[]) => void;
}) {
  const [pal, setPal] = useState<Palette | null>(null);
  const [br, setBr] = useState<Draft[]>(() =>
    (branches.length ? branches : [{ conditionText: "", formulaText: "" }]).map((x) => ({ cond: tokenize(x.conditionText), calc: tokenize(x.formulaText) }))
  );
  const [active, setActive] = useState<Slot>({ b: 0, a: "calc" });
  // مکان‌نما = شماره‌ی نقطه‌ی درج بین توکن‌ها (۰..تعداد) برای هر ناحیه؛ انتخاب = بازه‌ی [from, to) توکن‌های یک ناحیه
  const endCarets = (ds: Draft[]) => Object.fromEntries(ds.flatMap((d, b) => [[`${b}:cond`, d.cond.length], [`${b}:calc`, d.calc.length]])) as Record<string, number>;
  const [caret, setCaretState] = useState<Record<string, number>>(() => endCarets(br));
  const [sel, setSel] = useState<{ k: string; from: number; to: number } | null>(null);
  const anchor = useRef<Record<string, number>>({});
  const areaRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pasteHandled = useRef(false);
  const [tab, setTab] = useState<"factors" | "functions" | "constants">("factors");
  const [cat, setCat] = useState<string>("");
  const [cls, setCls] = useState<string>("");
  const [fac, setFac] = useState<string>("");
  const [num, setNum] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const clipRef = useRef<string[]>([]);

  useEffect(() => {
    // عامل‌های قابل استفاده به نوع محاسبه‌ی عاملِ در دست تعریف بستگی دارد (سرور بر اساس عامل انتخاب‌شده فیلتر می‌کند)
    api.get(`/payroll-methods/palette?basis=${basis}&factorId=${encodeURIComponent(factorId)}`).then(setPal).catch((e) => setErr(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // عنوان فارسی هر توکن
  const labelOf = useMemo(() => {
    const m = new Map<string, string>();
    if (pal) {
      for (const f of pal.decree.factors) for (const v of pal.decree.variants) m.set(`D:${f.code}:${v.key}`.toUpperCase(), `${f.title} — ${v.title}`);
      for (const p of pal.payroll) {
        const vt = new Map(p.variants.map((v) => [v.key, v.title]));
        for (const c of p.classes)
          for (const f of c.factors) for (const v of p.variants) m.set(`C:${f.key}:${v.key}`.toUpperCase(), v.key === "VALUE" ? f.title : `${f.title} — ${vt.get(v.key)}`);
      }
      for (const b of pal.baseInfo) m.set(`B:${b.key}`, b.title);
      for (const s of pal.classTotals) m.set(`S:${s.key}`, s.title);
      for (const p of pal.params) m.set(`P:${p.key}`, p.title);
      for (const p of pal.bases ?? []) m.set(`P:${p.key}`, p.title);
    }
    return m;
  }, [pal]);

  function chipText(tok: string): { text: string; kind: "ref" | "op" | "num" | "fn" } {
    if (tok.startsWith("[")) {
      const raw = tok.slice(1, -1).toUpperCase();
      const parts = raw.split(":");
      // نوع پیش‌فرض VALUE
      const norm = (parts[0] === "D" || parts[0] === "C") && parts.length === 2 ? `${raw}:VALUE` : raw;
      return { text: labelOf.get(norm) ?? labelOf.get(raw) ?? tok, kind: "ref" };
    }
    const u = tok.toUpperCase();
    if (u === "AND") return { text: "و", kind: "op" };
    if (u === "OR") return { text: "یا", kind: "op" };
    if (u === "*") return { text: "×", kind: "op" };
    if (u === "/") return { text: "÷", kind: "op" };
    if (u === ">=") return { text: "≥", kind: "op" };
    if (u === "<=") return { text: "≤", kind: "op" };
    if (u === "<>") return { text: "≠", kind: "op" };
    if (/^\d/.test(tok) || tok.startsWith(".")) return { text: tok, kind: "num" };
    if (/^[A-Z_]+$/.test(u) && !"+-()".includes(tok)) return { text: u === "PROGRESSIVE" ? "مالیات پلکانی" : u, kind: "fn" };
    return { text: tok, kind: "op" };
  }

  const get = (s: Slot): string[] => br[s.b]?.[s.a] ?? [];
  const commit = (s: Slot, v: string[], c: number) => {
    setOk(false);
    setBr((prev) => prev.map((x, i) => (i === s.b ? { ...x, [s.a]: v } : x)));
    const at = Math.max(0, Math.min(c, v.length));
    anchor.current[sk(s)] = at;
    setCaretState((p) => ({ ...p, [sk(s)]: at }));
    setSel(null);
  };
  const focusSlot = (s: Slot) => areaRefs.current[sk(s)]?.focus();
  /** جابه‌جایی مکان‌نما؛ extend=true (Shift) بازه‌ی انتخاب را از لنگر تا نقطه‌ی جدید می‌گیرد */
  const moveCaret = (s: Slot, c: number, extend = false) => {
    const k = sk(s);
    const at = Math.max(0, Math.min(c, get(s).length));
    if (extend) {
      const from = anchor.current[k] ?? 0;
      setSel(from === at ? null : { k, from: Math.min(from, at), to: Math.max(from, at) });
    } else {
      anchor.current[k] = at;
      setSel(null);
    }
    setCaretState((p) => ({ ...p, [k]: at }));
  };
  /** درج در نقطه‌ی مکان‌نما (جایگزین انتخاب)؛ فوکوس در ناحیه می‌ماند تا کاربر بدون کلیک اضافه ادامه دهد */
  const insert = (s: Slot, ins: string[], refocus = true) => {
    const k = sk(s);
    const t = get(s);
    let from = caret[k] ?? t.length;
    let to = from;
    if (sel && sel.k === k) {
      from = sel.from;
      to = sel.to;
    }
    commit(s, [...t.slice(0, from), ...ins, ...t.slice(to)], from + ins.length);
    if (refocus) focusSlot(s);
  };
  const push = (...t: string[]) => insert(active, t);
  const deleteRange = (s: Slot, from: number, to: number) => {
    const t = get(s);
    commit(s, [...t.slice(0, from), ...t.slice(to)], from);
  };

  // ── شاخه‌ها: افزودن / حذف / جابه‌جایی ──
  function restructure(next: Draft[], activeSlot: Slot) {
    setOk(false);
    setBr(next);
    setCaretState(endCarets(next));
    anchor.current = {};
    setSel(null);
    setActive(activeSlot);
    setTimeout(() => focusSlot(activeSlot), 0);
  }
  const addBranch = () => restructure([...br, { cond: [], calc: [] }], { b: br.length, a: "cond" });
  const removeBranch = (i: number) => {
    if (br.length <= 1) return;
    const next = br.filter((_, k) => k !== i);
    restructure(next, { b: Math.min(active.b === i ? i : active.b > i ? active.b - 1 : active.b, next.length - 1), a: active.a });
  };
  const moveBranch = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= br.length) return;
    const next = [...br];
    [next[i], next[j]] = [next[j], next[i]];
    restructure(next, { b: active.b === i ? j : active.b === j ? i : active.b, a: active.a });
  };

  /** کپی/برش: انتخاب، وگرنه کل عبارت */
  function doCopy(s: Slot, cutIt: boolean) {
    const t = get(s);
    const hasSel = sel && sel.k === sk(s);
    const part = hasSel ? t.slice(sel!.from, sel!.to) : t;
    clipRef.current = [...part];
    navigator.clipboard?.writeText(part.join(" ")).catch(() => {});
    if (cutIt) {
      if (hasSel) deleteRange(s, sel!.from, sel!.to);
      else commit(s, [], 0);
    }
  }
  async function paste(s: Slot) {
    let toks = clipRef.current;
    try {
      const t = await navigator.clipboard?.readText();
      if (t && t.trim()) toks = tokenize(t);
    } catch {
      /* clipboard در دسترس نیست؛ از آخرین کپی داخلی استفاده می‌شود */
    }
    if (toks.length) insert(s, toks);
  }

  /** تایپ مستقیم در ناحیه‌ی عبارت (در نقطه‌ی مکان‌نما): ارقام (فارسی یا انگلیسی)، نقطه/«/»/«٫» اعشار، عملگرها، فلش‌ها، Backspace/Delete و میانبرهای Ctrl */
  function typeKey(s: Slot, e: React.KeyboardEvent) {
    const key0 = sk(s);
    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase();
      if (key === "a") {
        e.preventDefault();
        const n = get(s).length;
        anchor.current[key0] = 0;
        setSel(n ? { k: key0, from: 0, to: n } : null);
        setCaretState((p) => ({ ...p, [key0]: n }));
      } else if (key === "c" || key === "x") {
        e.preventDefault();
        doCopy(s, key === "x");
      } else if (key === "v") {
        // رویداد paste مرورگر (بدون نیاز به مجوز) ترجیح دارد؛ اگر نیامد، خواندن مستقیم clipboard
        pasteHandled.current = false;
        setTimeout(() => {
          if (!pasteHandled.current) void paste(s);
        }, 80);
      }
      return;
    }
    if (e.altKey) return;
    const k = normalizeDigits(e.key);
    const t = get(s);
    const c = caret[key0] ?? t.length;
    const hasSel = !!sel && sel.k === key0;
    const before = hasSel ? undefined : t[c - 1];
    const beforeIsNum = before !== undefined && before !== "" && /^\d*\.?\d*$/.test(before);

    if (k === "ArrowLeft" || k === "ArrowRight" || k === "Home" || k === "End") {
      e.preventDefault();
      let target = k === "Home" ? 0 : k === "End" ? t.length : k === "ArrowLeft" ? c - 1 : c + 1;
      if (!e.shiftKey && hasSel) target = k === "ArrowLeft" ? sel!.from : k === "ArrowRight" ? sel!.to : target;
      moveCaret(s, target, e.shiftKey);
    } else if (/^[0-9]$/.test(k)) {
      e.preventDefault();
      if (beforeIsNum) commit(s, [...t.slice(0, c - 1), before + k, ...t.slice(c)], c);
      else insert(s, [k], false);
    } else if (k === "." || (k === "/" && beforeIsNum && !before!.includes("."))) {
      // «/» بعد از عدد = اعشار فارسی؛ بدون عدد قبلی عملگر تقسیم است
      e.preventDefault();
      if (beforeIsNum) {
        if (!before!.includes(".")) commit(s, [...t.slice(0, c - 1), before + ".", ...t.slice(c)], c);
      } else insert(s, ["0."], false);
    } else if (["+", "-", "*", "/", "(", ")", ","].includes(k)) {
      e.preventDefault();
      insert(s, [k], false);
    } else if (s.a === "cond" && [">", "<", "="].includes(k)) {
      e.preventDefault();
      // > یا < بعد از = (یا برعکس) به عملگر دو نویسه‌ای ترکیب می‌شود
      if (k === "=" && (before === ">" || before === "<")) commit(s, [...t.slice(0, c - 1), before + "=", ...t.slice(c)], c);
      else if (k === ">" && before === "<") commit(s, [...t.slice(0, c - 1), "<>", ...t.slice(c)], c);
      else insert(s, [k], false);
    } else if (k === "Backspace") {
      e.preventDefault();
      if (hasSel) deleteRange(s, sel!.from, sel!.to);
      else if (beforeIsNum && before!.length > 1) commit(s, [...t.slice(0, c - 1), before!.slice(0, -1), ...t.slice(c)], c);
      else if (c > 0) deleteRange(s, c - 1, c);
    } else if (k === "Delete") {
      e.preventDefault();
      if (hasSel) deleteRange(s, sel!.from, sel!.to);
      else if (c < t.length) deleteRange(s, c, c + 1);
    }
  }

  const toBranches = (): FormulaBranch[] => br.map((x) => ({ conditionText: x.cond.join(" "), formulaText: x.calc.join(" ") }));

  async function check() {
    setErr(null);
    try {
      const r = await api.post("/payroll-methods/validate", { basis, factorId: Number(factorId) || null, method, branches: toBranches(), basisIds: basisIds ?? [] }, { silent: true } as any);
      if (r.ok) setOk(true);
      else setErr(r.error);
    } catch (e) {
      setErr((e as ApiError).message);
    }
  }

  // ── گریدهای زبانه‌ی عوامل ──
  const payrollCat = pal?.payroll.find((p) => p.method === cat);
  const classes = payrollCat?.classes ?? [];
  const factors = cat === "DECREE" ? (pal?.decree.factors.map((f) => ({ key: f.code, title: f.title })) ?? []) : (classes.find((c) => c.kind === cls)?.factors ?? []);
  const variants = cat === "DECREE" ? (pal?.decree.variants ?? []) : (payrollCat?.variants ?? []);

  const cats: { key: string; title: string }[] = [
    { key: "DECREE", title: "عامل حکم" },
    ...(pal?.payroll.map((p) => ({ key: p.method, title: p.title })) ?? []),
    { key: "BASE", title: "اطلاعات پایه" },
    { key: "TOTALS", title: "جمع طبقه‌ها" },
    ...((pal?.bases?.length ?? 0) > 0 ? [{ key: "BASES", title: "مبناها" }] : []),
  ];

  function addVariant(vkey: string) {
    const f = factors.find((x) => x.key === fac);
    if (!f) return;
    if (cat === "DECREE") push(`[D:${f.key}:${vkey}]`);
    else push(vkey === "VALUE" ? `[C:${f.key}]` : `[C:${f.key}:${vkey}]`);
  }

  const col = (title: string, children: React.ReactNode) => (
    <div style={{ border: "1px solid var(--line)", borderRadius: 6, minHeight: 190, maxHeight: 230, overflowY: "auto" }}>
      <div style={{ padding: "4px 8px", fontSize: 12, opacity: 0.7, borderBottom: "1px solid var(--line)" }}>{title}</div>
      {children}
    </div>
  );
  const item = (label: string, selected: boolean, onClick: () => void) => (
    <div
      key={label}
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()}
      style={{ padding: "5px 10px", cursor: "pointer", background: selected ? "var(--primary-soft, rgba(80,80,200,.15))" : undefined, fontSize: 13 }}
    >
      {label}
    </div>
  );

  const caretEl = (
    <span key="caret" style={{ display: "inline-block", width: 2, height: 20, background: "var(--primary, #4f46e5)", animation: "fbblink 1s steps(1) infinite", alignSelf: "center" }} />
  );
  const chipsArea = (s: Slot, title: string, ops: string[], logic: boolean, placeholder: string) => {
    const k = sk(s);
    const toks = get(s);
    const isActive = active.b === s.b && active.a === s.a;
    const c0 = caret[k] ?? toks.length;
    const noFocusSteal = (e: React.MouseEvent) => e.preventDefault(); // دکمه‌ها فوکوس را از ناحیه نمی‌برند
    return (
      <div style={{ marginBottom: 8 }}>
        <div dir="ltr" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
          <b>{title}</b>
          {ops.map((o) => (
            <button key={o} type="button" className="btn secondary" style={{ padding: "1px 8px" }} onMouseDown={noFocusSteal} onClick={() => { setActive(s); insert(s, [o]); }}>
              {chipText(o).text}
            </button>
          ))}
          {logic && (
            <>
              <button type="button" className="btn secondary" style={{ padding: "1px 8px" }} onMouseDown={noFocusSteal} onClick={() => { setActive(s); insert(s, ["AND"]); }}>و</button>
              <button type="button" className="btn secondary" style={{ padding: "1px 8px" }} onMouseDown={noFocusSteal} onClick={() => { setActive(s); insert(s, ["OR"]); }}>یا</button>
            </>
          )}
          <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button type="button" className="link-btn" title="کپی (انتخاب یا کل عبارت)" onMouseDown={noFocusSteal} onClick={() => doCopy(s, false)}>کپی</button>
            <button type="button" className="link-btn" title="چسباندن در مکان‌نما" onMouseDown={noFocusSteal} onClick={() => { setActive(s); void paste(s); }}>چسباندن</button>
            <button type="button" className="link-btn" title="حذف قبل از مکان‌نما" onMouseDown={noFocusSteal} onClick={() => { setActive(s); if (sel && sel.k === k) deleteRange(s, sel.from, sel.to); else if (c0 > 0) deleteRange(s, c0 - 1, c0); focusSlot(s); }}>⌫</button>
            <button type="button" className="link-btn" title="پاک کردن" onMouseDown={noFocusSteal} onClick={() => { commit(s, [], 0); focusSlot(s); }}>پاک کردن</button>
          </span>
        </div>
        <div
          ref={(el) => { areaRefs.current[k] = el; }}
          onClick={() => {
            // کلیک روی فضای خالی: مکان‌نما انتهای عبارت
            setActive(s);
            moveCaret(s, toks.length);
            focusSlot(s);
          }}
          onFocus={() => setActive(s)}
          tabIndex={0}
          onKeyDown={(e) => typeKey(s, e)}
          onCopy={(e) => {
            e.preventDefault();
            const part = sel && sel.k === k ? toks.slice(sel.from, sel.to) : toks;
            clipRef.current = [...part];
            e.clipboardData.setData("text/plain", part.join(" "));
          }}
          onPaste={(e) => {
            e.preventDefault();
            pasteHandled.current = true;
            const text = e.clipboardData.getData("text");
            const pasted = text && text.trim() ? tokenize(text) : clipRef.current;
            if (pasted.length) insert(s, pasted, false);
          }}
          dir="ltr"
          style={{
            minHeight: 46,
            textAlign: "left",
            border: `2px solid ${isActive ? "var(--primary, #4f46e5)" : "var(--line)"}`,
            borderRadius: 8,
            padding: 6,
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
            alignContent: "flex-start",
            outline: "none",
            cursor: "text",
          }}
        >
          {toks.length === 0 && <span dir="rtl" style={{ opacity: 0.45 }}>{placeholder}</span>}
          {toks.map((t, i) => {
            const c = chipText(t);
            const base =
              c.kind === "ref"
                ? { background: "#3b3f4a", color: "#fff", borderRadius: 14, padding: "2px 10px" }
                : c.kind === "fn"
                ? { background: "#5b21b6", color: "#fff", borderRadius: 14, padding: "2px 10px" }
                : c.kind === "num"
                ? { background: "#0f766e", color: "#fff", borderRadius: 14, padding: "2px 10px" }
                : { padding: "2px 4px", fontWeight: 700 };
            const selected = !!sel && sel.k === k && i >= sel.from && i < sel.to;
            return (
              <Fragment key={i}>
                {isActive && c0 === i ? caretEl : null}
                <span
                  title="کلیک: مکان‌نما قبل/بعد از این مورد — Shift+کلیک: انتخاب بازه — دوبار کلیک: حذف"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActive(s);
                    const r = e.currentTarget.getBoundingClientRect();
                    moveCaret(s, e.clientX < r.left + r.width / 2 ? i : i + 1, e.shiftKey);
                    focusSlot(s);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    deleteRange(s, i, i + 1);
                  }}
                  style={{ ...base, fontSize: 13, direction: c.kind === "ref" || c.kind === "fn" ? "rtl" : "ltr", unicodeBidi: "isolate", cursor: "text", outline: selected ? "2px solid #f59e0b" : undefined, background: selected && c.kind === "op" ? "rgba(245,158,11,.25)" : (base as any).background }}
                >
                  {c.text}
                </span>
              </Fragment>
            );
          })}
          {isActive && c0 >= toks.length ? caretEl : null}
        </div>
      </div>
    );
  };

  const multi = br.length > 1;

  return (
    <Modal title={factorTitle ? `فرمول عامل «${factorTitle}»` : "فرمول"} onClose={onClose} wide>
      <style>{"@keyframes fbblink{50%{opacity:0}}"}</style>
      <ErrorToast message={err} />

      {br.map((_, i) => (
        <div key={i} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 10, marginBottom: 10 }}>
          {multi && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <b>{i === 0 ? "اگر" : !br[i].cond.length ? "در غیر این صورت" : "وگرنه اگر"} — شاخه‌ی {i + 1}</b>
              <span style={{ marginInlineStart: "auto", display: "flex", gap: 8 }}>
                <button type="button" className="link-btn" disabled={i === 0} onClick={() => moveBranch(i, -1)} title="بالاتر">↑</button>
                <button type="button" className="link-btn" disabled={i === br.length - 1} onClick={() => moveBranch(i, 1)} title="پایین‌تر">↓</button>
                <button type="button" className="link-btn" onClick={() => removeBranch(i)} title="حذف این شاخه">حذف شاخه</button>
              </span>
            </div>
          )}
          {chipsArea({ b: i, a: "cond" }, "عبارت شرطی", OPS_COND, true, i === br.length - 1 ? "بدون شرط (در غیر این صورت / همیشه برقرار)" : "شرط این شاخه را بسازید")}
          {chipsArea({ b: i, a: "calc" }, "عبارت محاسباتی", OPS_CALC, false, "عبارت محاسباتی را از پایین بسازید")}
        </div>
      ))}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <button type="button" className="btn secondary" onClick={addBranch}>+ افزودن شرط بعدی</button>
        <span style={{ opacity: 0.65, fontSize: 12 }}>از بالا به پایین اولین شرطِ برقرار اجرا می‌شود؛ شاخه‌ی بدون شرط فقط آخرین شاخه می‌تواند باشد؛ اگر هیچ شرطی برقرار نباشد مقدار عامل صفر است.</span>
      </div>

      <div style={{ display: "flex", gap: 14, borderBottom: "1px solid var(--line)", marginBottom: 8 }}>
        {(
          [
            ["factors", "عوامل"],
            ["functions", "توابع"],
            ["constants", "مقادیر ثابت"],
          ] as const
        ).map(([k, t]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            style={{ background: "none", border: "none", padding: "6px 4px", cursor: "pointer", fontWeight: tab === k ? 700 : 400, borderBottom: tab === k ? "2px solid var(--primary, #4f46e5)" : "2px solid transparent" }}
          >
            {t}
          </button>
        ))}
        <span style={{ marginInlineStart: "auto", opacity: 0.7, fontSize: 12 }}>
          درج در: {multi ? `شاخه‌ی ${active.b + 1} — ` : ""}{active.a === "cond" ? "عبارت شرطی" : "عبارت محاسباتی"}
        </span>
      </div>

      {tab === "factors" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {col("دسته", cats.map((c) => item(c.title, cat === c.key, () => { setCat(c.key); setCls(""); setFac(""); })))}
          {col(
            "طبقه",
            cat === "DECREE" || cat === "BASE" || cat === "TOTALS" || cat === "BASES" || !cat
              ? null
              : classes.map((c) => item(c.title, cls === c.kind, () => { setCls(c.kind); setFac(""); }))
          )}
          {col(
            "عامل",
            cat === "BASE" || cat === "TOTALS" || cat === "BASES" ? null : cat === "DECREE" || cls ? factors.map((f) => item(f.title, fac === f.key, () => setFac(f.key))) : null
          )}
          {col(
            cat === "BASE" ? "اطلاعات پایه" : cat === "TOTALS" ? "جمع طبقه" : cat === "BASES" ? "مبنا (جمع اعضا)" : "مقدار",
            cat === "BASE"
              ? pal?.baseInfo.map((b) => item(b.title, false, () => push(`[B:${b.key}]`)))
              : cat === "BASES"
              ? pal?.bases?.map((b) => item(b.title, false, () => push(`[P:${b.key}]`)))
              : cat === "TOTALS"
              ? pal?.classTotals.map((b) => item(b.title, false, () => push(`[S:${b.key}]`)))
              : fac
              ? variants.map((v) => item(v.title, false, () => addVariant(v.key)))
              : null
          )}
        </div>
      )}

      {tab === "functions" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 6 }}>
          {["MIN", "MAX", "ROUND"].map((f) => (
            <button key={f} type="button" className="btn secondary" onMouseDown={(e) => e.preventDefault()} onClick={() => push(f, "(")}>
              {f === "MIN" ? "کمترین (MIN)" : f === "MAX" ? "بیشترین (MAX)" : "گرد کردن (ROUND)"}
            </button>
          ))}
          {pal?.params.filter((p) => p.type === "BRACKETS").map((p) => (
            <button key={p.key} type="button" className="btn secondary" onMouseDown={(e) => e.preventDefault()} onClick={() => push("PROGRESSIVE", "(", `[P:${p.key}]`, ",")}>
              مالیات پلکانی — {p.title}
            </button>
          ))}
        </div>
      )}

      {tab === "constants" && (
        <div>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <input dir="ltr" inputMode="decimal" placeholder="عدد" value={num} onChange={(e) => setNum(cleanNumber(e.target.value))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (num && !num.endsWith(".")) { insert(active, [num], false); setNum(""); } } }} style={{ maxWidth: 160 }} />
            <button type="button" className="btn secondary" disabled={!num || num === "." || num.endsWith(".")} onMouseDown={(e) => e.preventDefault()} onClick={() => { push(num); setNum(""); }}>افزودن عدد</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 6 }}>
            {pal?.params.filter((p) => p.type !== "BRACKETS").map((p) => (
              <button key={p.key} type="button" className="btn secondary" onMouseDown={(e) => e.preventDefault()} onClick={() => push(`[P:${p.key}]`)} title={p.personnel ? "مقدار اختصاصی هر کارمند؛ برای کارمندی که مقداری ندارد صفر است" : undefined}>
                {p.title}{p.personnel ? " (پرسنلی)" : ""}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="actions" style={{ marginTop: 12 }}>
        <button type="button" className="btn" onClick={() => onSave(toBranches())}>تایید</button>
        <button type="button" className="btn secondary" onClick={check}>بررسی</button>
        <button type="button" className="btn secondary" onClick={onClose}>انصراف</button>
        {ok && <span style={{ color: "#0a8f5a" }}>فرمول معتبر است</span>}
      </div>
    </Modal>
  );
}
