import { useEffect, useState } from "react";
import { api } from "./api";

export interface WorkCalendarMonthFull {
  year: number;
  month: number;
  startDate: string;
  endDate: string;
}

/** ماه‌های تقویم کاری با تاریخ شروع/پایان (مثلاً پیش‌فرض و کمینه‌ی تاریخ سند حقوق) */
export function useWorkCalendarMonthsFull(): WorkCalendarMonthFull[] {
  const [months, setMonths] = useState<WorkCalendarMonthFull[]>([]);
  useEffect(() => {
    api.get("/work-calendars/months").then(setMonths).catch(() => {});
  }, []);
  return months;
}
