import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "./Modal";
import { ErrorToast } from "./ErrorToast";
import { api, ApiError } from "../lib/api";
import { KIND_FA } from "../lib/payrollLabels";

// پنجره‌ی فرمول‌نویس حقوق: «عبارت شرطی» و «عبارت محاسباتی» به‌صورت چیپ؛ در پایین سه زبانه‌ی عوامل / توابع / مقادیر ثابت.
// زبانه‌ی عوامل چهار گرید دارد: دسته ← طبقه ← عامل ← مقدار (نوع مقدار بر اساس دسته). ذخیره‌ی متن همان زبان فرمول سرور است
// ([D:کد:نوع] [C:کلید:نوع] [P:کلید] [B:کلید] [S:طبقه])؛ کلیدها به کاربر نشان داده نمی‌شوند و چیپ‌ها عنوان فارسی دارند.
// ویرایش مثل یک ویرایشگر متن: مکان‌نما (caret) بین چیپ‌ها با کلیک روی هر چیپ (نیمه‌ی چپ = قبل، نیمه‌ی راست = بعد) جابه‌جا می‌شود و درج از پالت یا تایپ
// همیشه در همان نقطه انجام می‌شود (فوکوس بعد از درج در ناحیه می‌ماند و کلیک اضافه لازم نیست)؛ فلش‌ها/Home/End، Shift برای انتخاب بازه،
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
  classTotals: { key: string; title: string }[];
  params: { key: string; title: string; type: string }[];
}

type Area = "cond" | "calc";

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

