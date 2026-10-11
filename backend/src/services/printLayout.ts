import { normalizeDesign, type PrintDesignSchema } from "./printDesign";

// «طراحی بصری» قالب چاپ: کاربر بلوک‌ها را روی یک صفحه می‌کشد؛ ذخیره‌ی آن یک چیدمان JSON (PrintTemplate.layout) است و سرور همان را به HTML/CSS
// معمولی قالب تبدیل می‌کند (PrintTemplate.html) تا چاپ، پیش‌نمایش و لینک اشتراک‌گذاری بدون هیچ تغییری کار کنند.
//
// ساختار صفحه «باند» است تا جدول اقلام (با تعداد سطر متغیر) چیدمان را به‌هم نریزد:
//   header  — بلوک‌های آزاد بالای جدول (ارتفاع ثابت)
//   table   — جدول اقلام (با تعداد سطر بلند می‌شود؛ ستون‌ها از schema طراح ساده)
//   after   — بلوک‌های آزاد، زیر جدول (با بلندشدن جدول پایین می‌روند)
//   footer  — بلوک‌های آزاد، چسبیده به پایین آخرین صفحه
// مختصات هر بلوک میلی‌متر و نسبت به گوشه‌ی بالا-چپ باند (محدوده‌ی محتوا، منهای حاشیه) است.

export type LayoutBlockType = "text" | "image" | "box" | "line" | "totals" | "banks";
export type LayoutBand = "header" | "after" | "footer";
export const LAYOUT_BANDS: LayoutBand[] = ["header", "after", "footer"];
/** انواع سندی که طراحی بصری دارند (فعلاً پیش‌فاکتور و فاکتور فروش؛ سند حسابداری صفحه‌بندی سرور دارد) */
export const VISUAL_LAYOUT_TYPES = new Set(["SALES_QUOTE", "SALES_INVOICE"]);
const BLOCK_TYPES: LayoutBlockType[] = ["text", "image", "box", "line", "totals", "banks"];

export interface LayoutBlock {
  id: string;
  type: LayoutBlockType;
  band: LayoutBand;
  x: number;
  y: number;
  w: number;
  h: number;
  /** text/box: متن (با {{مسیر}}) */
  text: string;
  /** image: لوگو یا مهر شرکت */
  image: "logo" | "stamp";
  /** totals: ردیف‌های «برچسب: مقدار» */
  rows: { label: string; path: string }[];
  fontPt: number;
  bold: boolean;
  align: "right" | "center" | "left";
  color: string;
  /** پس‌زمینه؛ خالی = شفاف */
  bg: string;
  borderW: number;
  borderColor: string;
  /** فقط وقتی این فیلد مقدار دارد نمایش بده (مسیر فیلد؛ خالی = همیشه) */
  showIf: string;
}

export interface LayoutTable {
  /** فاصله‌ی چپ و عرض جدول (میلی‌متر) */
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

export interface LayoutGeometry {
  contentWidthMm: number;
  contentHeightMm: number;
}

// ─── اعتبارسنجی ─────────────────────────────────────────────────────────────

const HEX = /^#[0-9a-fA-F]{6}$/;
/** پیشوندهای مجاز متغیر در متن بلوک‌ها (ردیف‌ها و design عمداً نیستند) */
const TOKEN_ROOTS = new Set(["doc", "company", "customer", "totals", "t"]);
const TOKEN_RE = /\{\{\s*([A-Za-z_]\w*(?:\.\w+)+)\s*\}\}/g;
const PATH_RE = /^[A-Za-z_]\w*(?:\.\w+)+$/;
const MAX_BLOCKS = 80;

function num(v: unknown, def: number, min: number, max: number, step = 10): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.round(n * step) / step));
}

function hex(v: unknown, def: string): string {
  return typeof v === "string" && HEX.test(v) ? v.toLowerCase() : def;
}

function safePath(v: unknown): string {
  const s = typeof v === "string" ? v.trim() : "";
  return PATH_RE.test(s) && TOKEN_ROOTS.has(s.split(".")[0]) ? s : "";
}

function tableDefaults(schema: PrintDesignSchema, geo: LayoutGeometry): LayoutTable {
  return {
    x: 0,
    w: geo.contentWidthMm,
    fontPt: schema.fontPt,
    accent: schema.accent,
    sectionTitle: "مشخصات کالا یا خدمات",
    sumRow: true,
    inWords: true,
    stripe: false,
    columns: schema.columns.map((c) => ({ key: c.key, title: c.title, widthPct: c.widthPct, visible: c.visible })),
  };
}

