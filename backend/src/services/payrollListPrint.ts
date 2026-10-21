import { prisma } from "../lib/prisma";
import { wrapPrintHtml } from "./printService";

// چاپ «لیست حقوق» یک ماه (نمونه‌ها: `Documents/لیست حقوق.pdf` و `Documents/لیست حقوق 2.pdf`): A4 افقی.
// طبقات (مشخصات کارمند | کارکرد | مزایا | کسور | هزینه کارفرما | سایر) همیشه در یک سطرِ عنوان کنار هم‌اند و هیچ طبقه‌ای به خط بعد نمی‌رود؛
// آیتم‌های داخل هر طبقه است که برای جا شدن در عرض صفحه به چند خط می‌شکنند. هر کارمند L خط است (L برای همه‌ی طبقه‌ها یکی است)؛
// آیتم‌های هر طبقه ستون‌به‌ستون در شبکه‌ی «L خط × ⌈n/L⌉ ستون» می‌نشینند (ستون اول: آیتم‌های ۱…L، ستون دوم: L+1…) و عنوان هر آیتم در همان خانه‌ی سطرهای عنوان
// (L سطر زیر سطر طبقه) می‌آید. «سایر» (جمع حقوق و مزایا، جمع کسور، خالص پرداختی) یک طبقه‌ی عادی است و ردیف «جمع کل» در انتها.
// فقط عامل‌های دارای مقدار برای دست‌کم یک کارمند ستون می‌شوند. عرض ستون‌ها از طول واقعی مقدارها/عنوان‌ها برآورد می‌شود و (اندازه‌ی قلم ۸…۶ پوینت، L=۱…۸)
// ترکیبی انتخاب می‌شود که صفحه‌ی چاپی کمتری بخواهد (تساوی: قلم بزرگ‌تر، سپس L کمتر). صفحه‌بندی سمت سرور است (کارمند بین دو صفحه نمی‌شکند).
// اعداد از فیش ذخیره‌شده خوانده می‌شود (نه محاسبه‌ی دوباره).

const MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const money = (v: number) => Math.round(v).toLocaleString("en-US");
const hhmm = (hours: number) => {
  let h = Math.floor(hours + 1e-9);
  let m = Math.round((hours - h) * 60);
  if (m === 60) { h += 1; m = 0; }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};
function valueText(amount: number, valueType: string | undefined): string {
  if (valueType === "TIME") return hhmm(amount);
  if (valueType === "DAYS" || valueType === "NUMBER") return String(Math.round(amount * 100) / 100);
  return money(amount);
}

type Sec = "INFO" | "WORK" | "EARNING" | "DEDUCTION" | "EMPLOYER_COST" | "OTHER";
const SEC_TITLE: Record<Sec, string> = { INFO: "مشخصات کارمند", WORK: "کارکرد", EARNING: "مزایا", DEDUCTION: "کسور", EMPLOYER_COST: "هزینه کارفرما", OTHER: "سایر" };
const SEC_ORDER: Sec[] = ["INFO", "WORK", "EARNING", "DEDUCTION", "EMPLOYER_COST", "OTHER"];

interface Item {
  key: string;
  sec: Sec;
  title: string;
  numeric: boolean;
  valueType?: string;
  seq: number;
  hasValue: boolean;
  /** برای جمع ستون */
  sum: number;
  sumable: boolean;
}

// ── برآورد عرض متن (میلی‌متر) ──
// رقم‌ها ≈ ۰٫۶em، جداکننده‌ها کم‌عرض، حروف فارسی ≈ ۰٫۵۶em؛ ضریب اطمینان برای جلوگیری از سرریز (با اندازه‌گیری واقعی در مرورگر سنجیده شده)
const PT_MM = 0.3528;
function widthEm(s: string): number {
  let w = 0;
  for (const ch of s) {
    if (/[0-9۰-۹]/.test(ch)) w += 0.6;
    else if (ch === "," || ch === ":" || ch === "." || ch === "٬" || ch === "٫") w += 0.3;
    else if (ch === " ") w += 0.28;
    else if (ch === "-" || ch === "*") w += 0.4;
    else w += 0.56;
  }
  return w * 1.08;
}
const PAD_X = 1.2; // مجموع فاصله‌ی چپ و راست سلول (mm)
const MAX_LINES = 8;

