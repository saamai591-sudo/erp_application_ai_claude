import { toFaDigits } from "./formatAmount";
import { toEnglishDigits } from "./digits";
import * as XLSX from "xlsx";

// «خروجی اکسل» و «چاپ» مشترک همه‌ی جدول‌های پروژه (DataTable و SelectableBalanceTable) — طبق درخواست
// کاربر («می‌خواهم همین امکانات در همه‌ی گریدهای پروژه باشد») و به‌صورت پایه/base، یعنی هر گرید جدیدی
// که بعداً ساخته شود هم با استفاده از همین توابع (نه پیاده‌سازی جدا)، همین امکان را به‌صورت خودکار دارد.

export interface ExportColumn<T> {
  header: string;
  render: (row: T) => any;
  /** مقدار خام قابل‌نمایش وقتی render() چیزی غیر از رشته/عدد (مثلاً JSX یک بج) برمی‌گرداند */
  filterValue?: (row: T) => string | number | null | undefined;
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
export function cellText<T>(col: ExportColumn<T>, row: T): string {
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
export function toExcelCell(raw: any, text: string, numericColumn: boolean): ExcelCell {
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

export function exportGridToExcel<T>(columns: ExportColumn<T>[], rows: T[], gridName: string) {
  // طبق درخواست صریح کاربر: ارقام در خروجی اکسل نباید فارسی باشند؛ و مقادیر رشته‌ایِ فقط‌رقمی (00001 و...)
  // باید دقیقاً به‌صورت متن بروند تا صفرهای ابتدایی حذف نشود، در حالی‌که مبلغ/تعداد/نرخ عدد می‌مانند.
  // این تنها نقطه‌ی خروجی اکسلِ همه‌ی گریدها (DataTable/SelectableBalanceTable/LineGridToolbar/BulkErrorDialog) است.
  const header: ExcelCell[] = columns.map((c) => c.header);
  const dataRows = rows.map((row) =>
    columns.map((c) => {
      const rendered = c.render(row);
      const raw = typeof rendered === "string" || typeof rendered === "number" ? rendered : c.filterValue ? c.filterValue(row) : undefined;
      return toExcelCell(raw, cellText(c, row), isNumericColumn(c));
    })
  );
  downloadExcel([header, ...dataRows], gridName);
}

/** نام قدیمی (پیش از این خروجی CSV بود)؛ برای سازگاری با فراخوانی‌های موجود */
export const exportGridToCsv = exportGridToExcel;

export function printGrid<T>(columns: ExportColumn<T>[], rows: T[], gridName: string) {
  const win = window.open("", "_blank", "width=1000,height=700");
  if (!win) return;
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const header = columns.map((c) => `<th>${escape(c.header)}</th>`).join("");
  const body = rows.map((row) => `<tr>${columns.map((c) => `<td>${escape(cellText(c, row))}</td>`).join("")}</tr>`).join("");
  win.document.write(`<!doctype html>
    <html dir="rtl" lang="fa"><head><meta charset="utf-8" /><title>${escape(gridName)}</title>
    <style>
      body { font-family: Tahoma, "Segoe UI", Arial, sans-serif; padding: 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: right; }
      th { background: #f3f4f6; font-weight: 600; }
    </style></head>
    <body><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></body></html>`);
  win.document.close();
  win.focus();
  win.print();
}
