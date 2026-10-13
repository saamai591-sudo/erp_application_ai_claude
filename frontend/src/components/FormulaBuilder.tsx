import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "./Modal";
import { ErrorToast } from "./ErrorToast";
import { api, ApiError } from "../lib/api";
import { KIND_FA } from "../lib/payrollLabels";

// پنجره‌ی فرمول‌نویس حقوق: «عبارت شرطی» و «عبارت محاسباتی» به‌صورت چیپ؛ در پایین سه زبانه‌ی عوامل / توابع / مقادیر ثابت.
// زبانه‌ی عوامل چهار گرید دارد: دسته ← طبقه ← عامل ← مقدار (نوع مقدار بر اساس دسته). ذخیره‌ی متن همان زبان فرمول سرور است
// ([D:کد:نوع] [C:کلید:نوع] [P:کلید] [B:کلید] [S:طبقه])؛ کلیدها به کاربر نشان داده نمی‌شوند و چیپ‌ها عنوان فارسی دارند.

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
  method,
  conditionText,
  formulaText,
  onClose,
  onSave,
}: {
  basis: "decree" | "payroll";
  factorId: string;
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
  const [tab, setTab] = useState<"factors" | "functions" | "constants">("factors");
  const [cat, setCat] = useState<string>("");
  const [cls, setCls] = useState<string>("");
  const [fac, setFac] = useState<string>("");
  const [num, setNum] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const clipRef = useRef<string[]>([]);

  useEffect(() => {
    api.get("/payroll-methods/palette").then(setPal).catch((e) => setErr(e.message));
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
  const set = (a: Area, v: string[]) => {
    setOk(false);
    a === "cond" ? setCond(v) : setCalc(v);
  };
  const push = (...t: string[]) => set(active, [...get(active), ...t]);

  /** تایپ مستقیم در ناحیه‌ی عبارت: ارقام (فارسی یا انگلیسی)، نقطه/«/»/«٫» به‌عنوان اعشار، عملگرها و Backspace */
  function typeKey(a: Area, e: React.KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = normalizeDigits(e.key);
    const toks = get(a);
    const last = toks[toks.length - 1];
    const lastIsNum = last !== undefined && /^\d*\.?\d*$/.test(last) && last !== "";
    if (/^[0-9]$/.test(k)) {
      e.preventDefault();
      set(a, lastIsNum ? [...toks.slice(0, -1), last + k] : [...toks, k]);
    } else if (k === "." || k === "/" && lastIsNum && !last.includes(".")) {
      // «/» بعد از عدد = اعشار فارسی؛ بدون عدد قبلی عملگر تقسیم است
      e.preventDefault();
      if (lastIsNum) {
        if (!last.includes(".")) set(a, [...toks.slice(0, -1), last + "."]);
      } else set(a, [...toks, "0."]);
    } else if (["+", "-", "*", "/", "(", ")", ","].includes(k)) {
      e.preventDefault();
      set(a, [...toks, k]);
    } else if (a === "cond" && [">", "<", "="].includes(k)) {
      e.preventDefault();
      // > یا < بعد از = (یا برعکس) به عملگر دو نویسه‌ای ترکیب می‌شود
      if (k === "=" && (last === ">" || last === "<")) set(a, [...toks.slice(0, -1), last + "="]);
      else if (k === ">" && last === "<") set(a, [...toks.slice(0, -1), "<>"]);
      else set(a, [...toks, k]);
    } else if (k === "Backspace") {
      e.preventDefault();
      if (lastIsNum && last.length > 1) set(a, [...toks.slice(0, -1), last.slice(0, -1)]);
      else set(a, toks.slice(0, -1));
    }
  }

  function copy(a: Area) {
    clipRef.current = [...get(a)];
    navigator.clipboard?.writeText(get(a).join(" ")).catch(() => {});
  }
  async function paste(a: Area) {
    let toks = clipRef.current;
    try {
      const t = await navigator.clipboard?.readText();
      if (t && t.trim()) toks = tokenize(t);
    } catch {
      /* clipboard در دسترس نیست؛ از آخرین کپی داخلی استفاده می‌شود */
    }
    if (toks.length) set(a, [...get(a), ...toks]);
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
      style={{ padding: "5px 10px", cursor: "pointer", background: selected ? "var(--primary-soft, rgba(80,80,200,.15))" : undefined, fontSize: 13 }}
    >
      {label}
    </div>
  );

  const chipsArea = (a: Area, title: string, ops: string[], logic: boolean) => (
    <div style={{ marginBottom: 10 }}>
      <div dir="ltr" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
        <b>{title}</b>
        {ops.map((o) => (
          <button key={o} type="button" className="btn secondary" style={{ padding: "1px 8px" }} onClick={() => { setActive(a); set(a, [...get(a), o]); }}>
            {chipText(o).text}
          </button>
        ))}
        {logic && (
          <>
            <button type="button" className="btn secondary" style={{ padding: "1px 8px" }} onClick={() => { setActive(a); set(a, [...get(a), "AND"]); }}>و</button>
            <button type="button" className="btn secondary" style={{ padding: "1px 8px" }} onClick={() => { setActive(a); set(a, [...get(a), "OR"]); }}>یا</button>
          </>
        )}
        <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button type="button" className="link-btn" title="کپی" onClick={() => copy(a)}>کپی</button>
          <button type="button" className="link-btn" title="چسباندن" onClick={() => paste(a)}>چسباندن</button>
          <button type="button" className="link-btn" title="حذف آخرین" onClick={() => set(a, get(a).slice(0, -1))}>⌫</button>
          <button type="button" className="link-btn" title="پاک کردن" onClick={() => set(a, [])}>پاک کردن</button>
        </span>
      </div>
      <div
        onClick={() => setActive(a)}
        onFocus={() => setActive(a)}
        tabIndex={0}
        onKeyDown={(e) => typeKey(a, e)}
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
        }}
      >
        {get(a).length === 0 && <span dir="rtl" style={{ opacity: 0.45 }}>{a === "cond" ? "بدون شرط (همیشه برقرار)" : "عبارت محاسباتی را از پایین بسازید"}</span>}
        {get(a).map((t, i) => {
          const c = chipText(t);
          const style =
            c.kind === "ref"
              ? { background: "#3b3f4a", color: "#fff", borderRadius: 14, padding: "2px 10px" }
              : c.kind === "fn"
              ? { background: "#5b21b6", color: "#fff", borderRadius: 14, padding: "2px 10px" }
              : c.kind === "num"
              ? { background: "#0f766e", color: "#fff", borderRadius: 14, padding: "2px 10px" }
              : { padding: "2px 4px", fontWeight: 700 };
          return (
            <span key={i} title="حذف با دوبار کلیک" onDoubleClick={() => set(a, get(a).filter((_, k) => k !== i))} style={{ ...style, fontSize: 13, direction: c.kind === "ref" || c.kind === "fn" ? "rtl" : "ltr", unicodeBidi: "isolate" }}>
              {c.text}
            </span>
          );
        })}
      </div>
    </div>
  );

  return (
    <Modal title="فرمول" onClose={onClose} wide>
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
            <button key={f} type="button" className="btn secondary" onClick={() => push(f, "(")}>
              {f === "MIN" ? "کمترین (MIN)" : f === "MAX" ? "بیشترین (MAX)" : "گرد کردن (ROUND)"}
            </button>
          ))}
          {pal?.params.filter((p) => p.type === "BRACKETS").map((p) => (
            <button key={p.key} type="button" className="btn secondary" onClick={() => push("PROGRESSIVE", "(", `[P:${p.key}]`, ",")}>
              مالیات پلکانی — {p.title}
            </button>
          ))}
        </div>
      )}

      {tab === "constants" && (
        <div>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <input dir="ltr" inputMode="decimal" placeholder="عدد" value={num} onChange={(e) => setNum(cleanNumber(e.target.value))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (num && !num.endsWith(".")) { push(num); setNum(""); } } }} style={{ maxWidth: 160 }} />
            <button type="button" className="btn secondary" disabled={!num || num === "." || num.endsWith(".")} onClick={() => { push(num); setNum(""); }}>افزودن عدد</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 6 }}>
            {pal?.params.filter((p) => p.type !== "BRACKETS").map((p) => (
              <button key={p.key} type="button" className="btn secondary" onClick={() => push(`[P:${p.key}]`)}>
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