function titleLines(title: string, innerMm: number, em: number): number {
  const words = title.split(" ");
  let lines = 1;
  let cur = 0;
  const space = 0.28 * em;
  for (const w of words) {
    const ww = widthEm(w) * em;
    if (cur === 0) cur = ww;
    else if (cur + space + ww <= innerMm) cur += space + ww;
    else { lines++; cur = ww; }
  }
  return lines;
}

interface GroupPlan {
  sec: Sec;
  cols: number;
  /** slots[خط][ستون] */
  slots: (Item | null)[][];
  widths: number[];
}
interface Plan {
  fontPt: number;
  lines: number;
  groups: GroupPlan[];
  feasible: boolean;
  /** ضریب کشیدن (≥۱) یا فشردن (<۱، جا نشده) عرض ستون‌ها تا عرض قابل‌چاپ */
  scale: number;
  perPage: number;
  pages: number;
}

function makePlan(groups: { sec: Sec; items: Item[] }[], itemMinW: Map<string, number>, fontPt: number, L: number, employees: number, usableW: number, usableH: number): Plan {
  const em = fontPt * PT_MM;
  const tEm = (fontPt - 0.5) * PT_MM;
  const gps: GroupPlan[] = groups.map((g) => {
    const cols = Math.ceil(g.items.length / L);
    const slots: (Item | null)[][] = Array.from({ length: L }, () => Array<Item | null>(cols).fill(null));
    g.items.forEach((it, k) => {
      slots[k % L][Math.floor(k / L)] = it; // ستون‌به‌ستون
    });
    const widths = Array.from({ length: cols }, (_, j) => Math.max(4, ...slots.map((line) => (line[j] ? itemMinW.get(line[j]!.key) ?? 4 : 4))));
    return { sec: g.sec, cols, slots, widths };
  });
  const total = gps.reduce((a, g) => a + g.widths.reduce((x, y) => x + y, 0), 0);
  const scale = usableW / total;
  const rowH = (em * 1.3 + 0.5) * 1.03; // خط ۱٫۳ + فاصله/حاشیه‌ی سلول؛ با اندازه‌گیری واقعی در مرورگر (۴٫۲۳mm در ۸pt) سنجیده شده
  let headerH = rowH;
  for (let l = 0; l < L; l++) {
    let maxLines = 1;
    gps.forEach((g) => g.slots[l].forEach((it, j) => { if (it) maxLines = Math.max(maxLines, titleLines(it.title, g.widths[j] * scale - PAD_X, tEm)); }));
    headerH += maxLines * tEm * 1.35 + 1.0;
  }
  const perPage = Math.max(1, Math.floor((usableH - headerH) / (L * rowH)));
  const pages = Math.max(1, Math.ceil((employees + 1) / perPage)); // +۱ برای ردیف جمع کل
  return { fontPt, lines: L, groups: gps, feasible: scale >= 0.999, scale, perPage, pages };
}

