import { useEffect, useState } from "react";
import { api } from "./api";
import { FiscalPeriodRange, resolveSelectedFiscalPeriod } from "./fiscalYearDefaultDate";

// فهرست دوره‌های مالی برای همه‌ی انتخابگرهای تاریخ مشترک است؛ فقط یک درخواست در بازه‌ی کوتاه (نه یکی به ازای هر فیلد تاریخ)
const CACHE_TTL_MS = 30_000;
let cache: { at: number; promise: Promise<FiscalPeriodRange[]> } | null = null;

function loadPeriods(): Promise<FiscalPeriodRange[]> {
  if (!cache || Date.now() - cache.at > CACHE_TTL_MS) {
    const promise = api.get("/fiscal-periods") as Promise<FiscalPeriodRange[]>;
    promise.catch(() => {
      if (cache?.promise === promise) cache = null;
    });
    cache = { at: Date.now(), promise };
  }
  return cache.promise;
}

/**
 * دوره مالی «انتخاب‌شده» کاربر (همان قاعده‌ی resolveSelectedFiscalPeriod و بک‌اند) برای محدودکردن انتخابگرهای تاریخ
 * (JalaliDatePicker با prop fiscalYear). تا وقتی enabled=false باشد هیچ درخواستی زده نمی‌شود.
 */
export function useSelectedFiscalPeriod(enabled = true): FiscalPeriodRange | null {
  const [period, setPeriod] = useState<FiscalPeriodRange | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    loadPeriods()
      .then((periods) => alive && setPeriod(resolveSelectedFiscalPeriod(periods)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [enabled]);
  return period;
}
