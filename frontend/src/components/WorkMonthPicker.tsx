import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { toFaDigits } from "../lib/formatAmount";
import { MONTHS_FA } from "../lib/payrollLabels";

// انتخاب «سال و ماه» در فرم‌های حقوق و دستمزد: فقط ماه‌هایی که در «تقویم کاری» (منابع انسانی › تنظیمات) تعریف شده‌اند.
// سال از تقویم‌های موجود و ماه از ماه‌های همان تقویم می‌آید؛ مقدارِ فعلیِ بیرون از تقویم (مثلاً داده‌ی قدیمی) به‌عنوان گزینه‌ی اضافه نمایش داده می‌شود
// تا قابل خواندن باشد. اگر مقدار اولیه در تقویم نباشد، به اولین ماه موجود می‌رود.

interface CalMonth {
  year: number;
  month: number;
}

/** فهرست ماه‌های تقویم کاری (سال نزولی، ماه صعودی) */
export function useWorkCalendarMonths(): { months: CalMonth[]; loaded: boolean } {
  const [months, setMonths] = useState<CalMonth[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    api
      .get("/work-calendars/months")
      .then((r: CalMonth[]) => setMonths(r))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);
  return { months, loaded };
}

export function WorkMonthPicker({
  year,
  month,
  onChange,
  disabled,
  autoFix = true,
}: {
  year: number | string;
  month: number | string;
  onChange: (year: number, month: number) => void;
  disabled?: boolean;
  /** اگر مقدار فعلی در تقویم نبود، خودکار به اولین ماه موجود برود (فرم‌های «انتخاب ماه»؛ برای ویرایش رکورد قدیمی false) */
  autoFix?: boolean;
}) {
  const { months, loaded } = useWorkCalendarMonths();
  const y = Number(year) || 0;
  const m = Number(month) || 0;
  const years = [...new Set(months.map((x) => x.year))];
  const inList = months.some((x) => x.year === y && x.month === m);

  useEffect(() => {
    if (!loaded || !autoFix || inList || months.length === 0) return;
    // ترجیح: ماه جاری اگر هست، وگرنه اولین ماهِ جدیدترین سال
    const first = months.find((x) => x.year === years[0]) ?? months[0];
    onChange(first.year, first.month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, months.length]);

  if (loaded && months.length === 0) {
    return <div style={{ color: "#c0392b", fontSize: 13 }}>تقویم کاری تعریف نشده است؛ ابتدا از «منابع انسانی ← تنظیمات ← تقویم کاری» تقویم سال را بسازید.</div>;
  }
  const yearOptions = y && !years.includes(y) ? [y, ...years] : years;
  const monthsOfYear = months.filter((x) => x.year === y).map((x) => x.month);
  const monthOptions = m && !monthsOfYear.includes(m) ? [...monthsOfYear, m].sort((a, b) => a - b) : monthsOfYear;

  return (
    <div style={{ display: "flex", gap: 6 }}>
      <select
        disabled={disabled}
        value={y || ""}
        onChange={(e) => {
          const ny = Number(e.target.value);
          const ms = months.filter((x) => x.year === ny).map((x) => x.month);
          onChange(ny, ms.includes(m) ? m : ms[0] ?? m);
        }}
        style={{ width: 90 }}
        title="سال (از تقویم کاری)"
      >
        {!y && <option value="">سال</option>}
        {yearOptions.map((v) => <option key={v} value={v}>{toFaDigits(String(v))}{years.includes(v) ? "" : " (بدون تقویم)"}</option>)}
      </select>
      <select disabled={disabled} value={m || ""} onChange={(e) => onChange(y, Number(e.target.value))} style={{ flex: 1 }} title="ماه (از تقویم کاری)">
        {!m && <option value="">ماه</option>}
        {monthOptions.map((v) => <option key={v} value={v}>{MONTHS_FA[v - 1]}{monthsOfYear.includes(v) ? "" : " (بدون تقویم)"}</option>)}
      </select>
    </div>
  );
}
