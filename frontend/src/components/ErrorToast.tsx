import { useEffect, useRef } from "react";
import { showError } from "../lib/toast";

/** جایگزین کادر خطای داخل فرم: هر بار که message مقدار بگیرد، آن را به‌صورت toast قرمز شناور نشان می‌دهد و
 * خودش چیزی رندر نمی‌کند (پس چیدمان فرم جابه‌جا نمی‌شود).
 * اگر کاربر دوباره «ذخیره» بزند و همان پیامِ قبلی دوباره ست شود، state تغییری نمی‌کند و effect بالا اجرا نمی‌شود؛ پس روی هر submit،
 * اگر بعد از لحظه‌ای هنوز همان پیام فعال باشد، دوباره نشان داده می‌شود (اگر handler پیام را عوض یا پاک کرده باشد، چیزی نشان داده نمی‌شود). */
export function ErrorToast({ message }: { message: string | null | undefined }) {
  const latest = useRef(message);
  latest.current = message;
  // آخرین پیامی که نشان داده شد و زمانش — تا اگر بعد از یک submit همان پیام (مثلاً خطای سریعِ سرور) از مسیر عادی نشان داده شده، دوباره تکرار نشود
  const lastShown = useRef<{ message: string; at: number } | null>(null);

  useEffect(() => {
    if (message) {
      lastShown.current = { message, at: Date.now() };
      showError(message);
    }
  }, [message]);

  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    function onSubmit() {
      const before = latest.current;
      if (!before) return;
      const submittedAt = Date.now();
      const t = setTimeout(() => {
        timers.delete(t);
        const shown = lastShown.current;
        if (latest.current === before && !(shown && shown.message === before && shown.at >= submittedAt)) {
          lastShown.current = { message: before, at: Date.now() };
          showError(before);
        }
      }, 120);
      timers.add(t);
    }
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("submit", onSubmit, true);
      timers.forEach(clearTimeout);
    };
  }, []);

  return null;
}
