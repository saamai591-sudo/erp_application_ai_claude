import { toFaDigits } from "./formatAmount";
import { toEnglishDigits } from "./digits";
import * as XLSX from "xlsx";
import { fetchBranding } from "./branding";
import { formKeyForPath, formTitleForKey } from "./frequentDescriptionForms";
import { formatDisplayDate } from "./formatDate";

// «خروجی اکسل» و «چاپ» مشترک همه‌ی جدول‌های پروژه (DataTable و SelectableBalanceTable) — طبق درخواست
// کاربر («می‌خواهم همین امکانات در همه‌ی گریدهای پروژه باشد») و به‌صورت پایه/base، یعنی هر گرید جدیدی
// که بعداً ساخته شود هم با استفاده از همین توابع (نه پیاده‌سازی جدا)، همین امکان را به‌صورت خودکار دارد.

export interface ExportColumn<T> {
  header: string;
  render: (row: T) => any;
  /** مقدار خام قابل‌نمایش وقتی render() چیزی غیر از رشته/عدد (مثلاً JSX یک بج) برمی‌گرداند */
  filterValue?: (row: T) => string | number | null | undefined;
  /** مقدار خام «علامت‌دار» برای خروجی اکسل/چاپ، وقتی نمایش گرید با filterValue (اندازه‌ی مثبت) فرق دارد — مثلاً ستون «صادره» که در گرید به
   * فرمت حسابداری (پرانتز و قرمز = منفی) دیده می‌شود: در اکسل باید همان مقدار منفی برود. اگر داده شود بر render/filterValue اولویت دارد. */
  exportValue?: (row: T) => string | number | null | undefined;
  /** ستون عددی واقعی (از Column<T>): در اکسل عدد می‌ماند، نه متن */
  filterType?: "string" | "number" | "date";
  decimal?: boolean;
}

/** طبق درخواست کاربر: نام فایل خروجی/عنوان چاپ باید «نام سیستمی گرید» باشد (مثلاً Warehouse-review
 * برای مسیر /warehousing/warehouse-review) — از آخرین قطعه‌ی مسیر مشتق می‌شود تا بدون نیاز به تغییر
 * دستیِ هر صفحه، خودکار روی هر گریدی (فعلی یا آینده) درست کار کند */
export function deriveGridName(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1] || "grid";
  return last.charAt(0).toUpperCase() + last.slice(1);
}

function toDisplayText(value: any): string {
  if (typeof value === "number") return toFaDigits(String(value));
  if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value.trim())) return toFaDigits(value);
  return typeof value === "string" ? value : "";
}

/** نسخه‌ی متنی خالص هر سلول: اگر render() مستقیم رشته/عدد برگرداند همان (دقیقاً همان چیزی که کاربر
 * می‌بیند)؛ اگر JSX برگرداند (مثل بج وضعیت یا مبلغ رنگی)، به filterValue برمی‌گردد که طبق قرارداد
 * همین کدبیس همیشه معادل متنیِ همان ستون است */
function cellText<T>(col: ExportColumn<T>, row: T): string {
  if (col.exportValue) {
    const ev = col.exportValue(row);
    return ev === null || ev === undefined ? "" : toDisplayText(ev);
  }
  const rendered = col.render(row);
  if (typeof rendered === "string" || typeof rendered === "number") return toDisplayText(rendered);
  if (col.filterValue) {
    const v = col.filterValue(row);
    return v === null || v === undefined ? "" : toDisplayText(v);
  }
  return "";
}

export type ExcelCell = string | number | null;

/** ستونی که عددیِ واقعی است (مبلغ/تعداد/نرخ/جمع) و باید در اکسل عدد بماند */
function isNumericColumn<T>(col: ExportColumn<T>): boolean {
  return col.filterType === "number" || col.decimal === true;
}

/**
 * تبدیل مقدار هر سلول به نوع درست اکسل (فقط فرمت خروجی؛ مقدار دیتابیس/نوع فیلد تغییری نمی‌کند):
 *  - مقدار عددیِ واقعی (number در render، یا ستون filterType=number/decimal) ⇒ عدد اکسل (قابل محاسبه)
 *  - رشته‌ی فقط‌رقمی در ستون متنی (مثل 00001، 00125، 01003 یا کد/شماره) ⇒ متن، با حفظ دقیق صفر‌های ابتدایی
 *  - رشته‌ی عددیِ فرمت‌شده با جداکننده/اعشار (مثل 1,234.50) در ستونی که نوع مشخص ندارد ⇒ عدد (همان رفتار قبلی)
 *  - هر چیز دیگر ⇒ متن
 */
function toExcelCell(raw: any, text: string, numericColumn: boolean): ExcelCell {
  const t = toEnglishDigits(text);
  if (t === "") return "";
  const asNumber = (s: string) => {
    const n = Number(s.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  };
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : t;
  if (numericColumn) {
    if (/^-?0\d/.test(t)) return t; // صفر ابتدایی (00125) هرگز عدد نمی‌شود، حتی در ستونی که filterType=number دارد
    if (/^-?\d+(\.\d+)?$/.test(t) || /^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) return asNumber(t) ?? t;
    return t;
  }
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t) || /^-?(0|[1-9]\d*)\.\d+$/.test(t)) return asNumber(t) ?? t;
  return t; // شامل رشته‌ی فقط‌رقمی ⇒ متن
}

