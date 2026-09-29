import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

function isFocusable(el: HTMLElement): boolean {
  return !(el as HTMLButtonElement).disabled && el.getClientRects().length > 0;
}

// بعد از بسته‌شدن دیالوگ، فوکوس باید به همان فیلدی برگردد که دیالوگ را باز کرده بود؛ وگرنه (چون دیالوگ از
// DOM حذف می‌شود) فوکوس روی body می‌ماند و Tab بعدی از ابتدای صفحه — یعنی منوی کناری — شروع می‌شود.
// اگر فیلد بازکننده دیگر قابل فوکوس نیست (مثلاً بعد از انتخاب، غیرفعال شده)، اولین فیلد قابل‌فوکوسِ بعد از آن.
function restoreFocus(trigger: HTMLElement | null) {
  const active = document.activeElement;
  if (active && active !== document.body) return; // فوکوس عمداً جای دیگری رفته؛ دست نزن
  if (!trigger || !trigger.isConnected) return;
  if (isFocusable(trigger)) {
    trigger.focus();
    return;
  }
  const next = Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE)).find(
    (el) => isFocusable(el) && !!(trigger.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)
  );
  next?.focus();
}

// طبق تصمیم صریح کاربر: دیالوگ باید به document.body پورتال شود، نه مستقیم در همان نقطه‌ای از درخت DOM که
// ازش باز شده رندر شود — وگرنه (مثلاً وقتی از داخل یک <td> گرید ردیفی باز می‌شود) محتوای دیالوگ به‌طور
// ناخواسته وارث استایل‌های همان ردیف/سلول می‌شود (نمونه‌ی واقعی که همین باگ را لو داد: سایه‌ی متناوب
// ردیف‌های انتخابگر با پس‌زمینه‌ی ردیف فعالِ گرید بیرونی قاطی می‌شد، چون از نظر DOM داخل همان ردیف بود).
export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** برای دیالوگ‌های دارای گرید/ستون‌های زیاد: عرض بزرگ‌تر (تا ۱۲۰۰px) */
  wide?: boolean;
}) {
  // در مرحله‌ی رندر خوانده می‌شود (قبل از commit)، چون autoFocus فیلدهای داخل دیالوگ در commit فوکوس را می‌دزدد.
  const [trigger] = useState(() => (document.activeElement instanceof HTMLElement ? document.activeElement : null));
  useEffect(() => () => restoreFocus(trigger), [trigger]);

  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={wide ? "modal modal-wide" : "modal"}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>,
    document.body
  );
}