const CSS = (p: Plan) => {
  const tPt = p.fontPt - 0.5;
  return `
.page { font-size: ${p.fontPt}pt; line-height: 1.3; break-after: page; page-break-after: always; }
.page:last-child { break-after: auto; page-break-after: auto; }
.ph { display: flex; justify-content: space-between; align-items: baseline; font-weight: 700; font-size: ${p.fontPt + 2}pt; margin: 0 0 1.5mm; }
.ph .m { font-weight: 400; font-size: ${p.fontPt}pt; }
.page table { width: 100%; border-collapse: collapse; table-layout: fixed; border-right: 0.4mm solid #000; border-left: 0.4mm solid #000; }
.page td, .page th { border: 0.15mm solid #777; padding: 0.15mm 0.6mm; overflow: hidden; }
.page td { white-space: nowrap; }
.page th { font-size: ${tPt}pt; font-weight: 700; text-align: center; background: #ececec; line-height: 1.3; }
.page th.g { background: #d3d3d3; font-size: ${p.fontPt}pt; border-bottom: 0.3mm solid #000; }
.page .gs { border-right: 0.4mm solid #000; }
.page td.n { direction: ltr; text-align: right; font-variant-numeric: tabular-nums; }
.page td.t { text-align: right; }
.page tbody.emp { break-inside: avoid; page-break-inside: avoid; }
.page tbody.emp tr + tr td { border-top-color: #bbb; border-top-style: dotted; }
.page tbody.emp tr:last-child td { border-bottom: 0.35mm solid #000; }
.page tbody.emp:nth-of-type(even) td { background: #f1f1f1; }
.page tbody.tot td { font-weight: 700; background: #e2e2e2 !important; }
.note { margin-top: 1.5mm; font-size: ${tPt}pt; }
@media screen { .page { width: 285mm; margin: 0 auto 6mm; padding: 2mm; border: 1px solid #bbb; background: #fff; } }
`;
};

export interface ListPrintResult {
  html: string;
  fileName: string;
  count: number;
  pages: number;
  /** تعداد خط هر کارمند */
  lines: number;
  fontPt: number;
  /** کارمندان انتخاب‌شده که فیش محاسبه‌شده ندارند */
  missing: number[];
}