export function normalizeLayout(schema: PrintDesignSchema, raw: unknown, geo: LayoutGeometry): VisualLayout {
  const W = geo.contentWidthMm;
  const H = geo.contentHeightMm;
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const maxBand = Math.max(10, H - 20);

  const bandsRaw = (r.bands ?? {}) as Record<string, unknown>;
  const bands = {
    header: num(bandsRaw.header, 60, 0, maxBand),
    after: num(bandsRaw.after, 50, 0, maxBand),
    footer: num(bandsRaw.footer, 10, 0, maxBand),
  };

  const def = tableDefaults(schema, geo);
  const tr = (r.table ?? {}) as Record<string, any>;
  const design = normalizeDesign(schema, { accent: tr.accent, fontPt: tr.fontPt, columns: tr.columns });
  const tx = num(tr.x, 0, 0, Math.max(0, W - 20));
  const table: LayoutTable = {
    x: tx,
    w: num(tr.w, def.w, 20, W - tx),
    fontPt: design.fontPt,
    accent: design.accent,
    sectionTitle: typeof tr.sectionTitle === "string" ? tr.sectionTitle.trim().slice(0, 80) : def.sectionTitle,
    sumRow: tr.sumRow === false ? false : true,
    inWords: tr.inWords === false ? false : true,
    stripe: tr.stripe === true,
    columns: design.columns,
  };

  const blocks: LayoutBlock[] = [];
  const seen = new Set<string>();
  const list = Array.isArray(r.blocks) ? r.blocks.slice(0, MAX_BLOCKS) : [];
  for (const b of list as Record<string, any>[]) {
    if (!b || typeof b !== "object") continue;
    const type = BLOCK_TYPES.includes(b.type) ? (b.type as LayoutBlockType) : null;
    const band = LAYOUT_BANDS.includes(b.band) ? (b.band as LayoutBand) : null;
    if (!type || !band) continue;
    let id = typeof b.id === "string" && /^[\w-]{1,24}$/.test(b.id) ? b.id : `b${blocks.length + 1}`;
    while (seen.has(id)) id = `${id}x`;
    seen.add(id);
    const bandH = bands[band];
    const w = num(b.w, 40, type === "line" ? 0 : 1, W);
    const h = num(b.h, type === "line" ? 0 : 6, 0, Math.max(0, bandH));
    const x = num(b.x, 0, 0, Math.max(0, W - w));
    const y = num(b.y, 0, 0, Math.max(0, bandH - h));
    const rows = Array.isArray(b.rows)
      ? (b.rows as any[])
          .slice(0, 12)
          .map((row) => ({ label: String(row?.label ?? "").slice(0, 60), path: safePath(row?.path) }))
          .filter((row) => row.path)
      : [];
    blocks.push({
      id,
      type,
      band,
      x,
      y,
      w,
      h,
      text: typeof b.text === "string" ? b.text.slice(0, 2000) : "",
      image: b.image === "stamp" ? "stamp" : "logo",
      rows,
      fontPt: num(b.fontPt, 0, 0, 40),
      bold: b.bold === true,
      align: b.align === "center" || b.align === "left" ? b.align : "right",
      color: hex(b.color, "#111111"),
      bg: typeof b.bg === "string" && HEX.test(b.bg) ? b.bg.toLowerCase() : "",
      borderW: num(b.borderW, type === "box" ? 0.2 : 0, 0, 3, 100),
      borderColor: hex(b.borderColor, "#666666"),
      showIf: safePath(b.showIf),
    });
  }
  return { version: 1, bands, table, blocks };
}

// ─── تولید HTML ─────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** متن بلوک → HTML امن: همه‌چیز escape می‌شود جز {{مسیرِ مجاز}}؛ «\n» → <br> */
export function renderBlockText(text: string): string {
  let out = "";
  let last = 0;
  for (const m of text.matchAll(TOKEN_RE)) {
    const idx = m.index ?? 0;
    out += esc(text.slice(last, idx));
    out += TOKEN_ROOTS.has(m[1].split(".")[0]) ? `{{${m[1]}}}` : esc(m[0]);
    last = idx + m[0].length;
  }
  out += esc(text.slice(last));
  return out.replace(/\r?\n/g, "<br>");
}

function mm(n: number): string {
  return `${Math.round(n * 100) / 100}mm`;
}

