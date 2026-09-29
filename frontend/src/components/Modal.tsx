import { ReactNode } from "react";
import { createPortal } from "react-dom";

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
