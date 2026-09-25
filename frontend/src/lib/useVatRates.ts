import { useEffect, useState } from "react";
import { api } from "./api";
import { DEFAULT_VAT_RATE_PERCENT } from "./vatCalculation";

// نرخ‌های تاریخ‌محور ارزش افزوده («رویه‌ها و تنظیمات حسابداری» > ارزش افزوده) برای نمایش زنده‌ی مالیات در فرم‌های فاکتور/پیش‌فاکتور.
// نرخ قابل‌اعمال روی یک سند = آخرین رکوردِ با تاریخ شروع ≤ تاریخ سند؛ محاسبه‌ی نهایی و ذخیره‌شده همیشه با بک‌اند است.

export interface VatRate {
  startDate: string;
  ratePercent: number;
}

let cache: VatRate[] | null = null;

export function useVatRates(): VatRate[] {
  const [rates, setRates] = useState<VatRate[]>(cache ?? []);
  useEffect(() => {
    let alive = true;
    api
      .get("/accounting-settings/vat-rates")
      .then((r: VatRate[]) => {
        cache = r;
        if (alive) setRates(r);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return rates;
}

/** نرخ (درصد) معتبر در تاریخ سند (YYYY-MM-DD)؛ تاریخِ خالی = امروز؛ در نبودِ نرخ‌ها ثابتِ پیش‌فرض */
export function vatRateForDate(rates: VatRate[], date: string | undefined | null): number {
  const d = (date || new Date().toISOString()).slice(0, 10);
  let found: VatRate | null = null;
  for (const r of rates) {
    if (r.startDate.slice(0, 10) <= d && (!found || r.startDate > found.startDate)) found = r;
  }
  return found ? found.ratePercent : DEFAULT_VAT_RATE_PERCENT;
}
