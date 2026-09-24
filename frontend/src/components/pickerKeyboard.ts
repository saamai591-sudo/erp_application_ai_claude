import { useEffect, useRef, useState } from "react";

// ناوبری با صفحه‌کلید برای همه‌ی دیالوگ‌های انتخابگر (RecordPicker / MultiRecordPicker): ↑/↓ ردیف فعال را جابه‌جا می‌کند
// (PageUp/PageDown هم ده‌تا)، Enter ردیف فعال را انتخاب می‌کند (در حالت چندانتخابی تیک را عوض می‌کند و Ctrl+Enter همه را تایید
// می‌کند)، Esc دیالوگ را می‌بندد. شنونده روی document است تا بعد از کلیک روی یک ردیف هم (که فوکوس را از ورودی فیلتر می‌گیرد) کار کند.
// Enter روی یک دکمه/لینک به رفتار خودش (فعال‌سازی دکمه) واگذار می‌شود و Enter دیگر هرگز فرم بیرونی را submit نمی‌کند.

export function usePickerKeyboard({
  count,
  resetKey,
  onEnter,
  onConfirmAll,
  onEscape,
}: {
  count: number;
  /** با تغییر آن (فیلتر/مرتب‌سازی)، ردیف فعال به اولین ردیف برمی‌گردد */
  resetKey: string;
  onEnter: (index: number) => void;
  onConfirmAll?: () => void;
  onEscape?: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(count > 0 ? 0 : -1);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setActiveIndex(count > 0 ? 0 : -1);
  }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setActiveIndex((i) => (count === 0 ? -1 : Math.min(Math.max(i, 0), count - 1)));
  }, [count]);

  useEffect(() => {
    if (activeIndex < 0) return;
    wrapRef.current?.querySelector(`tr[data-row-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const latest = useRef({ count, activeIndex, onEnter, onConfirmAll, onEscape });
  latest.current = { count, activeIndex, onEnter, onConfirmAll, onEscape };

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const { count: n, activeIndex: idx, onEnter: enter, onConfirmAll: confirmAll, onEscape: escape } = latest.current;
      const target = e.target as HTMLElement | null;
      const move = (next: number) => {
        e.preventDefault();
        e.stopPropagation();
        if (n > 0) setActiveIndex(Math.min(Math.max(next, 0), n - 1));
      };
      switch (e.key) {
        case "ArrowDown": return move(idx + 1);
        case "ArrowUp": return move(idx - 1);
        case "PageDown": return move(idx + 10);
        case "PageUp": return move(idx - 10);
        case "Enter": {
          if (target && (target.tagName === "BUTTON" || target.tagName === "A")) return;
          e.preventDefault();
          e.stopPropagation();
          if ((e.ctrlKey || e.metaKey) && confirmAll) confirmAll();
          else if (idx >= 0 && idx < n) enter(idx);
          return;
        }
        case "Escape":
          if (escape) {
            e.preventDefault();
            e.stopPropagation();
            escape();
          }
          return;
      }
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, []);

  return { activeIndex, setActiveIndex, wrapRef };
}
