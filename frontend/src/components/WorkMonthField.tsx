import { useMemo } from "react";
import { RecordPickerField } from "./RecordPicker";
import { useWorkCalendarMonths } from "./WorkMonthPicker";
import { toFaDigits } from "../lib/formatAmount";
import { MONTHS_FA } from "../lib/payrollLabels";

// انتخابگرِ «ماه تقویم کاری» به‌صورت یک فیلد: در دیالوگ انتخاب، سال یک ستون و ماه یک ستون است و با انتخاب یک ردیف، سال و ماه با هم در فیلد می‌نشینند
// (در فرم‌های وام). فقط ماه‌های تعریف‌شده در «تقویم کاری» انتخاب می‌شوند.

interface Row {
  id: string;
  year: number;
  month: number;
}

export const workMonthLabel = (year: number | string, month: number | string) => {
  const y = Number(year);
  const m = Number(month);
  return y && m ? `${toFaDigits(String(y))} ${MONTHS_FA[m - 1]}` : "";
};

export function WorkMonthField({
  year,
  month,
  onChange,
  disabled,
  title = "انتخاب ماه",
  onClear,
}: {
  year: number | string;
  month: number | string;
  onChange: (year: number, month: number) => void;
  disabled?: boolean;
  title?: string;
  onClear?: () => void;
}) {
  const { months } = useWorkCalendarMonths();
  const rows: Row[] = useMemo(
    () => [...months].sort((a, b) => a.year - b.year || a.month - b.month).map((x) => ({ id: `${x.year}-${x.month}`, year: x.year, month: x.month })),
    [months]
  );
  return (
    <RecordPickerField<Row>
      title={title}
      disabled={disabled}
      displayValue={workMonthLabel(year, month)}
      rows={rows}
      columns={[
        { header: "سال", render: (r) => toFaDigits(String(r.year)), filterValue: (r) => `${r.year} ${toFaDigits(String(r.year))}`, width: "110px" },
        { header: "ماه", render: (r) => MONTHS_FA[r.month - 1], filterValue: (r) => MONTHS_FA[r.month - 1] },
      ]}
      onSelect={(r) => onChange(r.year, r.month)}
      onClear={onClear}
      placeholder="انتخاب ماه"
    />
  );
}