function blockStyle(b: LayoutBlock): string {
  const parts = [`left:${mm(b.x)}`, `top:${mm(b.y)}`, `width:${mm(b.w)}`];
  if (b.type !== "line" || b.h > 0) parts.push(`height:${mm(b.h)}`);
  if (b.fontPt) parts.push(`font-size:${b.fontPt}pt`);
  if (b.bold) parts.push("font-weight:700");
  parts.push(`text-align:${b.align}`, `color:${b.color}`);
  if (b.bg) parts.push(`background:${b.bg}`);
  if (b.type === "line") {
    // خط افقی (h = 0) یا عمودی (w = 0)
    const t = Math.max(0.1, b.borderW || 0.3);
    parts.push(b.h === 0 || b.w > 0 ? `border-top:${t}mm solid ${b.borderColor}` : `border-left:${t}mm solid ${b.borderColor}`);
  } else if (b.borderW > 0) {
    parts.push(`border:${b.borderW}mm solid ${b.borderColor}`);
  }
  return parts.join(";");
}

function blockHtml(b: LayoutBlock): string {
  let inner = "";
  let cls = "vl-b";
  if (b.type === "text" || b.type === "box") {
    inner = renderBlockText(b.text);
    if (b.type === "box") cls += " vl-box";
  } else if (b.type === "image") {
    const p = b.image === "stamp" ? "company.stamp" : "company.logo";
    inner = `{{#if ${p}}}<img src="{{${p}}}" alt="">{{/if}}`;
    cls += " vl-img";
  } else if (b.type === "line") {
    cls += " vl-line";
  } else if (b.type === "totals") {
    cls += " vl-tot";
    inner = `<table>${b.rows.map((r) => `<tr><td class="k">${esc(r.label)}</td><td class="v">{{${r.path}}}</td></tr>`).join("")}</table>`;
  } else if (b.type === "banks") {
    cls += " vl-banks";
    inner =
      `{{#each company.bankAccounts}}<div class="bk"><div class="h">مشخصات حساب بانکی {{no}}:</div>` +
      `<div>{{bankName}}{{#if branch}} شعبه {{branch}}{{/if}}</div>` +
      `<div>شماره حساب: <span class="ltr">{{accountNumber}}</span></div>` +
      `{{#if iban}}<div>شماره شبا: <span class="ltr">{{iban}}</span></div>{{/if}}</div>{{/each}}`;
  }
  const el = `<div class="${cls}" style="${blockStyle(b)}">${inner}</div>`;
  return b.showIf ? `{{#if ${b.showIf}}}${el}{{/if}}` : el;
}

function tableHtml(schema: PrintDesignSchema, t: LayoutTable): string {
  const defs = new Map(schema.columns.map((c) => [c.key, c]));
  const cols = t.columns.filter((c) => c.visible);
  const rel = cols.map((c) => (c.widthPct > 0 ? c.widthPct : defs.get(c.key)?.widthPct || 10));
  const sum = rel.reduce((a, b) => a + b, 0) || 1;
  const widths = rel.map((r) => `${Math.round((r / sum) * 10000) / 100}%`);
  const cls = (key: string) => {
    const d = defs.get(key);
    return d?.text ? "t" : d?.numeric ? "n" : "";
  };
  const head = cols.map((c, i) => `<th style="width:${widths[i]}">${esc(c.title)}</th>`).join("");
  const cells = cols.map((c) => `<td${cls(c.key) ? ` class="${cls(c.key)}"` : ""}>{{${c.key}}}</td>`).join("");

  let foot = "";
  if (t.sumRow) {
    const firstSum = cols.findIndex((c) => defs.get(c.key)?.sum);
    const parts: string[] = [];
    if (firstSum === -1) parts.push(`<td colspan="${cols.length}">جمع کل</td>`);
    else {
      if (firstSum > 0) parts.push(`<td colspan="${firstSum}">جمع کل</td>`);
      for (const c of cols.slice(firstSum)) parts.push(defs.get(c.key)?.sum ? `<td class="n">{{totals.${c.key}}}</td>` : "<td></td>");
    }
    foot += `<tr>${parts.join("")}</tr>`;
  }
  if (t.inWords) foot += `<tr><td colspan="${cols.length}" class="t">مبلغ کل به حروف: {{totals.netInWords}}</td></tr>`;

  const title = t.sectionTitle ? `<div class="vl-sec">${esc(t.sectionTitle)}</div>` : "";
  return (
    `<div class="vl-table${t.stripe ? " stripe" : ""}" style="margin-left:${mm(t.x)};width:${mm(t.w)};font-size:${t.fontPt}pt">${title}` +
    `<table><thead><tr>${head}</tr></thead><tbody>{{#each lines}}<tr>${cells}</tr>{{/each}}</tbody>` +
    `${foot ? `<tfoot>${foot}</tfoot>` : ""}</table></div>`
  );
}

