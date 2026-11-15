import { useEffect, useMemo, useState } from "react";
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { api } from "../lib/api";

// انتخاب فرمول ساخت روی ردیف آمار تولید و ردیف دارای درصد موجودی پای کار. یک کالا هم‌زمان می‌تواند چند فرمول داشته باشد و
// بهای تمام‌شده استاندارد و ترکیب مواد را از همین فرمولِ انتخاب‌شده می‌گیرد (حدس از تاریخ نیست). قواعد: backend/src/services/bomService.ts

export interface EligibleBom { id: number; number: number; effectiveDate: string; outputQuantity: number; description: string }

/** فرمول‌های فعال و معتبر (تاریخ شروع ≤ date) هر کالا؛ با تغییر مجموعه‌ی کالاها یا تاریخ دوباره خوانده می‌شود */
export function useEligibleBoms(itemIds: number[], date: string): Record<number, EligibleBom[]> {
  const [map, setMap] = useState<Record<number, EligibleBom[]>>({});
  const key = useMemo(() => [...new Set(itemIds.filter(Boolean))].sort((a, b) => a - b).join(","), [itemIds]);
  useEffect(() => {
    if (!key || !date) {
      setMap({});
      return;
    }
    let live = true;
    api.get(`/production-stats/eligible-boms?itemIds=${key}&date=${date}`).then((r) => live && setMap(r ?? {})).catch(() => live && setMap({}));
    return () => { live = false; };
  }, [key, date]);
  return map;
}

const label = (b: EligibleBom) => `${toFaDigits(String(b.number))} — از ${formatJalaliDate(b.effectiveDate)}${b.description ? ` — ${b.description}` : ""}`;

/**
 * لیست فرمول‌های مجاز یک کالا. فرمولی که از قبل روی ردیف ذخیره شده ولی دیگر مجاز نیست (مثلاً غیرفعال شده) هم با برچسب نمایش داده می‌شود.
 * `currentNumber` شماره‌ی فرمول ذخیره‌شده است.
 */
export function BomSelect({ options, value, currentNumber, disabled, onChange }: {
  options: EligibleBom[] | undefined;
  value: string;
  currentNumber?: number | null;
  disabled?: boolean;
  onChange: (id: string) => void;
}) {
  const list = options ?? [];
  const missing = value && !list.some((b) => String(b.id) === value);
  return (
    <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <option value="">{list.length || value ? "— انتخاب فرمول —" : "فرمول فعالی برای این کالا نیست"}</option>
      {missing && <option value={value}>{currentNumber ? `${toFaDigits(String(currentNumber))} (فرمول ثبت‌شده)` : "فرمول ثبت‌شده"}</option>}
      {list.map((b) => <option key={b.id} value={b.id}>{label(b)}</option>)}
    </select>
  );
}

/** پیش‌فرض: جدیدترین فرمول مجاز (وقتی کاربر هنوز انتخابی نکرده است) */
export function defaultBomId(options: EligibleBom[] | undefined): string {
  return options && options.length ? String(options[0].id) : "";
}