/** نوشتن آرایه‌ی سطر/ستون در فایل xlsx با نوع دقیق هر سلول (متن همیشه t:"s"، عدد t:"n") */
export function downloadExcel(rows: ExcelCell[][], fileName: string, sheetName = "Sheet1") {
  const ws: XLSX.WorkSheet = {};
  let maxC = 0;
  rows.forEach((row, r) => {
    maxC = Math.max(maxC, row.length - 1);
    row.forEach((v, c) => {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (typeof v === "number") ws[addr] = { t: "n", v };
      else ws[addr] = { t: "s", v: v ?? "", z: "@" };
    });
  });
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(rows.length - 1, 0), c: maxC } });
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31) || "Sheet1");
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

function exportGridToExcel<T>(columns: ExportColumn<T>[], rows: T[], gridName: string) {
  // طبق درخواست صریح کاربر: ارقام در خروجی اکسل نباید فارسی باشند؛ و مقادیر رشته‌ایِ فقط‌رقمی (00001 و...)
  // باید دقیقاً به‌صورت متن بروند تا صفرهای ابتدایی حذف نشود، در حالی‌که مبلغ/تعداد/نرخ عدد می‌مانند.
  // این تنها نقطه‌ی خروجی اکسلِ همه‌ی گریدها (DataTable/SelectableBalanceTable/LineGridToolbar/BulkErrorDialog) است.
  const header: ExcelCell[] = columns.map((c) => c.header);
  const dataRows = rows.map((row) =>
    columns.map((c) => {
      const rendered = c.render(row);
      if (c.exportValue) {
        const ev = c.exportValue(row);
        return toExcelCell(ev, cellText(c, row), isNumericColumn(c));
      }
      const raw = typeof rendered === "string" || typeof rendered === "number" ? rendered : c.filterValue ? c.filterValue(row) : undefined;
      return toExcelCell(raw, cellText(c, row), isNumericColumn(c));
    })
  );
  downloadExcel([header, ...dataRows], gridName);
}

/** نام قدیمی (پیش از این خروجی CSV بود)؛ برای سازگاری با فراخوانی‌های موجود */
export const exportGridToCsv = exportGridToExcel;

/** تاریخ امروز (ساعت محلی مرورگر) به قالب ISO برای formatDisplayDate */
function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** @page margin-boxها (شماره‌ی صفحه با counter(page)/counter(pages)) از Chrome/Edge 131 به بعد پشتیبانی می‌شوند؛ مرورگرهای دیگر سرتیتر را در thead تکرارشونده می‌گیرند (بدون شماره‌ی صفحه) */
function supportsPageMarginBoxes(): boolean {
  const m = /(?:Chrome|Chromium|Edg)\/(\d+)/.exec(navigator.userAgent);
  return !!m && Number(m[1]) >= 131;
}

/**
 * چاپ مشترک همه‌ی گریدها. سرتیتر هر صفحه: نام شرکت (مشخصات شرکت)، عنوان گزارش (عنوان فرم در منو؛ یا `title`)، تاریخ گزارش و «صفحه n از m».
 * window.open باید هم‌زمان با کلیک کاربر باشد، پس پنجره اول باز می‌شود و نام شرکت بعد از دریافت نوشته می‌شود.
 */
export async function printGrid<T>(columns: ExportColumn<T>[], rows: T[], gridName: string, title?: string) {
  const win = window.open("", "_blank", "width=1000,height=700");
  if (!win) return;
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const cssStr = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]+/g, " ");
  win.document.write('<!doctype html><html dir="rtl"><body style="font-family:Tahoma,Arial;padding:16px">در حال آماده‌سازی چاپ…</body></html>');
  const company = (await fetchBranding()).name;
  const reportTitle = title || formTitleForKey(formKeyForPath(window.location.pathname)) || gridName;
  const reportDate = formatDisplayDate(todayIso());
  const margin = supportsPageMarginBoxes();
  const header = columns.map((c) => `<th>${escape(c.header)}</th>`).join("");
  const body = rows.map((row) => `<tr>${columns.map((c) => `<td>${escape(cellText(c, row))}</td>`).join("")}</tr>`).join("");
  const pageCss = margin
    ? `@page { margin: 18mm 10mm 12mm;
        @top-right { content: "${cssStr(company)}"; font: 600 11px Tahoma, Arial; }
        @top-center { content: "${cssStr(reportTitle)}"; font: 700 13px Tahoma, Arial; }
        @top-left { content: "تاریخ گزارش: ${cssStr(toFaDigits(reportDate))}   صفحه " counter(page, persian) " از " counter(pages, persian); font: 11px Tahoma, Arial; }
      }`
    : "@page { margin: 12mm 10mm; }";
  const colCount = columns.length;
  const headRow = margin
    ? ""
    : `<tr class="rh"><th colspan="${colCount}"><div class="rhd"><span>${escape(company)}</span><b>${escape(reportTitle)}</b><span>تاریخ گزارش: ${escape(toFaDigits(reportDate))}</span></div></th></tr>`;
  win.document.open();
  win.document.write(`<!doctype html>
    <html dir="rtl" lang="fa"><head><meta charset="utf-8" /><title>${escape(reportTitle)}</title>
    <style>
      ${pageCss}
      body { font-family: Tahoma, "Segoe UI", Arial, sans-serif; padding: 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; }
      th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: right; }
      th { background: #f3f4f6; font-weight: 600; }
      tr.rh th { background: #fff; border: 0; border-bottom: 2px solid #999; font-size: 12px; }
      .rhd { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
      @media print { body { padding: 0; } }
    </style></head>
    <body><table><thead>${headRow}<tr>${header}</tr></thead><tbody>${body}</tbody></table></body></html>`);
  win.document.close();
  win.focus();
  win.print();
}