/** چیدمان → HTML/CSS قالب (متغیرهای Handlebars؛ اسکریپت ندارد) */
export function layoutToHtml(schema: PrintDesignSchema, layout: VisualLayout, geo: LayoutGeometry): string {
  const band = (key: LayoutBand, extra = "") =>
    `<div class="vl-band${extra}" style="height:${mm(layout.bands[key])}">${layout.blocks.filter((b) => b.band === key).map(blockHtml).join("")}</div>`;
  const css = `<style>
  .vl-page { position: relative; display: flex; flex-direction: column; width: ${mm(geo.contentWidthMm)}; margin: 0 auto; min-height: ${mm(geo.contentHeightMm)}; font-size: ${layout.table.fontPt}pt; }
  .vl-band { position: relative; flex-shrink: 0; page-break-inside: avoid; }
  .vl-footer { margin-top: auto; }
  .vl-b { position: absolute; box-sizing: border-box; line-height: 1.55; overflow-wrap: anywhere; }
  .vl-box { padding: 1mm 1.5mm; }
  .vl-img img { width: 100%; height: 100%; object-fit: contain; display: block; }
  .vl-line { height: 0; }
  .vl-tot table { width: 100%; border-collapse: collapse; }
  .vl-tot td { border: 0.2mm solid #666; padding: 0.6mm 1.5mm; }
  .vl-tot td.k { font-weight: 700; background: #f4f4f4; }
  .vl-tot td.v { direction: ltr; unicode-bidi: plaintext; text-align: right; }
  .vl-banks { display: flex; gap: 5mm; }
  .vl-banks .bk { flex: 1; line-height: 1.6; }
  .vl-banks .h { font-weight: 700; }
  .vl-banks .ltr { direction: ltr; unicode-bidi: plaintext; display: inline-block; }
  .vl-table { box-sizing: border-box; }
  .vl-sec { background: ${layout.table.accent}; color: #111; border: 0.2mm solid #666; border-bottom: none; font-weight: 700; padding: 0.6mm 2mm; }
  .vl-table table { width: 100%; border-collapse: collapse; }
  .vl-table th { background: ${layout.table.accent}; border: 0.2mm solid #666; padding: 0.9mm 1mm; font-weight: 700; text-align: center; }
  .vl-table td { border: 0.2mm solid #666; padding: 0.8mm 1.2mm; text-align: center; }
  .vl-table td.t { text-align: right; }
  .vl-table td.n { direction: ltr; unicode-bidi: plaintext; }
  .vl-table tfoot td { background: #f7f7f7; font-weight: 700; }
  .vl-table thead { display: table-header-group; }
  .vl-table tr { page-break-inside: avoid; }
  .vl-table.stripe tbody tr:nth-child(even) td { background: #fafafa; }
  .vl-wm { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg); white-space: nowrap; font-size: 80pt; font-weight: 700; color: rgba(0, 0, 0, 0.055); z-index: 0; pointer-events: none; }
</style>`;
  return (
    `${css}\n<div class="vl-page">\n{{#if t.watermark}}<div class="vl-wm">{{t.watermark}}</div>{{/if}}\n` +
    `${band("header")}\n${tableHtml(schema, layout.table)}\n${band("after")}\n${band("footer", " vl-footer")}\n</div>`
  );
}

// ─── چیدمان پیش‌فرض (هم‌ظاهر قالب پیش‌فرض نصب پیش‌فاکتور/فاکتور) ──────────────────────

