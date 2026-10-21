import { prisma } from "../lib/prisma";
import { wrapPrintHtml } from "./printService";

// چاپ «لیست حقوق» یک ماه (نمونه: `Documents/لیست حقوق.pdf`): A4 افقی، گروه‌های ستونی به ترتیب
// مشخصات کارمند | کارکرد | مزایا | کسور | هزینه کارفرما | سایر (جمع مزایا، جمع کسور، خالص پرداختی) و ردیف «جمع کل».
// عامل‌ها ستون‌اند و فقط ستونی می‌آید که برای دست‌کم یک کارمند مقدار دارد. چون تعداد ستون‌ها به عامل‌های مشتری بستگی دارد، ستون‌ها
// خودکار در «نوار» (band) چیده می‌شوند: هر کارمند چند ردیفِ زیر هم است و هر ردیف تکه‌ای از ستون‌ها را با همان ترتیب گروه‌ها دارد
// (حریصانه از راست پر می‌شود تا تعداد نوارها کمینه شود). اندازه‌ی ستون‌ها از طول واقعی مقدارها و عنوان‌ها برآورد می‌شود و اندازه‌ی قلم
// (۶ تا ۸ پوینت) طوری انتخاب می‌شود که تعداد صفحه‌ی چاپی کمینه باشد؛ صفحه‌بندی در سرور انجام می‌شود (یک کارمند هیچ‌وقت بین دو صفحه نمی‌شکند).
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

interface Col {
  key: string;
  sec: Sec;
  title: string;
  numeric: boolean;
  valueType?: string;
  seq: number;
  hasValue: boolean;
  /** برای محاسبه‌ی جمع ستون */
  sum: number;
  sumable: boolean;
}

// ── برآورد عرض متن (میلی‌متر) ──
// رقم‌ها ≈ ۰٫۶em، جداکننده‌ها کم‌عرض، حروف فارسی ≈ ۰٫۵۵em؛ ضریب اطمینان برای جلوگیری از سرریز ستون
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

interface Plan {
  fontPt: number;
  bands: Col[][];
  widths: number[][]; // عرض نهایی هر ستون در هر نوار (mm)
  perPage: number;
  pages: number;
  rowH: number;
  headerH: number[];
}

function titleLines(title: string, innerMm: number, em: number): number {
  const words = title.split(" ");
  let lines = 1;
  let cur = 0;
  const space = 0.28 * em;
  for (const w of words) {
    const ww = widthEm(w) * em * 1.08;
    if (cur === 0) cur = ww;
    else if (cur + space + ww <= innerMm) cur += space + ww;
    else { lines++; cur = ww; }
  }
  return lines;
}

function makePlan(cols: Col[], texts: Map<string, string[]>, fontPt: number, employees: number, usableW: number, usableH: number): Plan {
  const em = fontPt * PT_MM;
  const tEm = (fontPt - 0.5) * PT_MM;
  const minW = cols.map((c) => {
    const vals = texts.get(c.key) ?? [];
    const valW = Math.max(0, ...vals.map((v) => widthEm(v) * em)) + PAD_X;
    const longestWord = Math.max(...c.title.split(" ").map((w) => widthEm(w) * tEm * 1.08)) + PAD_X;
    return Math.max(valW, longestWord, 4);
  });
  // نوارها: حریصانه به ترتیب ستون‌ها
  const bands: Col[][] = [];
  const bandW: number[][] = [];
  let cur: Col[] = [];
  let curW: number[] = [];
  let sum = 0;
  cols.forEach((c, i) => {
    if (cur.length > 0 && sum + minW[i] > usableW) {
      bands.push(cur);
      bandW.push(curW);
      cur = [];
      curW = [];
      sum = 0;
    }
    cur.push(c);
    curW.push(minW[i]);
    sum += minW[i];
  });
  if (cur.length) { bands.push(cur); bandW.push(curW); }
  // هر نوار تا پر شدن عرض صفحه کشیده می‌شود
  const widths = bandW.map((w) => {
    const total = w.reduce((a, b) => a + b, 0);
    const k = total < usableW ? usableW / total : 1;
    return w.map((x) => x * k);
  });
  const rowH = (em * 1.4 + 0.9) * 1.04;
  const headerH = bands.map((b, bi) => {
    const lines = Math.max(...b.map((c, ci) => titleLines(c.title, widths[bi][ci] - PAD_X, tEm)));
    return rowH + lines * tEm * 1.35 + 1.0;
  });
  const headerTotal = headerH.reduce((a, b) => a + b, 0);
  const block = bands.length * rowH;
  const perPage = Math.max(1, Math.floor((usableH - headerTotal) / block));
  const pages = Math.max(1, Math.ceil((employees + 1) / perPage)); // +۱ برای ردیف جمع کل
  return { fontPt, bands, widths, perPage, pages, rowH, headerH };
}

