import { ReactNode, useCallback, useEffect, useLayoutEffect, useRef } from "react";

// متنِ تک‌خطی که اگر در عرض در دسترس جا نشود، فونتش «به‌تدریج» (گام‌های ۰٫۵ پیکسلی) کم می‌شود تا کاملاً در یک خط جا بگیرد — فقط برای همان
// موردی که واقعاً لازم دارد؛ بقیه اندازه‌ی فونت اصلی (از CSS) را نگه می‌دارند. حداقل اندازه‌ی فونت (minSize) برای خوانایی رعایت می‌شود و اگر با
// حداقل هم جا نشد، ellipsis (از CSS کلاس fit-text) و tooltip متن کامل باقی می‌ماند. با تغییر عرض والد (مثلاً تغییر اندازه‌ی سایدبار) و بعد از بارگذاری
// فونت‌ها دوباره محاسبه می‌شود. منوی کناری (Layout.tsx) برای عنوان ماژول/زیرماژول/آیتم از آن استفاده می‌کند.
export function FitText({ children, minSize = 10, step = 0.5 }: { children: ReactNode; minSize?: number; step?: number }) {
  const ref = useRef<HTMLSpanElement | null>(null);

  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.fontSize = "";
    let size = parseFloat(getComputedStyle(el).fontSize);
    while (el.scrollWidth > el.clientWidth + 0.5 && size > minSize) {
      size = Math.max(minSize, size - step);
      el.style.fontSize = `${size}px`;
    }
    el.title = el.scrollWidth > el.clientWidth + 0.5 ? el.textContent || "" : "";
  }, [minSize, step]);

  // بعد از هر رندر (مثلاً تغییر وزن فونت آیتم فعال) دوباره اندازه‌گیری می‌شود
  useLayoutEffect(() => {
    fit();
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || !el.parentElement) return;
    const observer = new ResizeObserver(() => fit());
    observer.observe(el.parentElement);
    document.fonts?.ready.then(fit);
    return () => observer.disconnect();
  }, [fit]);

  return (
    <span ref={ref} className="fit-text">
      {children}
    </span>
  );
}