export function defaultSalesLayout(schema: PrintDesignSchema, geo: LayoutGeometry, docType: string): VisualLayout {
  const W = geo.contentWidthMm;
  let n = 0;
  const id = () => `b${++n}`;
  const base = (over: Partial<LayoutBlock>): LayoutBlock => ({
    id: id(),
    type: "text",
    band: "header",
    x: 0,
    y: 0,
    w: 40,
    h: 6,
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
    ...over,
  });
  const blocks: LayoutBlock[] = [];

  // سربرگ: لوگو، نام شرکت و عنوان (راست)، شماره/تاریخ (چپ)، خط زیر سربرگ
  blocks.push(base({ type: "image", image: "logo", x: W - 34, y: 1, w: 34, h: 14 }));
  blocks.push(base({ x: W - 34 - 4 - 100, y: 1, w: 100, h: 7, text: "{{company.name}}", fontPt: 13.5, bold: true }));
  blocks.push(base({ x: W - 34 - 4 - 100, y: 8.5, w: 100, h: 6, text: "{{t.title}}", fontPt: 11, bold: true }));
  blocks.push(base({ x: 0, y: 1, w: 70, h: 5, text: "شماره سریال: {{doc.number}}", bold: true }));
  blocks.push(base({ x: 0, y: 6, w: 70, h: 5, text: "تاریخ: {{doc.date}}", bold: true }));
  if (docType === "SALES_INVOICE") {
    blocks.push(base({ x: 0, y: 11, w: 70, h: 5, text: "شماره منحصربه‌فرد مالیاتی: {{doc.taxId}}", bold: true, showIf: "doc.taxId" }));
  } else {
    blocks.push(base({ x: 0, y: 11, w: 70, h: 5, text: "تاریخ اعتبار: {{doc.validUntil}}", bold: true }));
  }
  blocks.push(base({ type: "line", x: 0, y: 17, w: W, h: 0, borderW: 0.4, borderColor: "#333333" }));

  // مشخصات فروشنده و خریدار: عنوان رنگی + جدول ۳×۳
  const party = (top: number, title: string, p: "company" | "customer") => {
    blocks.push(base({ type: "box", x: 0, y: top, w: W, h: 5.2, text: title, bold: true, bg: schema.accent, borderW: 0.2 }));
    const w1 = Math.round(W * 0.42 * 10) / 10;
    const w2 = Math.round(W * 0.29 * 10) / 10;
    const w3 = Math.round((W - w1 - w2) * 10) / 10;
    const cell = (x: number, y: number, w: number, text: string) => blocks.push(base({ type: "box", x, y, w, h: 6, text, borderW: 0.15 }));
    const y0 = top + 5.2;
    const regTitle = p === "company" ? "شماره تلفن" : "تلفن";
    cell(W - w1, y0, w1, `نام شخص حقیقی/حقوقی: {{${p}.name}}`);
    cell(W - w1 - w2, y0, w2, `شماره اقتصادی: {{${p}.economicCode}}`);
    cell(0, y0, w3, `شماره ثبت: {{${p}.registrationNumber}}`);
    cell(W - w1, y0 + 6, w1, `${regTitle}: {{${p}.phone}}`);
    cell(W - w1 - w2, y0 + 6, w2, `کد ملی/شناسه ملی: {{${p}.nationalId}}`);
    cell(0, y0 + 6, w3, `کد پستی: {{${p}.postalCode}}`);
    cell(0, y0 + 12, W, `نشانی: {{${p}.address}}`);
    return y0 + 18;
  };
  const afterSeller = party(19, "مشخصات فروشنده", "company");
  const afterBuyer = party(afterSeller + 1.5, "مشخصات خریدار", "customer");
  const headerH = Math.ceil(afterBuyer + 1);

  // بعد از جدول: شرایط فروش و حساب‌های بانکی، کادر مهر و امضا
  const termsW = Math.round(W * 0.34 * 10) / 10;
  blocks.push(base({ band: "after", x: W - termsW, y: 2, w: termsW, h: 16, text: "شرایط و نحوه فروش: {{t.salesTerms}}\nمحل تحویل: {{t.deliveryPlace}}" }));
  blocks.push(base({ band: "after", type: "banks", x: 0, y: 2, w: Math.round((W - termsW - 5) * 10) / 10, h: 24 }));
  const signW = Math.round((W / 2 - 3) * 10) / 10;
  blocks.push(base({ band: "after", type: "box", x: W - signW, y: 28, w: signW, h: 34, text: "مهر و امضاء فروشنده:", borderW: 0.2 }));
  blocks.push(base({ band: "after", type: "image", image: "stamp", x: W - signW / 2 - 20, y: 32, w: 40, h: 28 }));
  blocks.push(base({ band: "after", type: "box", x: 0, y: 28, w: signW, h: 34, text: "مهر و امضاء خریدار:", borderW: 0.2 }));

  // پایین صفحه
  blocks.push(base({ band: "footer", x: 0, y: 1, w: 80, h: 5, text: "{{company.website}}", fontPt: 7.5, color: "#444444", align: "left" }));
  blocks.push(base({ band: "footer", x: W - 120, y: 1, w: 120, h: 5, text: "{{t.topNote}}", fontPt: 7.5, color: "#444444" }));

  return {
    version: 1,
    bands: { header: headerH, after: 64, footer: 8 },
    table: { ...tableDefaults(schema, geo) },
    blocks,
  };
}
