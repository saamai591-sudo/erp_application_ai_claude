import { useEffect } from "react";
import { WorkMonthPicker } from "./WorkMonthPicker";
import { useWorkCalendarMonthsFull, WorkCalendarMonthFull } from "../lib/useWorkCalendarMonthsFull";
import { localTodayIso } from "../lib/formatDate";

// انتخاب «ماه» در هدر گزارش‌های مدیریت تردد (به‌جای انتخاب تاریخ): فقط ماه‌های «تقویم کاری»؛ پیش‌فرض = ماه جاری، یعنی ماهی که تاریخ امروز بین شروع و پایانش است
// (اگر امروز در هیچ ماه تعریف‌شده‌ای نبود، آخرین ماهِ شروع‌شده، وگرنه اولین ماه). بازه‌ی گزارش‌های روزانه = «بازه‌ی تردد» همان ماه (پیش‌فرض ابتدا/انتهای ماه).

export interface AttendanceMonth {
  year: number;
  month: number;
  /** بازه‌ی تردد ماه */
  from: string;
  to: string;
  /** شروع و پایان خودِ ماه (برای گزارش‌های «مانده‌ی اول دوره / تا پایان ماه») */
  start: string;
  endDate: string;
}

export const EMPTY_MONTH: AttendanceMonth = { year: 0, month: 0, from: "", to: "", start: "", endDate: "" };

const toValue = (m: WorkCalendarMonthFull): AttendanceMonth => ({ year: m.year, month: m.month, from: m.trafficStartDate, to: m.trafficEndDate, start: m.startDate, endDate: m.endDate });

export function currentCalendarMonth(months: WorkCalendarMonthFull[], today = localTodayIso()): WorkCalendarMonthFull | undefined {
  const cur = months.find((m) => m.startDate <= today && today <= m.endDate);
  if (cur) return cur;
  const sorted = [...months].sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
  return [...sorted].reverse().find((m) => m.startDate <= today) ?? sorted[0];
}

/** value.year = 0 ⇒ هنوز انتخاب نشده؛ بعد از بارگذاری تقویم خودکار روی ماه جاری می‌رود */
export function AttendanceMonthField({ value, onChange, label = "ماه" }: { value: AttendanceMonth; onChange: (v: AttendanceMonth) => void; label?: string }) {
  const months = useWorkCalendarMonthsFull();
  useEffect(() => {
    if ((value.year && value.start) || months.length === 0) return;
    const cur = currentCalendarMonth(months);
    if (cur) onChange(toValue(cur));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months.length]);
  return (
    <div className="form-field-inline">
      <label>{label}</label>
      <WorkMonthPicker
        year={value.year}
        month={value.month}
        autoFix={false}
        onChange={(y, m) => {
          const info = months.find((x) => x.year === y && x.month === m);
          if (info) onChange(toValue(info));
        }}
      />
    </div>
  );
}
