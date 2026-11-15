import { formatAmountFa } from "../lib/formatAmount";
import type { BalanceTableColumn } from "./SelectableBalanceTable";

/**
 * ستون‌ها/سلول‌های مشترک صفحه‌های مرور (SelectableBalanceTable). قبلاً هر صفحه‌ی مرور SignedCell و numCol خودش را داشت.
 * اعداد منفی به‌شکل متعارف حسابداری (داخل پرانتز و قرمز) نشان داده می‌شوند — کلاس olap-amount-negative در styles.css هست.
 */
export function SignedCell({ value }: { value: number }) {
  const negative = value < 0;
  const text = negative ? `(${formatAmountFa(Math.abs(value))})` : formatAmountFa(value);
  return <span className={negative ? "olap-amount-negative" : undefined}>{text}</span>;
}

/** ستون عددی؛ `signed` منفی‌ها را قرمز/پرانتزی نشان می‌دهد. */
export function numCol<T>(header: string, field: keyof T, signed = false): BalanceTableColumn<T> {
  const val = (r: T) => ((r[field] as unknown as number) || 0);
  return {
    header,
    render: (r) => (signed ? <SignedCell value={val(r)} /> : formatAmountFa(val(r))),
    sortValue: val,
    filterType: "number",
    filterValue: val,
    decimal: true,
  };
}

/** همان numCol ولی مقدار نمایشی/مرتب‌سازی/فیلتر با علامت معکوس (برای «برگشتی»/«تخفیف» که باید منفی دیده شوند). */
export function negatedNumCol<T>(header: string, field: keyof T): BalanceTableColumn<T> {
  const val = (r: T) => -((r[field] as unknown as number) || 0);
  return {
    header,
    render: (r) => <SignedCell value={val(r)} />,
    sortValue: val,
    filterType: "number",
    filterValue: val,
    decimal: true,
  };
}