export async function buildPayrollListPrint(year: number, month: number, employeeIds: number[] | null, digits: "LATIN" | "PERSIAN" = "PERSIAN", calcTypeId?: number): Promise<ListPrintResult> {
  const calcType = calcTypeId ? await prisma.payrollCalcType.findUnique({ where: { id: calcTypeId } }) : await prisma.payrollCalcType.findFirst({ where: { isBase: true } });
  const docTitle = !calcType || calcType.isBase ? "لیست حقوق" : `لیست ${calcType.title}`;
  const slips = await prisma.payrollSlip.findMany({
    where: { year, month, ...(employeeIds ? { employeeId: { in: employeeIds } } : {}), ...(calcType ? { calcTypeId: calcType.id } : {}) },
    include: {
      lines: { orderBy: { seq: "asc" } },
      employee: { select: { id: true, personnelCode: true, party: { select: { firstName: true, lastName: true, name: true } } } },
    },
    orderBy: { employee: { personnelCode: "asc" } },
  });
  const have = new Set(slips.map((s) => s.employeeId));
  const missing = (employeeIds ?? []).filter((id) => !have.has(id));
  const company = await prisma.companyProfile.findUnique({ where: { id: 1 }, select: { name: true } });
  const title = `${docTitle} ${MONTHS[month - 1]} ${year}`;
  if (slips.length === 0) {
    return { html: wrapPrintHtml("<p>سطری برای چاپ وجود ندارد</p>", { title, paper: "A4", orientation: "LANDSCAPE", marginMm: 6, digits }), fileName: title, count: 0, pages: 0, lines: 0, fontPt: 0, missing };
  }

  // ── آیتم‌ها (ستون‌ها) ──
  const itemMap = new Map<string, Item>();
  const addItem = (c: Omit<Item, "hasValue" | "sum">, always = false) => {
    const ex = itemMap.get(c.key);
    if (ex) { ex.seq = Math.min(ex.seq, c.seq); return ex; }
    const it: Item = { ...c, hasValue: always, sum: 0 };
    itemMap.set(c.key, it);
    return it;
  };
  addItem({ key: "i:row", sec: "INFO", title: "ردیف", numeric: true, seq: 0, sumable: false }, true);
  addItem({ key: "i:code", sec: "INFO", title: "کد پرسنلی", numeric: false, seq: 1, sumable: false }, true);
  addItem({ key: "i:first", sec: "INFO", title: "نام", numeric: false, seq: 2, sumable: false }, true);
  addItem({ key: "i:last", sec: "INFO", title: "نام خانوادگی", numeric: false, seq: 3, sumable: false }, true);
  addItem({ key: "o:earn", sec: "OTHER", title: "جمع حقوق و مزایا", numeric: true, seq: 1, sumable: true }, true);
  addItem({ key: "o:ded", sec: "OTHER", title: "جمع کسور", numeric: true, seq: 2, sumable: true }, true);
  addItem({ key: "o:net", sec: "OTHER", title: "خالص پرداختی", numeric: true, seq: 3, sumable: true }, true);

  const rows: { cells: Map<string, string>; hasErrors: boolean }[] = [];
  const total = { earn: 0, ded: 0, net: 0 };
  slips.forEach((s, idx) => {
    const cells = new Map<string, string>();
    const p = s.employee.party;
    const first = p.firstName ?? "";
    const last = p.lastName ?? (p.firstName ? "" : p.name ?? "");
    cells.set("i:row", String(idx + 1));
    cells.set("i:code", s.employee.personnelCode);
    cells.set("i:first", first);
    cells.set("i:last", `${last}${s.hasErrors ? " *" : ""}`);
    for (const l of s.lines) {
      if (l.kind !== "WORK" && l.kind !== "EARNING" && l.kind !== "DEDUCTION" && l.kind !== "EMPLOYER_COST") continue; // اطلاعاتی در لیست نمی‌آید
      const amount = Number(l.amount);
      const vt = (l.trace as any)?.valueType as string | undefined;
      const it = addItem({ key: `${l.kind}:${l.source}:${l.refId ?? l.title}`, sec: l.kind as Sec, title: l.title, numeric: true, valueType: vt, seq: l.seq, sumable: true });
      if (l.error) { cells.set(it.key, "خطا"); it.hasValue = true; continue; }
      if (Math.abs(amount) < 1e-9) continue;
      it.hasValue = true;
      it.sum += amount;
      cells.set(it.key, valueText(amount, it.valueType));
    }
    const earn = Number(s.earnings), ded = Number(s.deductions), net = Number(s.netPay);
    total.earn += earn; total.ded += ded; total.net += net;
    cells.set("o:earn", money(earn));
    cells.set("o:ded", money(ded));
    cells.set("o:net", money(net));
    rows.push({ cells, hasErrors: s.hasErrors });
  });
  itemMap.get("o:earn")!.sum = total.earn;
  itemMap.get("o:ded")!.sum = total.ded;
  itemMap.get("o:net")!.sum = total.net;

  const groups = SEC_ORDER.map((sec) => ({
    sec,
    items: [...itemMap.values()].filter((c) => c.sec === sec && c.hasValue).sort((a, b) => a.seq - b.seq),
  })).filter((g) => g.items.length > 0);

  const totalText = (it: Item): string => (it.key === "i:row" ? "جمع کل" : it.key === "i:code" ? `(${slips.length} نفر)` : it.sumable ? valueText(it.sum, it.valueType) : "");

  // ── کمینه‌ی عرض هر آیتم برای هر اندازه‌ی قلم ──
  const itemMinWFor = (fontPt: number): Map<string, number> => {
    const em = fontPt * PT_MM;
    const tEm = (fontPt - 0.5) * PT_MM;
    const out = new Map<string, number>();
    for (const g of groups) {
      for (const it of g.items) {
        const vals = rows.map((r) => r.cells.get(it.key) ?? "");
        const t = totalText(it);
        if (t) vals.push(t + "  "); // جمع کل پررنگ است؛ کمی فاصله‌ی اضافه
        const valW = Math.max(0, ...vals.map((v) => widthEm(v) * em)) + PAD_X;
        const longestWord = Math.max(...it.title.split(" ").map((w) => widthEm(w) * tEm)) + PAD_X;
        out.set(it.key, Math.max(valW, longestWord, 4));
      }
    }
    return out;
  };

  // ── انتخاب (قلم، تعداد خط): کمترین صفحه؛ تساوی: قلم بزرگ‌تر، سپس خط کمتر ──
  const MARGIN = 6;
  const usableW = 297 - 2 * MARGIN - 0.6;
  const usableH = 210 - 2 * MARGIN - 8 - 4; // عنوان صفحه (≈۶mm) + فضای اطمینان/پاورقی
  const maxGroup = Math.max(...groups.map((g) => g.items.length));
  let best: Plan | null = null;
  for (const f of [8, 7.5, 7, 6.5, 6]) {
    const minW = itemMinWFor(f);
    for (let L = 1; L <= Math.min(MAX_LINES, maxGroup); L++) {
      const plan = makePlan(groups, minW, f, L, slips.length, usableW, usableH);
      if (!plan.feasible) continue;
      if (!best || plan.pages < best.pages) best = plan;
    }
  }
  // حتی با قلم ۶ و بیشترین خط جا نشد: ستون‌ها فشرده می‌شوند (سلول‌های پرعرض برش می‌خورند)
  const plan = best ?? makePlan(groups, itemMinWFor(6), 6, Math.min(MAX_LINES, maxGroup), slips.length, usableW, usableH);
  const L = plan.lines;

  // ── HTML ──
  const colgroup = `<colgroup>${plan.groups.map((g) => g.widths.map((w) => `<col style="width:${(w * plan.scale).toFixed(2)}mm">`).join("")).join("")}</colgroup>`;
  const thead =
    `<thead><tr>${plan.groups.map((g) => `<th class="g gs" colspan="${g.cols}">${esc(SEC_TITLE[g.sec])}</th>`).join("")}</tr>` +
    Array.from({ length: L }, (_, l) => `<tr>${plan.groups.map((g) => g.slots[l].map((it, j) => `<th${j === 0 ? ' class="gs"' : ""}>${it ? esc(it.title) : ""}</th>`).join("")).join("")}</tr>`).join("") +
    `</thead>`;
  const block = (get: (it: Item) => string, cls: string) =>
    `<tbody class="emp ${cls}">${Array.from({ length: L }, (_, l) => `<tr>${plan.groups.map((g) => g.slots[l].map((it, j) => `<td class="${it && it.numeric ? "n" : "t"}${j === 0 ? " gs" : ""}">${it ? esc(get(it)) : ""}</td>`).join("")).join("")}</tr>`).join("")}</tbody>`;

  const items: ((typeof rows)[number] | null)[] = [...rows, null]; // «جمع کل» آخرین آیتم صفحه‌بندی است
  const pagesHtml: string[] = [];
  for (let pi = 0; pi < plan.pages; pi++) {
    const isLast = pi === plan.pages - 1;
    const body = items
      .slice(pi * plan.perPage, (pi + 1) * plan.perPage)
      .map((r) => (r ? block((it) => r.cells.get(it.key) ?? "", "") : block((it) => totalText(it), "tot")))
      .join("");
    pagesHtml.push(
      `<div class="page"><div class="ph"><span>${esc(company?.name ?? "")}</span><span>${esc(docTitle)} ماه ${MONTHS[month - 1]} سال ${year}</span><span class="m">صفحه ${pi + 1} از ${plan.pages}</span></div><table>${colgroup}${thead}${body}</table>${isLast && rows.some((r) => r.hasErrors) ? `<div class="note">* محاسبه‌ی فیش این کارمند در برخی عوامل خطا داشته و جمع‌ها ناقص است.</div>` : ""}</div>`
    );
  }
  const html = wrapPrintHtml(`<style>${CSS(plan)}</style>${pagesHtml.join("")}`, { title, paper: "A4", orientation: "LANDSCAPE", marginMm: MARGIN, digits });
  return { html, fileName: title, count: slips.length, pages: plan.pages, lines: L, fontPt: plan.fontPt, missing };
}
