import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { formatJalaliDate } from "../lib/formatDate";
import { FiscalPeriodRange, resolveSelectedFiscalPeriod } from "../lib/fiscalYearDefaultDate";
import { PREFERENCES_CHANGED_EVENT } from "../lib/preferences";

/**
 * نمایش دوره مالی جاری کاربر در نوار بالای برنامه، کنار دکمه‌ی تنظیمات کاربری (که دوره مالی را عوض می‌کند):
 * «دوره مالی منتهی به ۱۴۰۰/۱۲/۲۹». دوره مالی «انتخاب‌شده» همان قاعده‌ی resolveSelectedFiscalPeriod است (تنظیم کاربر یا
 * آخرین دوره تعریف‌شده)؛ با ذخیره‌ی تنظیمات (رویداد PREFERENCES_CHANGED_EVENT) بلافاصله به‌روز می‌شود.
 */
export function FiscalPeriodBadge() {
  const [periods, setPeriods] = useState<FiscalPeriodRange[]>([]);
  const [, bump] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .get("/fiscal-periods")
        .then((p: FiscalPeriodRange[]) => alive && setPeriods(p))
        .catch(() => {});
    load();
    const onChange = () => {
      bump((n) => n + 1);
      load();
    };
    window.addEventListener(PREFERENCES_CHANGED_EVENT, onChange);
    return () => {
      alive = false;
      window.removeEventListener(PREFERENCES_CHANGED_EVENT, onChange);
    };
  }, []);

  const period = resolveSelectedFiscalPeriod(periods);
  if (!period) return null;
  return (
    <span className="topbar-fiscal" title={`دوره مالی ${period.title}`}>
      دوره مالی منتهی به {formatJalaliDate(period.toDate)}
    </span>
  );
}
