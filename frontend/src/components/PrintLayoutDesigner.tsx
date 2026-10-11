import { useEffect, useMemo, useRef, useState } from "react";

// ویرایشگر بصری قالب چاپ (کشیدن و رها کردن): صفحه از چهار «باند» ساخته می‌شود — سربرگ، جدول اقلام، بعد از جدول، پایین صفحه؛
// بلوک‌ها (متن، کادر، خط، لوگو/مهر، جمع‌ها، حساب‌های بانکی) داخل باندها آزادانه جابه‌جا و هم‌اندازه می‌شوند. مختصات میلی‌متر و نسبت به
// گوشه‌ی بالا-چپِ باند است (مثل backend/src/services/printLayout.ts که همین چیدمان را به HTML تبدیل می‌کند). «پیش‌نمایش» فرم، چاپ واقعی را نشان می‌دهد؛
// این بوم فقط چیدمان است و به‌جای مقدار فیلدها عنوان آن‌ها را نشان می‌دهد.

export type BlockType = "text" | "image" | "box" | "line" | "totals" | "banks";
export type Band = "header" | "after" | "footer";

export interface LayoutBlock {
  id: string;
  type: BlockType;
  band: Band;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  image: "logo" | "stamp";
  rows: { label: string; path: string }[];
  fontPt: number;
  bold: boolean;
  align: "right" | "center" | "left";
  color: string;
  bg: string;
  borderW: number;
  borderColor: string;
  showIf: string;
}

export interface LayoutTable {
  x: number;
  w: number;
  fontPt: number;
  accent: string;
  sectionTitle: string;
  sumRow: boolean;
  inWords: boolean;
  stripe: boolean;
  columns: { key: string; title: string; widthPct: number; visible: boolean }[];
}

export interface VisualLayout {
  version: 1;
  bands: { header: number; after: number; footer: number };
  table: LayoutTable;
  blocks: LayoutBlock[];
}

export interface FieldDoc {
  path: string;
  title: string;
  group: string;
  list?: boolean;
}

const BAND_FA: Record<Band, string> = { header: "سربرگ (بالای جدول)", after: "بعد از جدول", footer: "پایین صفحه" };
const TYPE_FA: Record<BlockType, string> = { text: "متن", image: "تصویر", box: "کادر", line: "خط", totals: "جمع‌ها", banks: "حساب‌های بانکی" };
const TABLE_PREVIEW_MM = 44;
const PT_MM = 0.3528;
const TOKEN = /\{\{\s*([A-Za-z_]\w*(?:\.\w+)+)\s*\}\}/g;
const SKIP_GROUPS = new Set(["ردیف‌ها", "طراحی"]);

