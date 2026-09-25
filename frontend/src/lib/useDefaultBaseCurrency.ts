import { useEffect } from "react";

/**
 * قاعده‌ی پایه: هر فیلد «ارز» در فرم‌های ثبت سند جدید به‌صورت پیش‌فرض روی «ارز پایه» تنظیم می‌شود (کاربر می‌تواند تغییرش دهد).
 * وقتی enabled باشد (سند جدید و بارگذاری اولیه تمام‌شده)، فهرست ارزها آمده و مقدار فعلی خالی است، شناسه‌ی ارز پایه را با apply می‌نشاند؛
 * ویرایش سند موجود یا انتخاب دستیِ کاربر هرگز بازنویسی نمی‌شود. currencies از GET /currencies می‌آید و isBase دارد.
 */
export function useDefaultBaseCurrency(opts: {
  enabled: boolean;
  currencies: { id: number; isBase?: boolean }[];
  current: string;
  apply: (currencyId: string) => void;
}) {
  const { enabled, currencies, current, apply } = opts;
  useEffect(() => {
    if (!enabled || current) return;
    const base = currencies.find((c) => c.isBase);
    if (base) apply(String(base.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, currencies, current]);
}
