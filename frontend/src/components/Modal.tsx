import { ReactNode } from "react";

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
  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={wide ? "modal modal-wide" : "modal"}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}