export function FormulaBuilder({
  basis,
  factorId,
  factorTitle,
  method,
  conditionText,
  formulaText,
  onClose,
  onSave,
}: {
  basis: "decree" | "payroll";
  factorId: string;
  /** عنوان عاملی که فرمولش تعریف می‌شود؛ در عنوان پنجره نمایش داده می‌شود */
  factorTitle: string;
  method: string;
  conditionText: string;
  formulaText: string;
  onClose: () => void;
  onSave: (condition: string, formula: string) => void;
}) {
  const [pal, setPal] = useState<Palette | null>(null);
  const [cond, setCond] = useState<string[]>(() => tokenize(conditionText));
  const [calc, setCalc] = useState<string[]>(() => tokenize(formulaText));
  const [active, setActive] = useState<Area>("calc");
  // مکان‌نما = شماره‌ی نقطه‌ی درج بین توکن‌ها (۰..تعداد)؛ انتخاب = بازه‌ی [from, to) توکن‌ها
  const [caret, setCaretState] = useState<Record<Area, number>>(() => ({ cond: tokenize(conditionText).length, calc: tokenize(formulaText).length }));
  const [sel, setSel] = useState<{ a: Area; from: number; to: number } | null>(null);
  const anchor = useRef<Record<Area, number>>({ cond: 0, calc: 0 });
  const areaRefs = useRef<Record<Area, HTMLDivElement | null>>({ cond: null, calc: null });
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
      const dv = new Map(pal.decree.variants.map((v) => [v.key, v.title]));
      for (const f of pal.decree.factors) for (const v of pal.decree.variants) m.set(`D:${f.code}:${v.key}`.toUpperCase(), `${f.title} — ${v.title}`);
      for (const p of pal.payroll) {
        const vt = new Map(p.variants.map((v) => [v.key, v.title]));
        for (const c of p.classes)
          for (const f of c.factors) for (const v of p.variants) m.set(`C:${f.key}:${v.key}`.toUpperCase(), v.key === "VALUE" ? f.title : `${f.title} — ${vt.get(v.key)}`);
      }
      void dv;
      for (const b of pal.baseInfo) m.set(`B:${b.key}`, b.title);
      for (const s of pal.classTotals) m.set(`S:${s.key}`, s.title);
      for (const p of pal.params) m.set(`P:${p.key}`, p.title);
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

  const get = (a: Area) => (a === "cond" ? cond : calc);
  const commit = (a: Area, v: string[], c: number) => {
    setOk(false);
    a === "cond" ? setCond(v) : setCalc(v);
    const at = Math.max(0, Math.min(c, v.length));
    anchor.current[a] = at;
    setCaretState((p) => ({ ...p, [a]: at }));
    setSel(null);
  };
  const focusArea = (a: Area) => areaRefs.current[a]?.focus();
  /** جابه‌جایی مکان‌نما؛ extend=true (Shift) بازه‌ی انتخاب را از لنگر تا نقطه‌ی جدید می‌گیرد */
  const moveCaret = (a: Area, c: number, extend = false) => {
    const at = Math.max(0, Math.min(c, get(a).length));
    if (extend) {
      const from = anchor.current[a];
      setSel(from === at ? null : { a, from: Math.min(from, at), to: Math.max(from, at) });
    } else {
      anchor.current[a] = at;
      setSel(null);
    }
    setCaretState((p) => ({ ...p, [a]: at }));
  };
  /** درج در نقطه‌ی مکان‌نما (جایگزین انتخاب)؛ فوکوس در ناحیه می‌ماند تا کاربر بدون کلیک اضافه ادامه دهد */
  const insert = (a: Area, ins: string[], refocus = true) => {
    const t = get(a);
    let from = caret[a];
    let to = from;
    if (sel && sel.a === a) {
      from = sel.from;
      to = sel.to;
    }
    commit(a, [...t.slice(0, from), ...ins, ...t.slice(to)], from + ins.length);
    if (refocus) focusArea(a);
  };
  const push = (...t: string[]) => insert(active, t);
  const deleteRange = (a: Area, from: number, to: number) => {
    const t = get(a);
    commit(a, [...t.slice(0, from), ...t.slice(to)], from);
  };

  /** کپی/برش: انتخاب، وگرنه کل عبارت */
  function doCopy(a: Area, cutIt: boolean) {
    const t = get(a);
    const hasSel = sel && sel.a === a;
    const part = hasSel ? t.slice(sel!.from, sel!.to) : t;
    clipRef.current = [...part];
    navigator.clipboard?.writeText(part.join(" ")).catch(() => {});
    if (cutIt) {
      if (hasSel) deleteRange(a, sel!.from, sel!.to);
      else commit(a, [], 0);
    }
  }
  async function paste(a: Area) {
    let toks = clipRef.current;
    try {
      const t = await navigator.clipboard?.readText();
      if (t && t.trim()) toks = tokenize(t);
    } catch {
      /* clipboard در دسترس نیست؛ از آخرین کپی داخلی استفاده می‌شود */
    }
    if (toks.length) insert(a, toks);
  }

  /** تایپ مستقیم در ناحیه‌ی عبارت (در نقطه‌ی مکان‌نما): ارقام (فارسی یا انگلیسی)، نقطه/«/»/«٫» اعشار، عملگرها، فلش‌ها، Backspace/Delete و میانبرهای Ctrl */
  function typeKey(a: Area, e: React.KeyboardEvent) {
    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase();
      if (key === "a") {
        e.preventDefault();
        const n = get(a).length;
        anchor.current[a] = 0;
        setSel(n ? { a, from: 0, to: n } : null);
        setCaretState((p) => ({ ...p, [a]: n }));
      } else if (key === "c" || key === "x") {
        e.preventDefault();
        doCopy(a, key === "x");
      } else if (key === "v") {
        // رویداد paste مرورگر (بدون نیاز به مجوز) ترجیح دارد؛ اگر نیامد، خواندن مستقیم clipboard
        pasteHandled.current = false;
        setTimeout(() => {
          if (!pasteHandled.current) void paste(a);
        }, 80);
      }
      return;
    }
    if (e.altKey) return;
    const k = normalizeDigits(e.key);
    const t = get(a);
    const c = caret[a];
    const hasSel = !!sel && sel.a === a;
    const before = hasSel ? undefined : t[c - 1];
    const beforeIsNum = before !== undefined && before !== "" && /^\d*\.?\d*$/.test(before);

    if (k === "ArrowLeft" || k === "ArrowRight" || k === "Home" || k === "End") {
      e.preventDefault();
      let target = k === "Home" ? 0 : k === "End" ? t.length : k === "ArrowLeft" ? c - 1 : c + 1;
      if (!e.shiftKey && hasSel) target = k === "ArrowLeft" ? sel!.from : k === "ArrowRight" ? sel!.to : target;
      moveCaret(a, target, e.shiftKey);
    } else if (/^[0-9]$/.test(k)) {
      e.preventDefault();
      if (beforeIsNum) commit(a, [...t.slice(0, c - 1), before + k, ...t.slice(c)], c);
      else insert(a, [k], false);
    } else if (k === "." || (k === "/" && beforeIsNum && !before!.includes("."))) {
      // «/» بعد از عدد = اعشار فارسی؛ بدون عدد قبلی عملگر تقسیم است
      e.preventDefault();
      if (beforeIsNum) {
        if (!before!.includes(".")) commit(a, [...t.slice(0, c - 1), before + ".", ...t.slice(c)], c);
      } else insert(a, ["0."], false);
    } else if (["+", "-", "*", "/", "(", ")", ","].includes(k)) {
      e.preventDefault();
      insert(a, [k], false);
    } else if (a === "cond" && [">", "<", "="].includes(k)) {
      e.preventDefault();
      // > یا < بعد از = (یا برعکس) به عملگر دو نویسه‌ای ترکیب می‌شود
      if (k === "=" && (before === ">" || before === "<")) commit(a, [...t.slice(0, c - 1), before + "=", ...t.slice(c)], c);
      else if (k === ">" && before === "<") commit(a, [...t.slice(0, c - 1), "<>", ...t.slice(c)], c);
      else insert(a, [k], false);
    } else if (k === "Backspace") {
      e.preventDefault();
      if (hasSel) deleteRange(a, sel!.from, sel!.to);
      else if (beforeIsNum && before!.length > 1) commit(a, [...t.slice(0, c - 1), before!.slice(0, -1), ...t.slice(c)], c);
      else if (c > 0) deleteRange(a, c - 1, c);
    } else if (k === "Delete") {
      e.preventDefault();
      if (hasSel) deleteRange(a, sel!.from, sel!.to);
      else if (c < t.length) deleteRange(a, c, c + 1);
    }
  }

  async function check() {
    setErr(null);
    try {
      const r = await api.post("/payroll-methods/validate", { basis, factorId: Number(factorId) || null, method, conditionText: cond.join(" "), formulaText: calc.join(" ") }, { silent: true } as any);
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
  const chipsArea = (a: Area, title: string, ops: string[], logic: boolean) => {
    const toks = get(a);
    const showCaret = active === a;
    const noFocusSteal = (e: React.MouseEvent) => e.preventDefault(); // دکمه‌ها فوکوس را از ناحیه نمی‌برند
    return (
      <div style={{ marginBottom: 10 }}>
        <div dir="ltr" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
          <b>{title}</b>
          {ops.map((o) => (
            <button key={o} type="button" className="btn secondary" style={{ padding: "1px 8px" }} onMouseDown={noFocusSteal} onClick={() => { setActive(a); insert(a, [o]); }}>
              {chipText(o).text}
            </button>
          ))}
          {logic && (
            <>
              <button type="button" className="btn secondary" style={{ padding: "1px 8px" }} onMouseDown={noFocusSteal} onClick={() => { setActive(a); insert(a, ["AND"]); }}>و</button>
              <button type="button" className="btn secondary" style={{ padding: "1px 8px" }} onMouseDown={noFocusSteal} onClick={() => { setActive(a); insert(a, ["OR"]); }}>یا</button>
            </>
          )}
          <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button type="button" className="link-btn" title="کپی (انتخاب یا کل عبارت)" onMouseDown={noFocusSteal} onClick={() => doCopy(a, false)}>کپی</button>
            <button type="button" className="link-btn" title="چسباندن در مکان‌نما" onMouseDown={noFocusSteal} onClick={() => { setActive(a); void paste(a); }}>چسباندن</button>
            <button type="button" className="link-btn" title="حذف قبل از مکان‌نما" onMouseDown={noFocusSteal} onClick={() => { setActive(a); if (sel && sel.a === a) deleteRange(a, sel.from, sel.to); else if (caret[a] > 0) deleteRange(a, caret[a] - 1, caret[a]); focusArea(a); }}>⌫</button>
            <button type="button" className="link-btn" title="پاک کردن" onMouseDown={noFocusSteal} onClick={() => { commit(a, [], 0); focusArea(a); }}>پاک کردن</button>
          </span>
        </div>
        <div
          ref={(el) => { areaRefs.current[a] = el; }}
          onClick={() => {
            // کلیک روی فضای خالی: مکان‌نما انتهای عبارت
            setActive(a);
            moveCaret(a, toks.length);
            focusArea(a);
          }}
          onFocus={() => setActive(a)}
          tabIndex={0}
          onKeyDown={(e) => typeKey(a, e)}
          onCopy={(e) => {
            e.preventDefault();
            const part = sel && sel.a === a ? toks.slice(sel.from, sel.to) : toks;
            clipRef.current = [...part];
            e.clipboardData.setData("text/plain", part.join(" "));
          }}
          onPaste={(e) => {
            e.preventDefault();
            pasteHandled.current = true;
            const text = e.clipboardData.getData("text");
            const pasted = text && text.trim() ? tokenize(text) : clipRef.current;
            if (pasted.length) insert(a, pasted, false);
          }}
          dir="ltr"
          style={{
            minHeight: 62,
            textAlign: "left",
            border: `2px solid ${active === a ? "var(--primary, #4f46e5)" : "var(--line)"}`,
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
          {toks.length === 0 && <span dir="rtl" style={{ opacity: 0.45 }}>{a === "cond" ? "بدون شرط (همیشه برقرار)" : "عبارت محاسباتی را از پایین بسازید"}</span>}
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
            const selected = !!sel && sel.a === a && i >= sel.from && i < sel.to;
            return (
              <Fragment key={i}>
              {showCaret && caret[a] === i ? caretEl : null}
              <span
                title="کلیک: مکان‌نما قبل/بعد از این مورد — Shift+کلیک: انتخاب بازه — دوبار کلیک: حذف"
                onClick={(e) => {
                  e.stopPropagation();
                  setActive(a);
                  const r = e.currentTarget.getBoundingClientRect();
                  moveCaret(a, e.clientX < r.left + r.width / 2 ? i : i + 1, e.shiftKey);
                  focusArea(a);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  deleteRange(a, i, i + 1);
                }}
                style={{ ...base, fontSize: 13, direction: c.kind === "ref" || c.kind === "fn" ? "rtl" : "ltr", unicodeBidi: "isolate", cursor: "text", outline: selected ? "2px solid #f59e0b" : undefined, background: selected && c.kind === "op" ? "rgba(245,158,11,.25)" : (base as any).background }}
              >
                {c.text}
              </span>
              </Fragment>
            );
          })}
          {showCaret && caret[a] >= toks.length ? caretEl : null}
        </div>
      </div>
    );
  };

  return (
    <Modal title={factorTitle ? `فرمول عامل «${factorTitle}»` : "فرمول"} onClose={onClose} wide>
      <style>{"@keyframes fbblink{50%{opacity:0}}"}</style>
      <ErrorToast message={err} />
      {chipsArea("cond", "عبارت شرطی", OPS_COND, true)}
      {chipsArea("calc", "عبارت محاسباتی", OPS_CALC, false)}

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
        <span style={{ marginInlineStart: "auto", opacity: 0.7, fontSize: 12 }}>درج در: {active === "cond" ? "عبارت شرطی" : "عبارت محاسباتی"}</span>
      </div>

      {tab === "factors" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {col("دسته", cats.map((c) => item(c.title, cat === c.key, () => { setCat(c.key); setCls(""); setFac(""); })))}
          {col(
            "طبقه",
            cat === "DECREE" || cat === "BASE" || cat === "TOTALS" || !cat
              ? null
              : classes.map((c) => item(c.title, cls === c.kind, () => { setCls(c.kind); setFac(""); }))
          )}
          {col(
            "عامل",
            cat === "BASE" || cat === "TOTALS" ? null : cat === "DECREE" || cls ? factors.map((f) => item(f.title, fac === f.key, () => setFac(f.key))) : null
          )}
          {col(
            cat === "BASE" ? "اطلاعات پایه" : cat === "TOTALS" ? "جمع طبقه" : "مقدار",
            cat === "BASE"
              ? pal?.baseInfo.map((b) => item(b.title, false, () => push(`[B:${b.key}]`)))
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
              <button key={p.key} type="button" className="btn secondary" onMouseDown={(e) => e.preventDefault()} onClick={() => push(`[P:${p.key}]`)}>
                {p.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="actions" style={{ marginTop: 12 }}>
        <button type="button" className="btn" onClick={() => onSave(cond.join(" "), calc.join(" "))}>تایید</button>
        <button type="button" className="btn secondary" onClick={check}>بررسی</button>
        <button type="button" className="btn secondary" onClick={onClose}>انصراف</button>
        {ok && <span style={{ color: "#0a8f5a" }}>فرمول معتبر است</span>}
      </div>
    </Modal>
  );
}
