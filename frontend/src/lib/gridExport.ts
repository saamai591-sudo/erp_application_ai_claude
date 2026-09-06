import { toFaDigits } from "./formatAmount";
import { toEnglishDigits } from "./digits";

// «خروجی اکسل» و «چاپ» مشترک همه‌ی جدول‌های پروژه (DataTable و SelectableBalanceTable) — طبق درخواست
// کاربر («می‌خواهم همین امکانات در همه‌ی گریدهای پروژه باشد») و به‌صورت پایه/base، یعنی هر گرید جدیدی
// که بعداً ساخته شود هم با استفاده از همین توابع (نه پیاده‌سازی جدا)، همین امکان را به‌صورت خودکار دارد.

export interface ExportColumn<T> {
  header: string;
  render: (row: T) => any;
  /** مقدار خام قابل‌نمایش وقتی render() چیزی غیر از رشته/عدد (مثلاً JSX یک بج) برمی‌گرداند */
  filterValue?: (row: T) => string | number | null | undefined;
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

export function exportGridToCsv<T>(columns: ExportColumn<T>[], rows: T[], gridName: string) {
  // طبق درخواست صریح کاربر: ارقام در خروجی اکسل نباید فارسی باشند (تا اکسل آن‌ها را عدد واقعی
  // بشناسد، نه متن) — چه ارقام از toFaDigits همین فایل آمده باشند چه از render()/filterValue() خودِ
  // صفحه (که در ~۷۰ فایل مستقیماً toFaDigits صدا می‌زنند)، اینجا با toEnglishDigits همه به رقم
  // انگلیسی برمی‌گردند؛ چاپ (printGrid) عمداً دست‌نخورده می‌ماند چون آنجا رقم فارسی همان چیزی است که
  // کاربر روی صفحه می‌بیند و درخواست فقط درباره‌ی خروجی اکسل بود
  const header = columns.map((c) => c.header);
  const dataRows = rows.map((row) => columns.map((c) => toEnglishDigits(cellText(c, row))));
  const csv = [header, ...dataRows].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${gridName}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

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
