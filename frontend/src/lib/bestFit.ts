// «Best Fit» (تنظیم خودکار عرض ستون‌ها) — کاملاً سمت کلاینت و فقط برای نمایش فعلی: عرض هر ستون به‌اندازه‌ی بزرگ‌ترین مقدار
// همان ستون (سرستون + همه‌ی ردیف‌های رندرشده‌ی صفحه‌ی جاری) اندازه‌گیری می‌شود. هیچ‌چیز ذخیره یا به بک‌اند/تنظیمات گرید/عرض پیش‌فرض
// ستون‌ها فرستاده نمی‌شود؛ نتیجه فقط در state خودِ کامپوننت گرید می‌ماند و با عوض‌شدن صفحه/فیلتر/مرتب‌سازی/داده پاک می‌شود.
//
// روش اندازه‌گیری: یک کپی نامرئی از همان <table> (با همان کلاس‌ها و استایل‌های CSS، چون داخل همان والد قرار می‌گیرد) با چیدمان
// «auto» و بدون شکستن خط ساخته می‌شود؛ در چنین چیدمانی مرورگر خودش عرض هر ستون را برابر عریض‌ترین سلولش (به‌همراه padding) می‌کند.
// کپی بلافاصله حذف می‌شود؛ جدول اصلی و DOM قابل‌مشاهده دست نمی‌خورند.

/** عرض طبیعیِ هر سلول سرستون (px)، به ترتیب، بر اساس محتوای رندرشده‌ی فعلی جدول. */
export function measureBestFitWidths(table: HTMLTableElement | null | undefined): number[] {
  if (!table) return [];
  const host = table.parentElement ?? document.body;
  const clone = table.cloneNode(true) as HTMLTableElement;
  clone.classList.add("bestfit-measure");
  clone.removeAttribute("id");
  // فیلدهای ویرایشی (input/select/textarea) در کپی با متنِ واقعیِ مقدارشان جایگزین می‌شوند تا عرض ستون به‌اندازه‌ی «مقدار» باشد،
  // نه عرض پیش‌فرض خودِ فیلد. (cloneNode مقدار زنده‌ی فیلد را کپی نمی‌کند، پس از عنصر اصلیِ هم‌ترتیب خوانده می‌شود.)
  const FIELDS = "input:not([type=checkbox]):not([type=radio]):not([type=hidden]), select, textarea";
  const originals = Array.from(table.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(FIELDS));
  const clones = Array.from(clone.querySelectorAll<HTMLElement>(FIELDS));
  clones.forEach((el, i) => {
    const src = originals[i];
    if (!src) return;
    const text = src instanceof HTMLSelectElement ? src.selectedOptions[0]?.text ?? "" : src.value ?? "";
    const span = document.createElement("span");
    span.textContent = text;
    span.style.display = "inline-block";
    span.style.padding = "0 20px";
    span.style.whiteSpace = "nowrap";
    el.replaceWith(span);
  });
  host.appendChild(clone);
  try {
    const headerCells = clone.querySelectorAll<HTMLElement>("thead tr:first-child > th, thead tr:first-child > td");
    return Array.from(headerCells).map((c) => Math.max(24, Math.ceil(c.getBoundingClientRect().width)));
  } finally {
    host.removeChild(clone);
  }
}

/** جمع عرض‌ها؛ برای تعیین عرض کل جدولِ با چیدمان ثابت. */
export function sumWidths(widths: number[]): number {
  return widths.reduce((a, w) => a + w, 0);
}