const CSS = (p: Plan) => {
  const tPt = p.fontPt - 0.5;
  return `
.page { font-size: ${p.fontPt}pt; line-height: 1.3; break-after: page; page-break-after: always; }
.page:last-child { break-after: auto; page-break-after: auto; }
.ph { display: flex; justify-content: space-between; align-items: baseline; font-weight: 700; font-size: ${p.fontPt + 2}pt; margin: 0 0 1.5mm; }
.ph .m { font-weight: 400; font-size: ${p.fontPt}pt; }
.page table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.page td, .page th { border: 0.15mm solid #777; padding: 0.15mm 0.6mm; overflow: hidden; }
.page td { white-space: nowrap; }
.page th { font-size: ${tPt}pt; font-weight: 700; text-align: center; background: #ececec; line-height: 1.3; }
.page th.g { background: #d9d9d9; font-size: ${p.fontPt}pt; }
.page td.n { direction: ltr; text-align: right; font-variant-numeric: tabular-nums; }
.page td.t { text-align: right; }
.emp { break-inside: avoid; page-break-inside: avoid; border-bottom: 0.35mm solid #000; }
.emp table + table td { border-top-color: #bbb; border-top-style: dotted; }
.body .emp:nth-child(even) { background: #f1f1f1; }
.body .emp.tot { font-weight: 700; background: #e2e2e2; border-top: 0.5mm solid #000; }
.note { margin-top: 1.5mm; font-size: ${tPt}pt; }
@media screen { .page { width: 285mm; margin: 0 auto 6mm; padding: 2mm; border: 1px solid #bbb; background: #fff; } }
`;
};

