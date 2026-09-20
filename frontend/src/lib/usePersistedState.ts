import { useRef, useState } from "react";

const store = new Map<string, any>();

/**
 * جایگزین useState که مقدار را در یک حافظه‌ی موقت بیرون از چرخه‌ی کامپوننت (کلیدشده بر اساس key، معمولاً مسیر صفحه)
 * نگه می‌دارد. با remount شدن کامپوننت (مثلاً به‌خاطر سوییچ بین تب‌ها)، مقدار قبلی بازیابی می‌شود
 * به‌جای بازگشت به initialValue — یعنی نه فرم و نه فهرست، با برگشتن به تب خودش رفرش نمی‌شود.
 */
export function usePersistedState<T>(key: string, initialValue: T | (() => T)): [T, (v: T | ((prev: T) => T)) => void] {
  const hasCached = store.has(key);
  const [state, setState] = useState<T>(() => {
    if (hasCached) return store.get(key);
    return typeof initialValue === "function" ? (initialValue as () => T)() : initialValue;
  });

  const keyRef = useRef(key);
  keyRef.current = key;

  function setValue(v: T | ((prev: T) => T)) {
    setState((prev) => {
      const next = typeof v === "function" ? (v as (prev: T) => T)(prev) : v;
      store.set(keyRef.current, next);
      return next;
    });
  }

  return [state, setValue];
}

/** آیا برای این کلید مقدار کش‌شده‌ای از قبل وجود دارد؟ (برای تصمیم «نیاز به واکشی اولیه هست یا نه») */
export function hasPersistedState(key: string): boolean {
  return store.has(key);
}

/** پاک کردن همه‌ی مقادیر کش‌شده‌ای که کلیدشان با prefix شروع می‌شود (برای پاک‌سازی فرم «جدید» هنگام باز شدن) */
export function clearPersistedStateByPrefix(prefix: string) {
  for (const key of Array.from(store.keys())) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/** پاک کردن دقیقاً «خانواده‌ی» یک کلید: خودِ کلید و کلیدهای زیرمجموعه‌اش که با «کلید:» شروع می‌شوند
 * (مثل `form:/x/new:form`, `form:/x/new:header`). برخلاف clearPersistedStateByPrefix، کلیدهای صرفاً هم‌پیشوند
 * (مثلاً `form:/accounts/new?parentId=5` وقتی `form:/accounts` پاک می‌شود، یا parentId=55 وقتی parentId=5
 * پاک می‌شود) را پاک نمی‌کند — تا باز/بستن یک تب، حالت فرمِ نیمه‌کاره‌ی تبی دیگر را خراب نکند. */
export function clearPersistedStateFamily(key: string) {
  for (const k of Array.from(store.keys())) {
    if (k === key || k.startsWith(key + ":")) store.delete(k);
  }
}

/** پاک کردن مقدار کش‌شده‌ی یک کلید (برای پیاده‌سازی دکمه‌ی «رفرش») */
export function clearPersistedState(key: string) {
  store.delete(key);
}
