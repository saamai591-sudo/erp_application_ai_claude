import { useEffect, useState } from "react";
import { measureBestFitWidths, sumWidths } from "./bestFit";

/**
 * «Best Fit» برای گریدهایی که خودشان state جدول را نگه می‌دارند (گریدهای ردیفی فرم‌ها). فقط state محلی؛ چیزی ذخیره نمی‌شود.
 * resetKey باید با عوض‌شدن صفحه/ردیف‌های نمایش‌داده‌شده عوض شود تا عرض‌های پیش‌فرض برگردند.
 * استفاده: tableStyle را روی <table> و <BestFitCols widths={widths} /> را اولین فرزند <table> بگذارید و apply را به دکمه‌ی نوار ابزار بدهید.
 */
export function useBestFitColumns(getTable: () => HTMLTableElement | null | undefined, resetKey: string) {
  const [widths, setWidths] = useState<number[] | null>(null);
  useEffect(() => {
    setWidths(null);
  }, [resetKey]);
  function apply() {
    const w = measureBestFitWidths(getTable());
    setWidths(w.length ? w : null);
  }
  const tableStyle = widths ? ({ tableLayout: "fixed", width: sumWidths(widths) } as const) : undefined;
  return { widths, apply, tableStyle };
}