type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
const HANDLES: { h: Handle; style: React.CSSProperties; cursor: string }[] = [
  { h: "nw", style: { left: -4, top: -4 }, cursor: "nwse-resize" },
  { h: "n", style: { left: "50%", top: -4, marginLeft: -4 }, cursor: "ns-resize" },
  { h: "ne", style: { right: -4, top: -4 }, cursor: "nesw-resize" },
  { h: "w", style: { left: -4, top: "50%", marginTop: -4 }, cursor: "ew-resize" },
  { h: "e", style: { right: -4, top: "50%", marginTop: -4 }, cursor: "ew-resize" },
  { h: "sw", style: { left: -4, bottom: -4 }, cursor: "nesw-resize" },
  { h: "s", style: { left: "50%", bottom: -4, marginLeft: -4 }, cursor: "ns-resize" },
  { h: "se", style: { right: -4, bottom: -4 }, cursor: "nwse-resize" },
];

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const newId = () => `n${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

function blankBlock(type: BlockType, band: Band): LayoutBlock {
  const base: LayoutBlock = {
    id: newId(),
    type,
    band,
    x: 4,
    y: 3,
    w: 60,
    h: 7,
    text: "",
    image: "logo",
    rows: [],
    fontPt: 0,
    bold: false,
    align: "right",
    color: "#111111",
    bg: "",
    borderW: 0,
    borderColor: "#666666",
    showIf: "",
  };
  if (type === "text") return { ...base, text: "متن" };
  if (type === "box") return { ...base, h: 20, borderW: 0.2, text: "" };
  if (type === "line") return { ...base, w: 80, h: 0, borderW: 0.3, borderColor: "#333333" };
  if (type === "image") return { ...base, w: 30, h: 15 };
  if (type === "banks") return { ...base, w: 120, h: 24 };
  return { ...base, w: 70, h: 24 };
}

interface Props {
  layout: VisualLayout;
  onChange: (l: VisualLayout) => void;
  fields: FieldDoc[];
  textKeys: { key: string; title: string }[];
  contentW: number;
  contentH: number;
}

export function PrintLayoutDesigner({ layout, onChange, fields, textKeys, contentW, contentH }: Props) {
  const [selected, setSelected] = useState<string | null>(null); // شناسه‌ی بلوک، "table"، یا null
  const [zoom, setZoom] = useState<number | null>(null);
  const [snap, setSnap] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [fit, setFit] = useState(3.2);
  const [, force] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const history = useRef<{ past: VisualLayout[]; future: VisualLayout[]; key: string; at: number }>({ past: [], future: [], key: "", at: 0 });

  const s = zoom ?? fit; // پیکسل بر میلی‌متر

  // عنوان فیلدها برای نمایش {{مسیر}} روی بوم
  const titles = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of fields) m.set(f.path, f.title);
    for (const t of textKeys) m.set(`t.${t.key}`, t.title);
    return m;
  }, [fields, textKeys]);
  const insertable = useMemo(
    () => fields.filter((f) => !f.list && !SKIP_GROUPS.has(f.group) && !/^company\.(logo|stamp)$/.test(f.path)),
    [fields]
  );
  const groups = useMemo(() => Array.from(new Set(insertable.map((f) => f.group))), [insertable]);
  const totalFields = useMemo(() => fields.filter((f) => f.group === "جمع‌ها" && f.path !== "totals.netInWords"), [fields]);

  // تطبیق خودکار با عرض ناحیه‌ی بوم
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const measure = () => setFit(clamp((el.clientWidth - 32) / contentW, 1.4, 4.2));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [contentW]);

  // ── تاریخچه (واگرد/ازنو) ──
  function pushHistory(key = "", coalesceMs = 0) {
    const h = history.current;
    const now = Date.now();
    if (key && key === h.key && now - h.at < coalesceMs) {
      h.at = now;
      return;
    }
    h.past.push(layoutRef.current);
    if (h.past.length > 80) h.past.shift();
    h.future = [];
    h.key = key;
    h.at = now;
  }
  function undo() {
    const h = history.current;
    const prev = h.past.pop();
    if (!prev) return;
    h.future.push(layoutRef.current);
    h.key = "";
    onChange(prev);
    force((n) => n + 1);
  }
  function redo() {
    const h = history.current;
    const next = h.future.pop();
    if (!next) return;
    h.past.push(layoutRef.current);
    h.key = "";
    onChange(next);
    force((n) => n + 1);
  }

  /** تغییر با ثبت در تاریخچه؛ key+coalesceMs: ویرایش‌های پشت‌سرهم یک فیلد یک گام واگرد می‌شوند */
  function commit(next: VisualLayout, key = "", coalesceMs = 0) {
    pushHistory(key, coalesceMs);
    onChange(next);
  }
  function patchBlock(id: string, patch: Partial<LayoutBlock>, key = "") {
    const cur = layoutRef.current;
    commit({ ...cur, blocks: cur.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) }, key ? `${id}:${key}` : "", 900);
  }
  function patchTable(patch: Partial<LayoutTable>, key = "") {
    const cur = layoutRef.current;
    commit({ ...cur, table: { ...cur.table, ...patch } }, key ? `table:${key}` : "", 900);
  }
  function setBandHeight(band: Band, h: number, live = false) {
    const cur = layoutRef.current;
    const next = { ...cur, bands: { ...cur.bands, [band]: clamp(round1(h), 2, Math.max(10, contentH - 20)) } };
    if (live) onChange(next);
    else commit(next, `band:${band}`, 900);
  }

  // ── هندسه‌ی باندها روی بوم ──
  const offsets = useMemo(() => {
    const header = 0;
    const table = layout.bands.header;
    const after = table + TABLE_PREVIEW_MM;
    const footer = after + layout.bands.after;
    return { header, table, after, footer, total: footer + layout.bands.footer };
  }, [layout.bands]);

  const snapV = (v: number) => (snap > 0 ? Math.round(v / snap) * snap : v);

  function startPointer(e: React.PointerEvent, id: string, mode: "move" | Handle) {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    wrapRef.current?.focus();
    setSelected(id);
    const start = layoutRef.current;
    const orig = start.blocks.find((b) => b.id === id);
    if (!orig) return;
    const sx = e.clientX;
    const sy = e.clientY;
    const absY0 = offsets[orig.band] + orig.y;
    let moved = false;

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / s;
      const dy = (ev.clientY - sy) / s;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 0.3) return;
      if (!moved) {
        moved = true;
        pushHistory();
      }
      let { x, w, h } = orig;
      let absY = absY0;
      if (mode === "move") {
        x = snapV(orig.x + dx);
        absY = snapV(absY0 + dy);
      } else {
        if (mode.includes("e")) w = snapV(orig.w + dx);
        if (mode.includes("w")) {
          const nx = snapV(orig.x + dx);
          w = orig.x + orig.w - nx;
          x = nx;
        }
        if (mode.includes("s")) h = snapV(orig.h + dy);
        if (mode.includes("n")) {
          const ny = snapV(absY0 + dy);
          h = absY0 + orig.h - ny;
          absY = ny;
        }
        w = Math.max(orig.type === "line" && orig.w === 0 ? 0 : 2, w);
        h = Math.max(orig.type === "line" && orig.h === 0 ? 0 : 2, h);
      }
      x = clamp(x, 0, Math.max(0, contentW - w));
      // باند هدف: از روی مرکز بلوک
      let band: Band = orig.band;
      if (mode === "move") {
        const c = absY + h / 2;
        if (c < offsets.table) band = "header";
        else if (c >= offsets.after) band = c < offsets.footer ? "after" : "footer";
      }
      const bandH = layoutRef.current.bands[band];
      const y = clamp(round1(absY - offsets[band]), 0, Math.max(0, bandH - h));
      const cur = layoutRef.current;
      onChange({ ...cur, blocks: cur.blocks.map((b) => (b.id === id ? { ...b, x: round1(x), y, w: round1(w), h: round1(h), band } : b)) });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function startBandResize(e: React.PointerEvent, band: Band) {
    e.stopPropagation();
    e.preventDefault();
    const sy = e.clientY;
    const h0 = layoutRef.current.bands[band];
    pushHistory();
    const onMove = (ev: PointerEvent) => setBandHeight(band, snapV(h0 + (ev.clientY - sy) / s), true);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // ── افزودن/حذف/کپی ──
  function addBlock(type: BlockType, over: Partial<LayoutBlock> = {}) {
    const cur = layoutRef.current;
    const sel = cur.blocks.find((b) => b.id === selected);
    const band: Band = over.band ?? sel?.band ?? "header";
    const b: LayoutBlock = { ...blankBlock(type, band), ...over, band };
    if (type === "totals" && b.rows.length === 0) {
      b.rows = totalFields.slice(0, 5).map((f) => ({ label: f.title.replace(/^جمع\s*/, "جمع ") , path: f.path }));
      b.h = Math.max(12, b.rows.length * 6);
    }
    b.x = clamp(b.x, 0, Math.max(0, contentW - b.w));
    b.y = clamp(b.y, 0, Math.max(0, cur.bands[band] - b.h));
    commit({ ...cur, blocks: [...cur.blocks, b] });
    setSelected(b.id);
  }
  function addField(f: FieldDoc | { path: string; title: string }) {
    addBlock("text", { text: `${f.title}: {{${f.path}}}`, w: 70 });
  }
  function removeSelected() {
    if (!selected || selected === "table") return;
    const cur = layoutRef.current;
    commit({ ...cur, blocks: cur.blocks.filter((b) => b.id !== selected) });
    setSelected(null);
  }
  function duplicateSelected() {
    const cur = layoutRef.current;
    const b = cur.blocks.find((x) => x.id === selected);
    if (!b) return;
    const copy: LayoutBlock = { ...b, id: newId(), x: clamp(b.x + 3, 0, Math.max(0, contentW - b.w)), y: clamp(b.y + 3, 0, Math.max(0, cur.bands[b.band] - b.h)), rows: b.rows.map((r) => ({ ...r })) };
    commit({ ...cur, blocks: [...cur.blocks, copy] });
    setSelected(copy.id);
  }
  function bringTo(front: boolean) {
    const cur = layoutRef.current;
    const b = cur.blocks.find((x) => x.id === selected);
    if (!b) return;
    const rest = cur.blocks.filter((x) => x.id !== b.id);
    commit({ ...cur, blocks: front ? [...rest, b] : [b, ...rest] });
  }

  // ── صفحه‌کلید ──
  function onKeyDown(e: React.KeyboardEvent) {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
      if (e.key === "Enter" && tag === "INPUT") e.preventDefault(); // نفرستادن فرم قالب
      return;
    }
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    if (mod && e.key.toLowerCase() === "y") {
      e.preventDefault();
      redo();
      return;
    }
    if (mod && e.key.toLowerCase() === "d") {
      e.preventDefault();
      duplicateSelected();
      return;
    }
    if (!selected || selected === "table") return;
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      removeSelected();
      return;
    }
    const step = e.shiftKey ? 5 : snap > 0 ? snap : 1;
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const d = arrows[e.key];
    if (d) {
      e.preventDefault();
      const b = layoutRef.current.blocks.find((x) => x.id === selected);
      if (!b) return;
      patchBlock(b.id, {
        x: clamp(round1(b.x + d[0]), 0, Math.max(0, contentW - b.w)),
        y: clamp(round1(b.y + d[1]), 0, Math.max(0, layoutRef.current.bands[b.band] - b.h)),
      }, "arrow");
    }
  }

  const sel = layout.blocks.find((b) => b.id === selected) ?? null;

  function insertToken(path: string) {
    if (!sel) return;
    const el = textRef.current;
    const token = `{{${path}}}`;
    const start = el?.selectionStart ?? sel.text.length;
    const end = el?.selectionEnd ?? start;
    patchBlock(sel.id, { text: sel.text.slice(0, start) + token + sel.text.slice(end) });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  function tokenPreview(text: string) {
    return text.replace(TOKEN, (_m, p: string) => `‹${titles.get(p) ?? p}›`);
  }

  // ── رندر بلوک روی بوم ──
  function blockView(b: LayoutBlock) {
    const fs = (b.fontPt || layout.table.fontPt) * PT_MM * s;
    const style: React.CSSProperties = {
      position: "absolute",
      left: b.x * s,
      top: b.y * s,
      width: b.w * s,
      height: b.type === "line" ? Math.max(1, b.h * s) : b.h * s,
      boxSizing: "border-box",
      fontSize: fs,
      fontWeight: b.bold ? 700 : 400,
      textAlign: b.align,
      color: b.color,
      background: b.bg || undefined,
      cursor: "move",
      overflow: "hidden",
      lineHeight: 1.45,
      userSelect: "none",
      outline: selected === b.id ? "2px solid #2563eb" : "1px dashed rgba(100,116,139,0.55)",
      outlineOffset: selected === b.id ? 0 : -1,
      opacity: b.showIf ? 0.8 : 1,
    };
    if (b.type === "line") {
      const t = Math.max(1, (b.borderW || 0.3) * s);
      if (b.h === 0 || b.w > 0) {
        style.borderTop = `${t}px solid ${b.borderColor}`;
        style.height = Math.max(6, t + 4);
        style.outline = selected === b.id ? "2px solid #2563eb" : "none";
      } else {
        style.borderLeft = `${t}px solid ${b.borderColor}`;
        style.width = Math.max(6, t + 4);
      }
    } else if (b.borderW > 0) {
      style.border = `${Math.max(1, b.borderW * s)}px solid ${b.borderColor}`;
    }
    let content: React.ReactNode = null;
    if (b.type === "text" || b.type === "box") {
      content = <div style={{ padding: b.type === "box" ? `${1 * s}px ${1.5 * s}px` : 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{tokenPreview(b.text)}</div>;
    } else if (b.type === "image") {
      content = (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(148,163,184,0.18)", color: "#475569", fontSize: Math.max(9, 3 * s) }}>
          {b.image === "stamp" ? "مهر و امضا" : "لوگو"}
        </div>
      );
    } else if (b.type === "totals") {
      content = (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: fs }}>
          <tbody>
            {b.rows.map((r, i) => (
              <tr key={i}>
                <td style={{ border: "1px solid #888", padding: "0 3px", background: "#f1f5f9", fontWeight: 700, fontSize: "inherit" }}>{r.label}</td>
                <td style={{ border: "1px solid #888", padding: "0 3px", direction: "ltr", fontSize: "inherit" }}>‹{titles.get(r.path) ?? r.path}›</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    } else if (b.type === "banks") {
      content = <div style={{ padding: 2, color: "#475569" }}>‹حساب‌های بانکی شرکت›</div>;
    }
    return (
      <div key={b.id} style={style} onPointerDown={(e) => startPointer(e, b.id, "move")} title={`${TYPE_FA[b.type]}${b.showIf ? " (شرطی)" : ""}`}>
        {content}
        {selected === b.id &&
          HANDLES.map((hd) => (
            <span
              key={hd.h}
              onPointerDown={(e) => startPointer(e, b.id, hd.h)}
              style={{ position: "absolute", width: 8, height: 8, background: "#fff", border: "1.5px solid #2563eb", borderRadius: 2, cursor: hd.cursor, ...hd.style }}
            />
          ))}
      </div>
    );
  }

  const bandBox = (band: Band) => {
    const gridPx = Math.max(6, 10 * s);
    return (
      <div
        key={band}
        style={{
          position: "absolute",
          left: 0,
          top: offsets[band] * s,
          width: contentW * s,
          height: layout.bands[band] * s,
          background: showGrid ? `linear-gradient(to right, rgba(148,163,184,0.18) 1px, transparent 1px) 0 0 / ${gridPx}px ${gridPx}px, linear-gradient(to bottom, rgba(148,163,184,0.18) 1px, transparent 1px) 0 0 / ${gridPx}px ${gridPx}px, #fff` : "#fff",
          boxShadow: "inset 0 0 0 1px #cbd5e1",
        }}
      >
        <span style={{ position: "absolute", right: 4, top: 2, fontSize: 10, color: "#94a3b8", pointerEvents: "none", zIndex: 0 }}>{BAND_FA[band]} — {layout.bands[band]} mm</span>
        {layout.blocks.filter((b) => b.band === band).map(blockView)}
        <div
          onPointerDown={(e) => startBandResize(e, band)}
          title="کشیدن برای تغییر ارتفاع"
          style={{ position: "absolute", left: 0, right: 0, bottom: -3, height: 6, cursor: "ns-resize", background: "rgba(37,99,235,0.35)", opacity: 0.0 }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.opacity = "1")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.opacity = "0")}
        />
      </div>
    );
  };

  const t = layout.table;
  const visCols = t.columns.filter((c) => c.visible);
  const relSum = visCols.reduce((a, c) => a + (c.widthPct > 0 ? c.widthPct : 10), 0) || 1;

  const tableBox = (
    <div
      key="table"
      onPointerDown={(e) => {
        e.stopPropagation();
        wrapRef.current?.focus();
        setSelected("table");
      }}
      style={{
        position: "absolute",
        left: t.x * s,
        top: offsets.table * s,
        width: t.w * s,
        height: TABLE_PREVIEW_MM * s,
        boxSizing: "border-box",
        outline: selected === "table" ? "2px solid #2563eb" : "1px dashed rgba(100,116,139,0.55)",
        background: "#fff",
        overflow: "hidden",
        cursor: "pointer",
        fontSize: t.fontPt * PT_MM * s,
      }}
    >
      {t.sectionTitle && <div style={{ background: t.accent, border: "1px solid #888", padding: "0 4px", fontWeight: 700 }}>{t.sectionTitle}</div>}
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <thead>
          <tr>
            {visCols.map((c) => (
              <th key={c.key} style={{ width: `${((c.widthPct > 0 ? c.widthPct : 10) / relSum) * 100}%`, background: t.accent, border: "1px solid #888", padding: "1px 2px", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", fontSize: "inherit" }}>
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[0, 1].map((r) => (
            <tr key={r}>
              {visCols.map((c) => (
                <td key={c.key} style={{ border: "1px solid #aaa", padding: "1px 2px", color: "#94a3b8", textAlign: "center", fontSize: "inherit" }}>…</td>
              ))}
            </tr>
          ))}
          {t.sumRow && (
            <tr>
              <td colSpan={visCols.length} style={{ border: "1px solid #888", background: "#f7f7f7", fontWeight: 700, textAlign: "center", fontSize: "inherit" }}>جمع کل</td>
            </tr>
          )}
          {t.inWords && (
            <tr>
              <td colSpan={visCols.length} style={{ border: "1px solid #888", background: "#f7f7f7", fontWeight: 700, padding: "0 4px", fontSize: "inherit" }}>مبلغ کل به حروف: …</td>
            </tr>
          )}
        </tbody>
      </table>
      <div style={{ position: "absolute", left: 4, bottom: 2, fontSize: 10, color: "#94a3b8" }}>جدول اقلام — تعداد سطرها خودکار است</div>
    </div>
  );

  // ── پنل‌ها ──
  const numInput = (value: number, onCh: (v: number) => void, opts: { min?: number; max?: number; step?: number; title?: string } = {}) => (
    <input
      type="number"
      dir="ltr"
      value={value}
      min={opts.min}
      max={opts.max}
      step={opts.step ?? 0.5}
      title={opts.title}
      style={{ width: "100%" }}
      onChange={(e) => {
        const v = Number(e.target.value);
        if (Number.isFinite(v)) onCh(v);
      }}
    />
  );
  const fieldRow = (label: string, control: React.ReactNode) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12 }}>
      <span>{label}</span>
      {control}
    </label>
  );

  const toolBtn: React.CSSProperties = { padding: "2px 8px", fontSize: 12 };

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      style={{ width: "100%", outline: "none", border: "1px solid var(--border, #ccc)", borderRadius: 6, background: "var(--surface, #fff)" }}
    >
      {/* نوار ابزار */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", padding: 6, borderBottom: "1px solid var(--border, #ccc)" }}>
        <span style={{ fontSize: 12, color: "#666" }}>افزودن:</span>
        {(["text", "box", "line", "image", "totals", "banks"] as BlockType[]).map((tp) => (
          <button key={tp} type="button" className="btn secondary" style={toolBtn} onClick={() => addBlock(tp, tp === "image" ? { image: "logo" } : {})}>
            {tp === "image" ? "لوگو" : TYPE_FA[tp]}
          </button>
        ))}
        <button type="button" className="btn secondary" style={toolBtn} onClick={() => addBlock("image", { image: "stamp", w: 40, h: 28 })}>مهر و امضا</button>
        <span style={{ width: 1, height: 20, background: "#ccc" }} />
        <button type="button" className="btn secondary" style={toolBtn} onClick={undo} disabled={history.current.past.length === 0} title="واگرد (Ctrl+Z)">واگرد</button>
        <button type="button" className="btn secondary" style={toolBtn} onClick={redo} disabled={history.current.future.length === 0} title="ازنو (Ctrl+Y)">ازنو</button>
        <button type="button" className="btn secondary" style={toolBtn} onClick={duplicateSelected} disabled={!sel} title="کپی (Ctrl+D)">کپی</button>
        <button type="button" className="btn secondary" style={toolBtn} onClick={removeSelected} disabled={!sel} title="حذف (Delete)">حذف</button>
        <button type="button" className="btn secondary" style={toolBtn} onClick={() => bringTo(true)} disabled={!sel} title="روی بقیه">جلو</button>
        <button type="button" className="btn secondary" style={toolBtn} onClick={() => bringTo(false)} disabled={!sel} title="زیر بقیه">عقب</button>
        <span style={{ flex: 1 }} />
        <label style={{ fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}>
          چسبیدن به شبکه
          <select value={snap} onChange={(e) => setSnap(Number(e.target.value))}>
            <option value={0}>بدون</option>
            <option value={0.5}>0.5 mm</option>
            <option value={1}>1 mm</option>
            <option value={2}>2 mm</option>
            <option value={5}>5 mm</option>
          </select>
        </label>
        <label style={{ fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}>
          <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} /> شبکه
        </label>
        <button type="button" className="btn secondary" style={toolBtn} onClick={() => setZoom(clamp(round1(s - 0.4), 1.2, 6))}>−</button>
        <button type="button" className="btn secondary" style={toolBtn} onClick={() => setZoom(null)} title="تطبیق با عرض">{Math.round((s / 3.78) * 100)}٪</button>
        <button type="button" className="btn secondary" style={toolBtn} onClick={() => setZoom(clamp(round1(s + 0.4), 1.2, 6))}>+</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "210px minmax(0, 1fr) 270px", gap: 0, minHeight: 420 }}>
        {/* فیلدها */}
        <div style={{ borderInlineStart: "1px solid var(--border, #ccc)", maxHeight: "74vh", overflow: "auto", padding: 6, fontSize: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>فیلدها (کلیک = افزودن)</div>
          {groups.map((g) => (
            <div key={g} style={{ marginBottom: 6 }}>
              <div style={{ color: "#666", margin: "4px 0 2px" }}>{g}</div>
              {insertable.filter((f) => f.group === g).map((f) => (
                <button key={f.path} type="button" title={f.path} onClick={() => addField(f)} style={{ display: "block", width: "100%", textAlign: "right", background: "none", border: "none", padding: "2px 4px", cursor: "pointer" }}>
                  {f.title}
                </button>
              ))}
            </div>
          ))}
          {textKeys.length > 0 && (
            <div>
              <div style={{ color: "#666", margin: "4px 0 2px" }}>متن‌های ثابت قالب</div>
              {textKeys.filter((k) => k.key !== "fileName" && k.key !== "watermark").map((k) => (
                <button key={k.key} type="button" onClick={() => addBlock("text", { text: `{{t.${k.key}}}`, w: 70 })} style={{ display: "block", width: "100%", textAlign: "right", background: "none", border: "none", padding: "2px 4px", cursor: "pointer" }}>
                  {k.title}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* بوم */}
        <div ref={areaRef} style={{ overflow: "auto", maxHeight: "74vh", background: "#e5e7eb", padding: 12 }} onPointerDown={() => { setSelected(null); wrapRef.current?.focus(); }}>
          <div style={{ position: "relative", width: contentW * s, height: offsets.total * s, margin: "0 auto", background: "#fff", boxShadow: "0 1px 6px rgba(0,0,0,0.25)" }}>
            {bandBox("header")}
            {tableBox}
            {bandBox("after")}
            {bandBox("footer")}
          </div>
          <div style={{ textAlign: "center", fontSize: 11, color: "#64748b", marginTop: 6 }}>
            محدوده‌ی محتوا {contentW} × {contentH} میلی‌متر (بدون حاشیه) — فلش‌ها: جابه‌جایی، Shift+فلش: ۵ میلی‌متر
          </div>
        </div>

        {/* مشخصات */}
        <div style={{ borderInlineEnd: "1px solid var(--border, #ccc)", maxHeight: "74vh", overflow: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          {!sel && selected !== "table" && (
            <>
              <div style={{ fontWeight: 700 }}>ارتفاع باندها (میلی‌متر)</div>
              {(["header", "after", "footer"] as Band[]).map((b) => (
                <div key={b}>{fieldRow(BAND_FA[b], numInput(layout.bands[b], (v) => setBandHeight(b, v), { min: 2, step: 1 }))}</div>
              ))}
              <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.7 }}>
                یک بلوک را انتخاب کنید یا از نوار بالا بلوک تازه بیفزایید. بلوک‌ها را می‌توان بین باندها کشید؛ «بعد از جدول» و «پایین صفحه» با بلندشدن جدول
                پایین می‌روند. لبه‌ی پایین هر باند را هم می‌توان کشید.
              </div>
            </>
          )}

          {selected === "table" && (
            <>
              <div style={{ fontWeight: 700 }}>جدول اقلام</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {fieldRow("فاصله از چپ (mm)", numInput(t.x, (v) => patchTable({ x: clamp(v, 0, Math.max(0, contentW - 20)), w: Math.min(t.w, contentW - clamp(v, 0, contentW - 20)) }, "x"), { min: 0, step: 1 }))}
                {fieldRow("عرض (mm)", numInput(t.w, (v) => patchTable({ w: clamp(v, 20, contentW - t.x) }, "w"), { min: 20, step: 1 }))}
                {fieldRow("اندازه‌ی فونت", numInput(t.fontPt, (v) => patchTable({ fontPt: clamp(v, 6, 14) }, "font"), { min: 6, max: 14 }))}
                {fieldRow("رنگ سرستون", <input type="color" value={t.accent} onChange={(e) => patchTable({ accent: e.target.value }, "accent")} style={{ width: "100%", height: 28, padding: 0 }} />)}
              </div>
              {fieldRow("عنوان بالای جدول (خالی = بدون عنوان)", <input value={t.sectionTitle} maxLength={80} onChange={(e) => patchTable({ sectionTitle: e.target.value }, "title")} />)}
              <label className="checkbox-row"><input type="checkbox" checked={t.sumRow} onChange={(e) => patchTable({ sumRow: e.target.checked })} /> سطر جمع کل</label>
              <label className="checkbox-row"><input type="checkbox" checked={t.inWords} onChange={(e) => patchTable({ inWords: e.target.checked })} /> مبلغ کل به حروف</label>
              <label className="checkbox-row"><input type="checkbox" checked={t.stripe} onChange={(e) => patchTable({ stripe: e.target.checked })} /> سطرهای یک‌درمیان</label>
              <div style={{ fontWeight: 700 }}>ستون‌ها</div>
              <table className="je-lines-table" style={{ width: "100%", fontSize: 11 }}>
                <tbody>
                  {t.columns.map((c, i) => (
                    <tr key={c.key}>
                      <td style={{ width: 26, textAlign: "center" }}>
                        <input type="checkbox" checked={c.visible} onChange={(e) => patchTable({ columns: t.columns.map((x, j) => (j === i ? { ...x, visible: e.target.checked } : x)) })} />
                      </td>
                      <td>
                        <input value={c.title} maxLength={40} style={{ width: "100%" }} onChange={(e) => patchTable({ columns: t.columns.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) }, `c${i}`)} />
                      </td>
                      <td style={{ width: 50 }}>
                        <input type="number" dir="ltr" min={0} max={60} step={0.5} value={c.widthPct} title="عرض نسبی؛ ۰ = پیش‌فرض" style={{ width: "100%" }} onChange={(e) => patchTable({ columns: t.columns.map((x, j) => (j === i ? { ...x, widthPct: Number(e.target.value) || 0 } : x)) }, `w${i}`)} />
                      </td>
                      <td style={{ width: 44, whiteSpace: "nowrap", textAlign: "center" }}>
                        <button type="button" className="btn secondary" style={{ padding: "0 4px" }} disabled={i === 0} onClick={() => patchTable({ columns: swap(t.columns, i, -1) })}>↑</button>
                        <button type="button" className="btn secondary" style={{ padding: "0 4px" }} disabled={i === t.columns.length - 1} onClick={() => patchTable({ columns: swap(t.columns, i, 1) })}>↓</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {sel && (
            <>
              <div style={{ fontWeight: 700 }}>{TYPE_FA[sel.type]}</div>
              {fieldRow(
                "محل",
                <select value={sel.band} onChange={(e) => { const nb = e.target.value as Band; patchBlock(sel.id, { band: nb, y: clamp(sel.y, 0, Math.max(0, layout.bands[nb] - sel.h)) }); }}>
                  {(["header", "after", "footer"] as Band[]).map((b) => <option key={b} value={b}>{BAND_FA[b]}</option>)}
                </select>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {fieldRow("از چپ (x)", numInput(sel.x, (v) => patchBlock(sel.id, { x: clamp(v, 0, Math.max(0, contentW - sel.w)) }, "x"), { min: 0 }))}
                {fieldRow("از بالا (y)", numInput(sel.y, (v) => patchBlock(sel.id, { y: clamp(v, 0, Math.max(0, layout.bands[sel.band] - sel.h)) }, "y"), { min: 0 }))}
                {fieldRow("عرض", numInput(sel.w, (v) => patchBlock(sel.id, { w: clamp(v, sel.type === "line" ? 0 : 1, contentW - sel.x) }, "w"), { min: 0 }))}
                {fieldRow("ارتفاع", numInput(sel.h, (v) => patchBlock(sel.id, { h: clamp(v, 0, Math.max(0, layout.bands[sel.band] - sel.y)) }, "h"), { min: 0 }))}
              </div>

              {(sel.type === "text" || sel.type === "box") && (
                <>
                  {fieldRow(
                    "متن (برای فیلد از فهرست زیر یا فهرست راست بیفزایید)",
                    <textarea ref={textRef} rows={4} value={sel.text} onChange={(e) => patchBlock(sel.id, { text: e.target.value }, "text")} style={{ width: "100%", resize: "vertical" }} />
                  )}
                  {fieldRow(
                    "درج فیلد در متن",
                    <select value="" onChange={(e) => { if (e.target.value) insertToken(e.target.value); }}>
                      <option value="">انتخاب فیلد…</option>
                      {groups.map((g) => (
                        <optgroup key={g} label={g}>
                          {insertable.filter((f) => f.group === g).map((f) => <option key={f.path} value={f.path}>{f.title}</option>)}
                        </optgroup>
                      ))}
                      {textKeys.length > 0 && (
                        <optgroup label="متن‌های ثابت قالب">
                          {textKeys.map((k) => <option key={k.key} value={`t.${k.key}`}>{k.title}</option>)}
                        </optgroup>
                      )}
                    </select>
                  )}
                </>
              )}

              {sel.type === "image" && fieldRow(
                "تصویر",
                <select value={sel.image} onChange={(e) => patchBlock(sel.id, { image: e.target.value as "logo" | "stamp" })}>
                  <option value="logo">لوگوی شرکت</option>
                  <option value="stamp">مهر و امضای شرکت</option>
                </select>
              )}

              {sel.type === "totals" && (
                <>
                  <div style={{ fontWeight: 700, fontSize: 12 }}>ردیف‌های جمع</div>
                  {sel.rows.map((r, i) => (
                    <div key={i} style={{ display: "flex", gap: 4 }}>
                      <input value={r.label} maxLength={60} style={{ flex: 1, minWidth: 0 }} onChange={(e) => patchBlock(sel.id, { rows: sel.rows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) }, `r${i}`)} />
                      <select value={r.path} style={{ width: 90 }} onChange={(e) => patchBlock(sel.id, { rows: sel.rows.map((x, j) => (j === i ? { ...x, path: e.target.value } : x)) })}>
                        {insertable.filter((f) => f.path.startsWith("totals.") || f.path.startsWith("doc.")).map((f) => <option key={f.path} value={f.path}>{f.title}</option>)}
                      </select>
                      <button type="button" className="btn secondary" style={{ padding: "0 6px" }} onClick={() => patchBlock(sel.id, { rows: sel.rows.filter((_, j) => j !== i) })}>×</button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn secondary"
                    style={toolBtn}
                    onClick={() => patchBlock(sel.id, { rows: [...sel.rows, { label: "جمع", path: totalFields[0]?.path ?? "totals.net" }], h: sel.h + 6 })}
                  >
                    افزودن ردیف
                  </button>
                </>
              )}

              {sel.type !== "line" && sel.type !== "image" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {fieldRow("اندازه‌ی فونت (۰ = پیش‌فرض)", numInput(sel.fontPt, (v) => patchBlock(sel.id, { fontPt: clamp(v, 0, 40) }, "font"), { min: 0, max: 40 }))}
                  {fieldRow(
                    "تراز",
                    <select value={sel.align} onChange={(e) => patchBlock(sel.id, { align: e.target.value as LayoutBlock["align"] })}>
                      <option value="right">راست</option>
                      <option value="center">وسط</option>
                      <option value="left">چپ</option>
                    </select>
                  )}
                  {fieldRow("رنگ متن", <input type="color" value={sel.color} onChange={(e) => patchBlock(sel.id, { color: e.target.value }, "color")} style={{ width: "100%", height: 28, padding: 0 }} />)}
                  <label className="checkbox-row" style={{ alignSelf: "end" }}>
                    <input type="checkbox" checked={sel.bold} onChange={(e) => patchBlock(sel.id, { bold: e.target.checked })} /> پررنگ
                  </label>
                </div>
              )}

              {sel.type !== "image" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {fieldRow(sel.type === "line" ? "ضخامت خط (mm)" : "ضخامت کادر (mm)", numInput(sel.borderW, (v) => patchBlock(sel.id, { borderW: clamp(v, 0, 3) }, "bw"), { min: 0, max: 3, step: 0.1 }))}
                  {fieldRow("رنگ کادر/خط", <input type="color" value={sel.borderColor} onChange={(e) => patchBlock(sel.id, { borderColor: e.target.value }, "bc")} style={{ width: "100%", height: 28, padding: 0 }} />)}
                  {sel.type !== "line" && (
                    <>
                      {fieldRow(
                        "پس‌زمینه",
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          <input type="color" value={sel.bg || "#ffffff"} onChange={(e) => patchBlock(sel.id, { bg: e.target.value }, "bg")} style={{ flex: 1, height: 28, padding: 0 }} />
                          <button type="button" className="btn secondary" style={{ padding: "0 6px" }} onClick={() => patchBlock(sel.id, { bg: "" })} title="بدون پس‌زمینه">×</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {sel.type === "line" && (
                <button type="button" className="btn secondary" style={toolBtn} onClick={() => patchBlock(sel.id, sel.h === 0 ? { w: 0, h: Math.min(20, layout.bands[sel.band] - sel.y) } : { h: 0, w: Math.min(80, contentW - sel.x) })}>
                  {sel.h === 0 ? "تبدیل به خط عمودی" : "تبدیل به خط افقی"}
                </button>
              )}

              {sel.type !== "line" && fieldRow(
                "نمایش فقط وقتی این فیلد مقدار دارد",
                <select value={sel.showIf} onChange={(e) => patchBlock(sel.id, { showIf: e.target.value })}>
                  <option value="">همیشه نمایش بده</option>
                  {insertable.map((f) => <option key={f.path} value={f.path}>{f.title}</option>)}
                </select>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function swap<T>(list: T[], idx: number, delta: -1 | 1): T[] {
  const to = idx + delta;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[idx], next[to]] = [next[to], next[idx]];
  return next;
}