export interface ListPrintResult {
  html: string;
  fileName: string;
  count: number;
  pages: number;
  bands: number;
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
    return { html: wrapPrintHtml("<p>سطری برای چاپ وجود ندارد</p>", { title, paper: "A4", orientation: "LANDSCAPE", marginMm: 6, digits }), fileName: title, count: 0, pages: 0, bands: 0, fontPt: 0, missing };
  }

  // ── ستون‌ها ──
  const colMap = new Map<string, Col>();
  const addCol = (c: Omit<Col, "hasValue" | "sum">) => {
    const ex = colMap.get(c.key);
    if (ex) { ex.seq = Math.min(ex.seq, c.seq); return ex; }
    const col: Col = { ...c, hasValue: false, sum: 0 };
    colMap.set(c.key, col);
    return col;
  };
  addCol({ key: "i:code", sec: "INFO", title: "کد پرسنلی", numeric: false, seq: 0, sumable: false });
  addCol({ key: "i:name", sec: "INFO", title: "نام و نام خانوادگی", numeric: false, seq: 1, sumable: false });
  addCol({ key: "o:earn", sec: "OTHER", title: "جمع حقوق و مزایا", numeric: true, seq: 1, sumable: true });
  addCol({ key: "o:ded", sec: "OTHER", title: "جمع کسور", numeric: true, seq: 2, sumable: true });
  addCol({ key: "o:net", sec: "OTHER", title: "خالص پرداختی", numeric: true, seq: 3, sumable: true });
  for (const k of ["i:code", "i:name", "o:earn", "o:ded", "o:net"]) colMap.get(k)!.hasValue = true;

  type Cell = { text: string; amount: number };
  const rows: { cells: Map<string, Cell>; hasErrors: boolean }[] = [];
  const total = { earn: 0, ded: 0, net: 0 };
  for (const s of slips) {
    const cells = new Map<string, Cell>();
    const p = s.employee.party;
    cells.set("i:code", { text: s.employee.personnelCode, amount: 0 });
    cells.set("i:name", { text: `${[p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || ""}${s.hasErrors ? " *" : ""}`, amount: 0 });
    for (const l of s.lines) {
      if (l.kind !== "WORK" && l.kind !== "EARNING" && l.kind !== "DEDUCTION" && l.kind !== "EMPLOYER_COST") continue; // اطلاعاتی در لیست نمی‌آید
      const amount = Number(l.amount);
      const vt = (l.trace as any)?.valueType as string | undefined;
      const col = addCol({ key: `${l.kind}:${l.source}:${l.refId ?? l.title}`, sec: l.kind as Sec, title: l.title, numeric: true, valueType: vt, seq: l.seq, sumable: true });
      if (l.error) { cells.set(col.key, { text: "خطا", amount: 0 }); col.hasValue = true; continue; }
      if (Math.abs(amount) < 1e-9) continue;
      col.hasValue = true;
      col.sum += amount;
      cells.set(col.key, { text: valueText(amount, col.valueType), amount });
    }
    const earn = Number(s.earnings), ded = Number(s.deductions), net = Number(s.netPay);
    total.earn += earn; total.ded += ded; total.net += net;
    cells.set("o:earn", { text: money(earn), amount: earn });
    cells.set("o:ded", { text: money(ded), amount: ded });
    cells.set("o:net", { text: money(net), amount: net });
    rows.push({ cells, hasErrors: s.hasErrors });
  }
  colMap.get("o:earn")!.sum = total.earn;
  colMap.get("o:ded")!.sum = total.ded;
  colMap.get("o:net")!.sum = total.net;

  const cols = [...colMap.values()]
    .filter((c) => c.hasValue)
    .sort((a, b) => SEC_ORDER.indexOf(a.sec) - SEC_ORDER.indexOf(b.sec) || a.seq - b.seq);
  const totalText = (c: Col): string => (c.key === "i:code" ? "" : c.key === "i:name" ? `جمع کل (${slips.length} نفر)` : c.sumable ? valueText(c.sum, c.valueType) : "");

  // متن‌های هر ستون برای برآورد عرض (مقدارها + ردیف جمع کل که پررنگ‌تر است)
  const texts = new Map<string, string[]>();
  for (const c of cols) {
    const vals = rows.map((r) => r.cells.get(c.key)?.text ?? "");
    const t = totalText(c);
    if (t) vals.push(t + "  "); // جمع کل پررنگ است؛ کمی فاصله‌ی اضافه
    texts.set(c.key, vals);
  }

  // ── انتخاب اندازه‌ی قلم: کمترین تعداد صفحه؛ در تساوی قلم بزرگ‌تر ──
  const MARGIN = 6;
  const usableW = 297 - 2 * MARGIN - 0.6;
  const usableH = 210 - 2 * MARGIN - 11 - 5; // عنوان صفحه + فضای اطمینان/پاورقی
  let best: Plan | null = null;
  for (const f of [8, 7.5, 7, 6.5, 6]) {
    const plan = makePlan(cols, texts, f, slips.length, usableW, usableH);
    if (!best || plan.pages < best.pages) best = plan;
  }
  const plan = best!;

  // ── HTML ──
  const colgroup = (bi: number) => `<colgroup>${plan.widths[bi].map((w) => `<col style="width:${w.toFixed(2)}mm">`).join("")}</colgroup>`;
  const headerHtml = plan.bands
    .map((b, bi) => {
      const groups: { sec: Sec; n: number }[] = [];
      for (const c of b) {
        const last = groups[groups.length - 1];
        if (last && last.sec === c.sec) last.n++;
        else groups.push({ sec: c.sec, n: 1 });
      }
      return `<table>${colgroup(bi)}<thead><tr>${groups.map((g) => `<th class="g" colspan="${g.n}">${esc(SEC_TITLE[g.sec])}</th>`).join("")}</tr><tr>${b.map((c) => `<th>${esc(c.title)}</th>`).join("")}</tr></thead></table>`;
    })
    .join("");
  const rowHtml = (get: (c: Col) => string, cls = "") =>
    `<div class="emp ${cls}">${plan.bands.map((b, bi) => `<table>${colgroup(bi)}<tbody><tr>${b.map((c) => `<td class="${c.numeric ? "n" : "t"}">${esc(get(c))}</td>`).join("")}</tr></tbody></table>`).join("")}</div>`;

  const pagesHtml: string[] = [];
  const items: ((typeof rows)[number] | null)[] = [...rows, null];
  for (let pi = 0; pi < plan.pages; pi++) {
    const isLast = pi === plan.pages - 1;
    // «ردیف جمع کل» آخرین آیتم صفحه‌بندی است (null)، تا هیچ‌وقت تنها از صفحه بیرون نیفتد
    const body = items
      .slice(pi * plan.perPage, (pi + 1) * plan.perPage)
      .map((r) => (r ? rowHtml((c) => r.cells.get(c.key)?.text ?? "") : rowHtml((c) => totalText(c), "tot")))
      .join("");
    const totalRow = "";
    pagesHtml.push(
      `<div class="page"><div class="ph"><span>${esc(company?.name ?? "")}</span><span>${esc(docTitle)} ماه ${MONTHS[month - 1]} سال ${year}</span><span class="m">صفحه ${pi + 1} از ${plan.pages}</span></div>${headerHtml}<div class="body">${body}${totalRow}</div>${isLast && rows.some((r) => r.hasErrors) ? `<div class="note">* محاسبه‌ی فیش این کارمند در برخی عوامل خطا داشته و جمع‌ها ناقص است.</div>` : ""}</div>`
    );
  }
  const html = wrapPrintHtml(`<style>${CSS(plan)}</style>${pagesHtml.join("")}`, { title, paper: "A4", orientation: "LANDSCAPE", marginMm: MARGIN, digits });
  return { html, fileName: title, count: slips.length, pages: plan.pages, bands: plan.bands.length, fontPt: plan.fontPt, missing };
}
