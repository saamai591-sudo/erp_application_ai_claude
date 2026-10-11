// «طراح ساده»ی قالب چاپ: به‌جای ویرایش HTML، کاربر ستون‌های جدول اقلام (نمایش/ترتیب/عنوان/عرض)، بخش‌های صفحه (نمایش/ترتیب)، رنگ تاکید و اندازه‌ی
// فونت را از یک فرم تنظیم می‌کند. نتیجه در `PrintTemplate.design` (JSON) ذخیره و هنگام رندر به‌صورت متغیر `design` به قالب داده می‌شود؛ قالب‌های
// پیش‌فرض نصب از همین متغیرها استفاده می‌کنند ({{#each design.columns}}، {{design.accent}}، style="order:{{design.order.seller}}" …).
// قالب‌هایی که HTML‌شان دستی نوشته شده و `design.` را به کار نمی‌برند از طراح اثر نمی‌گیرند (فرم، این را به کاربر می‌گوید).

export interface DesignColumnDef {
  key: string;
  title: string;
  /** عرض پیش‌فرض به درصد جدول؛ ۰ = خودکار (باقی‌مانده‌ی عرض) */
  widthPct: number;
  visible: boolean;
  /** در سطر «جمع کل» جمع زده می‌شود (کلید هم‌نام در totals) */
  sum?: boolean;
  /** هم‌ترازی/جهت عدد */
  numeric?: boolean;
  /** ستون متنیِ بلند (راست‌چین) */
  text?: boolean;
}

export interface DesignSectionDef {
  key: string;
  title: string;
  visible: boolean;
  /** نمی‌توان پنهانش کرد (مثل جدول اقلام) */
  locked?: boolean;
}

export interface PrintDesignSchema {
  accent: string;
  fontPt: number;
  columns: DesignColumnDef[];
  sections: DesignSectionDef[];
}

export interface PrintDesign {
  accent: string;
  fontPt: number;
  columns: { key: string; title: string; widthPct: number; visible: boolean }[];
  sections: { key: string; visible: boolean }[];
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/** طراحیِ کامل با پیش‌فرض‌های schema */
export function defaultDesign(schema: PrintDesignSchema): PrintDesign {
  return {
    accent: schema.accent,
    fontPt: schema.fontPt,
    columns: schema.columns.map((c) => ({ key: c.key, title: c.title, widthPct: c.widthPct, visible: c.visible })),
    sections: schema.sections.map((s) => ({ key: s.key, visible: true })),
  };
}

/** ورودی نامطمئن (از کلاینت/دیتابیس) را به طراحیِ معتبر و کامل تبدیل می‌کند: کلیدهای ناشناخته حذف، کلیدهای جاافتاده با پیش‌فرض اضافه می‌شود */
export function normalizeDesign(schema: PrintDesignSchema, raw: unknown): PrintDesign {
  const base = defaultDesign(schema);
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, any>;

  const accent = typeof r.accent === "string" && HEX.test(r.accent) ? r.accent.toLowerCase() : base.accent;
  const fontNum = Number(r.fontPt);
  const fontPt = Number.isFinite(fontNum) && fontNum >= 6 && fontNum <= 14 ? Math.round(fontNum * 2) / 2 : base.fontPt;

  const colDefs = new Map(schema.columns.map((c) => [c.key, c]));
  const columns: PrintDesign["columns"] = [];
  const seenCols = new Set<string>();
  if (Array.isArray(r.columns)) {
    for (const c of r.columns) {
      const def = c && typeof c.key === "string" ? colDefs.get(c.key) : undefined;
      if (!def || seenCols.has(def.key)) continue;
      seenCols.add(def.key);
      const title = typeof c.title === "string" && c.title.trim() ? c.title.trim().slice(0, 40) : def.title;
      const w = Number(c.widthPct);
      columns.push({
        key: def.key,
        title,
        widthPct: Number.isFinite(w) && w >= 0 && w <= 60 ? Math.round(w * 10) / 10 : def.widthPct,
        visible: c.visible === false ? false : true,
      });
    }
  }
  for (const def of schema.columns) {
    if (!seenCols.has(def.key)) columns.push({ key: def.key, title: def.title, widthPct: def.widthPct, visible: def.visible });
  }
  // دست‌کم یک ستون باید دیده شود
  if (!columns.some((c) => c.visible)) return { ...base, accent, fontPt };

  const secDefs = new Map(schema.sections.map((s) => [s.key, s]));
  const sections: PrintDesign["sections"] = [];
  const seenSecs = new Set<string>();
  if (Array.isArray(r.sections)) {
    for (const s of r.sections) {
      const def = s && typeof s.key === "string" ? secDefs.get(s.key) : undefined;
      if (!def || seenSecs.has(def.key)) continue;
      seenSecs.add(def.key);
      sections.push({ key: def.key, visible: def.locked ? true : s.visible !== false });
    }
  }
  for (const def of schema.sections) {
    if (!seenSecs.has(def.key)) sections.push({ key: def.key, visible: true });
  }
  return { accent, fontPt, columns, sections };
}

/** رنگ متن مناسب روی یک پس‌زمینه (سیاه یا سفید) بر اساس روشنایی */
function textOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#111111" : "#ffffff";
}

/** متغیر `design` که در قالب استفاده می‌شود؛ totals = جمع‌های فرمت‌شده‌ی سند (کلید هم‌نام ستون‌های sum) */
export function buildDesignContext(schema: PrintDesignSchema, raw: unknown, totals: Record<string, any> | undefined) {
  const d = normalizeDesign(schema, raw);
  const defs = new Map(schema.columns.map((c) => [c.key, c]));

  const columns = d.columns
    .filter((c) => c.visible)
    .map((c) => {
      const def = defs.get(c.key)!;
      return {
        key: c.key,
        title: c.title,
        width: c.widthPct > 0 ? `${c.widthPct}%` : "",
        cls: def.text ? "t" : def.numeric ? "n" : "",
        sum: !!def.sum,
      };
    });

  // سطر جمع: سلول برچسب «جمع کل» روی ستون‌های ابتدایی (تا اولین ستون جمع‌شدنی)، سپس برای هر ستون یا جمع آن یا خالی
  const footer: { span: number; text: string; cls: string }[] = [];
  const firstSum = columns.findIndex((c) => c.sum);
  if (firstSum === -1) {
    footer.push({ span: columns.length, text: "جمع کل", cls: "" });
  } else {
    if (firstSum > 0) footer.push({ span: firstSum, text: "جمع کل", cls: "" });
    for (const c of columns.slice(firstSum)) {
      footer.push({ span: 1, text: c.sum ? String(totals?.[c.key] ?? "") : "", cls: c.sum ? "n" : "" });
    }
  }

  const show: Record<string, boolean> = {};
  const order: Record<string, number> = {};
  d.sections.forEach((s, i) => {
    show[s.key] = s.visible;
    order[s.key] = i + 1;
  });

  return {
    accent: d.accent,
    accentText: textOn(d.accent),
    fontPt: d.fontPt,
    columns,
    columnCount: columns.length,
    footer,
    show,
    order,
  };
}
