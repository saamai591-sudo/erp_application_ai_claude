import { prisma } from "../lib/prisma";
import { displayDate } from "../utils/dateDisplay";
import { wrapPrintHtml } from "./printService";
import { BalanceInput, BalanceResult, computeAccountBalance } from "./accountBalanceService";

// چاپ «تراز حسابها» مطابق قالب‌های mrt (`Documents/فرمتهای تراز حسابها`): ۲ ستونی (مانده)، ۴ ستونی (گردش + مانده)، ۶ ستونی (مانده اول دوره + گردش + مانده پایان دوره)،
// هر کدام با ستون‌های کد/عنوان، سربرگ (نام شرکت، عنوان گزارش، تاریخ چاپ، از/تا تاریخ) و ردیف «جمع کل». ترازِ یک‌سطحی دقیقاً همان ستون‌ها را دارد؛
// تراز تحلیلی همان ستون‌ها را با تورفتگی سطرها و ردیف جمع سطح اول نشان می‌دهد.

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const money = (v: number) => (v ? v.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "0");

export type BalanceColumns = 2 | 4 | 6;

export async function printAccountBalance(input: BalanceInput & { columns: BalanceColumns; digits?: "LATIN" | "PERSIAN" }) {
  const result: BalanceResult = await computeAccountBalance(input);
  const company = await prisma.companyProfile.findUnique({ where: { id: 1 } });
  const cols = input.columns;
  const heads = result.dimTitles;
  const kindTitle = input.kind === "TRIAL" ? heads[0] : "تحلیلی";
  const title = `تراز ${kindTitle} ${cols === 2 ? "دو" : cols === 4 ? "چهار" : "شش"} ستونی`;

  type Grp = { title: string; d: (r: any) => number; c: (r: any) => number };
  const groups: Grp[] = [];
  if (cols === 6) groups.push({ title: "مانده اول دوره", d: (r) => r.openDebit, c: (r) => r.openCredit });
  if (cols >= 4) groups.push({ title: "گردش طی دوره", d: (r) => r.periodDebit, c: (r) => r.periodCredit });
  groups.push({ title: cols === 6 ? "مانده پایان دوره" : "مانده", d: (r) => r.remainDebit, c: (r) => r.remainCredit });
  // در قالب‌ها ترتیب از راست به چپ: اول دوره، گردش، پایان دوره (RTL خودکار)

  const head1 = `<th rowspan="2" style="width:14mm">کد ${esc(input.kind === "TRIAL" ? heads[0] : "")}</th><th rowspan="2">عنوان ${esc(input.kind === "TRIAL" ? heads[0] : "")}</th>` + groups.map((g) => `<th colspan="2">${g.title}</th>`).join("");
  const head2 = groups.map(() => "<th>بدهکار</th><th>بستانکار</th>").join("");
  const body = result.rows
    .map((r) => {
      const cells = groups.map((g) => `<td class="n">${money(g.d(r))}</td><td class="n">${money(g.c(r))}</td>`).join("");
      const indent = input.kind === "ANALYTIC" ? `padding-right:${r.depth * 5 + 1}mm;` : "";
      const tag = input.kind === "ANALYTIC" ? `<span class="tag">${esc(r.dimTitle)}</span> ` : "";
      const cls = input.kind === "ANALYTIC" && r.hasChildren ? ' class="b"' : "";
      return `<tr${cls}><td class="c">${esc(r.code)}</td><td style="${indent}">${tag}${esc(r.title)}</td>${cells}</tr>`;
    })
    .join("");
  const totalRow = `<tr class="tot"><td colspan="2">جمع کل</td>${groups.map((g) => `<td class="n">${money(g.d({ ...result.totals }))}</td><td class="n">${money(g.c({ ...result.totals }))}</td>`).join("")}</tr>`;

  const css = `
.hdr { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:3mm; font-size:9pt; }
.hdr .mid { text-align:center; flex:1; }
.hdr h1 { margin:0; font-size:13pt; } .hdr h2 { margin:1mm 0 0; font-size:11pt; font-weight:bold; }
table.bal { width:calc(100% - 1mm); margin:0 0.5mm; border-collapse:collapse; font-size:8.5pt; border:0.3mm solid #444; }
table.bal th, table.bal td { border:0.3mm solid #444; padding:0.8mm 1.2mm; }
table.bal th { background:#e9e9ef; text-align:center; }
table.bal td.n { text-align:right; direction:ltr; white-space:nowrap; }
table.bal td.c { text-align:center; white-space:nowrap; }
table.bal tr.b td { font-weight:bold; background:#f5f5f9; }
table.bal tr.tot td { font-weight:bold; background:#e9e9ef; }
table.bal thead { display:table-header-group; } table.bal tr { page-break-inside:avoid; }
.tag { font-size:7pt; color:#666; }
`;
  const today = displayDate(new Date());
  const html = wrapPrintHtml(
    `<style>${css}</style>
<div class="hdr">
  <div>تاریخ: ${today}</div>
  <div class="mid"><h1>${esc(company?.name ?? "")}</h1><h2>${title}</h2>
    <div>از تاریخ: ${displayDate(input.fromDate)} &nbsp;&nbsp; تا تاریخ: ${displayDate(input.toDate)}</div></div>
  <div></div>
</div>
<table class="bal"><thead><tr>${head1}</tr><tr>${head2}</tr></thead><tbody>${body}${totalRow}</tbody></table>`,
    { title, paper: "A4", orientation: cols === 6 ? "LANDSCAPE" : "PORTRAIT", marginMm: 8, digits: input.digits ?? "PERSIAN" }
  );
  return { html, fileName: title, count: result.rows.length };
}
