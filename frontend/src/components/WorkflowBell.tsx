import { useEffect, useState } from "react";
import { api, WORKFLOW_REFRESH_EVENT } from "../lib/api";
import { toFaDigits } from "../lib/formatAmount";
import { useTabs } from "../lib/TabsContext";

// زنگ کارتابل در نوار بالا: تعداد کارهای بازِ من (و نشان زرد برای عقب‌افتاده/اطلاعیه‌ی خوانده‌نشده)؛ شمارنده بلافاصله بعد از هر عملیات موفق خودِ کاربر (مثلاً تایید پیش‌فاکتور)، با برگشتن به پنجره و هر ۲۰ ثانیه از سرور خوانده می‌شود؛ کارِ ساخته‌شده توسط دیگران حداکثر ۲۰ ثانیه دیر می‌رسد (فقط داخل برنامه، بدون پیامک؛ نه SignalR).
export function WorkflowBell() {
  const { openTab } = useTabs();
  const [c, setC] = useState<{ open: number; overdue: number; unread: number } | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => api.get("/workflow/summary").then((r) => alive && setC(r)).catch(() => {});
    load();
    const t = setInterval(load, 20_000);
    // بعد از عملیات خودِ کاربر چند عملیات پشت‌سرهم یک بار خوانده می‌شود
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const soon = () => {
      clearTimeout(debounce);
      debounce = setTimeout(load, 400);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") soon();
    };
    window.addEventListener(WORKFLOW_REFRESH_EVENT, soon);
    window.addEventListener("focus", soon);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(t);
      clearTimeout(debounce);
      window.removeEventListener(WORKFLOW_REFRESH_EVENT, soon);
      window.removeEventListener("focus", soon);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  const n = c ? c.open : 0;
  const warn = !!c && (c.overdue > 0 || c.unread > 0);
  return (
    <button
      type="button"
      className="topbar-dock-btn dock-c-blue wf-bell"
      onClick={() => openTab("/my-tasks")}
      title={c ? `کارهای باز: ${toFaDigits(String(c.open))}${c.overdue ? ` — عقب‌افتاده: ${toFaDigits(String(c.overdue))}` : ""}${c.unread ? ` — اطلاعیه‌ی تازه: ${toFaDigits(String(c.unread))}` : ""}` : "کارتابل"}
      aria-label="کارتابل"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
      {(n > 0 || warn) && <span className={`wf-bell-badge${warn ? " warn" : ""}`}>{toFaDigits(String(n > 99 ? 99 : n))}</span>}
    </button>
  );
}
