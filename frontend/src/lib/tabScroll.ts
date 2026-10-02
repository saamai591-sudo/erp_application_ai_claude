import { useEffect, useRef } from "react";

// =========================================================================
// حفظ موقعیت اسکرول هر تب — با سوییچ بین تب‌ها، Outlet با کلید تب remount می‌شود (components/Layout.tsx) و اسکرول
// داخلی صفحه‌ی فهرست (.grid-scroll-area) به ابتدا برمی‌گشت. این هوک موقعیت اسکرول هر تب را (برای هر قاب اسکرول‌دار:
// خودِ .content و هر .grid-scroll-area به‌ترتیب DOM) در حافظه نگه می‌دارد و با برگشتن به تب، پس از بارگذاری داده‌ی
// فهرست (که async است) آن را بازمی‌گرداند. فقط در حافظه (نه localStorage) — با بستن تب پاک می‌شود.
// =========================================================================

const SCROLL_SELECTOR = ".content, .grid-scroll-area";
const RESTORE_TIMEOUT_MS = 5000;

const store = new Map<string, Map<number, number>>();
/** در حین بازگردانی، رویدادهای اسکرولِ ناشی از «کوتاه‌شدن» محتوا (clamp مرورگر) ذخیره نمی‌شوند */
let restoring = false;

function scrollerIndex(el: Element): number {
  return Array.from(document.querySelectorAll(SCROLL_SELECTOR)).indexOf(el);
}

export function forgetTabScroll(tabId: string) {
  store.delete(tabId);
}

export function useTabScrollRestore(activeTabId: string | null, refreshNonce: number) {
  const activeRef = useRef<string | null>(activeTabId);
  activeRef.current = activeTabId;

  // ثبت موقعیت اسکرول (capture چون رویداد scroll bubble نمی‌شود)
  useEffect(() => {
    function onScroll(e: Event) {
      if (restoring) return;
      const tabId = activeRef.current;
      const el = e.target as Element | null;
      if (!tabId || !el || !(el instanceof Element) || !el.matches(SCROLL_SELECTOR)) return;
      const idx = scrollerIndex(el);
      if (idx < 0) return;
      let m = store.get(tabId);
      if (!m) store.set(tabId, (m = new Map()));
      m.set(idx, (el as HTMLElement).scrollTop);
    }
    document.addEventListener("scroll", onScroll, true);
    return () => document.removeEventListener("scroll", onScroll, true);
  }, []);

  // بازگردانی پس از سوییچ تب (یا remount ناشی از رفرش خودکار)
  useEffect(() => {
    if (!activeTabId) return;
    const saved = store.get(activeTabId);
    if (!saved || saved.size === 0) {
      // تبی که هنوز اسکرولی ثبت نشده: قاب .content (که بین تب‌ها یکی است) از ابتدا شروع شود، نه از موقعیت تب قبلی
      document.querySelector<HTMLElement>(".content")?.scrollTo({ top: 0 });
      return;
    }
    const targets = new Map(saved);
    const start = performance.now();
    let cancelled = false;
    let raf = 0;
    restoring = true;

    const stop = () => {
      cancelled = true;
      restoring = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("wheel", stop, true);
      window.removeEventListener("touchstart", stop, true);
      window.removeEventListener("keydown", stop, true);
      window.removeEventListener("pointerdown", stop, true);
    };
    // هر تعامل کاربر بازگردانی را متوقف می‌کند (کاربر را به‌زور به جای قبلی برنگردان)
    window.addEventListener("wheel", stop, true);
    window.addEventListener("touchstart", stop, true);
    window.addEventListener("keydown", stop, true);
    window.addEventListener("pointerdown", stop, true);

    const tick = () => {
      if (cancelled) return;
      const els = document.querySelectorAll<HTMLElement>(SCROLL_SELECTOR);
      let done = true;
      targets.forEach((top, idx) => {
        const el = els[idx];
        if (!el) { done = false; return; }
        if (Math.abs(el.scrollTop - top) > 1) {
          el.scrollTop = top;
          // هنوز محتوا (داده‌ی فهرست) به‌اندازه‌ی کافی بلند نشده — بعداً دوباره تلاش می‌شود
          if (Math.abs(el.scrollTop - top) > 1) done = false;
        }
      });
      if (done || performance.now() - start > RESTORE_TIMEOUT_MS) {
        stop();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return stop;
  }, [activeTabId, refreshNonce]);
}
