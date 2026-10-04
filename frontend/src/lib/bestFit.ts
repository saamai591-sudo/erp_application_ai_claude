// «Best Fit» (تنظیم خودکار عرض ستون‌ها) — کاملاً سمت کلاینت و فقط برای نمایش فعلی: عرض هر ستون به‌اندازه‌ی بزرگ‌ترین مقدار
// همان ستون (سرستون + همه‌ی ردیف‌های رندرشده‌ی صفحه‌ی جاری) اندازه‌گیری می‌شود. هیچ‌چیز ذخیره یا به بک‌اند/تنظیمات گرید/عرض پیش‌فرض
// ستون‌ها فرستاده نمی‌شود؛ نتیجه فقط در state خودِ کامپوننت گرید می‌ماند و با عوض‌شدن صفحه/فیلتر/مرتب‌سازی/داده پاک می‌شود.
//
// روش اندازه‌گیری: یک کپی نامرئی از همان <table> (با همان کلاس‌ها و استایل‌های CSS، چون داخل همان والد قرار می‌گیرد) با چیدمان
// «auto» و بدون شکستن خط ساخته می‌شود؛ در چنین چیدمانی مرورگر خودش عرض هر ستون را برابر عریض‌ترین سلولش (به‌همراه padding) می‌کند.
// کپی بلافاصله حذف می‌شود؛ جدول اصلی و DOM قابل‌مشاهده دست نمی‌خورند.

/** عرض طبیعیِ هر سلول (px) از یک ردیف مشخصِ یک جدول، با چیدمان auto و بدون شکستن خط. کپی داخل والد خودِ همان جدول قرار می‌گیرد تا
 * همان قواعد CSS (padding/فونت) اعمال شوند. */
function measureRowCells(table: HTMLTableElement, rowSelector: string): number[] {
  const host = table.parentElement ?? document.body;
  const clone = table.cloneNode(true) as HTMLTableElement;
  clone.classList.add("bestfit-measure");
  clone.removeAttribute("id");
  host.appendChild(clone);
  try {
    const cells = clone.querySelectorAll<HTMLElement>(rowSelector);
    return Array.from(cells).map((c) => Math.max(24, Math.ceil(c.getBoundingClientRect().width)));
  } finally {
    host.removeChild(clone);
  }
}

/**
 * عرض طبیعیِ هر ستون (px)، به ترتیب، بر اساس محتوای رندرشده‌ی فعلی جدول. اگر جدول ردیف «جمع» پایین گرید (totalsTable) هم دارد، عرض هر ستون
 * برابر بزرگ‌ترینِ (سرستون + همه‌ی ردیف‌ها) و (سلول جمعِ همان ستون) می‌شود تا مقدار جمع هم کامل دیده شود. ستون‌های هر دو جدول هم‌اندیس‌اند.
 */
export function measureBestFitWidths(table: HTMLTableElement | null | undefined, totalsTable?: HTMLTableElement | null): number[] {
  if (!table) return [];
  const widths = measureRowCells(table, "thead tr:first-child > th, thead tr:first-child > td");
  if (!totalsTable) return widths;
  const totals = measureRowCells(totalsTable, "tbody tr:first-child > td, tbody tr:first-child > th");
  return widths.map((w, i) => (i < totals.length ? Math.max(w, totals[i]) : w));
}

/** جمع عرض‌ها؛ برای تعیین عرض کل جدولِ با چیدمان ثابت. */
export function sumWidths(widths: number[]): number {
  return widths.reduce((a, w) => a + w, 0);
}
