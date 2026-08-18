import { useState } from "react";
import { Modal } from "./Modal";

function InfoIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="7.5" r="1.1" fill="currentColor" />
    </svg>
  );
}

/**
 * آیکن راهنمای کوچک کنار عنوان یک فیلد؛ به‌جای نوشتن توضیح تکمیلی فیلد به‌صورت متن دراز
 * داخل خود لیبل (که باعث به‌هم‌ریختن تراز فیلدها در فرم می‌شود)، با کلیک روی این آیکن
 * توضیح در یک دیالوگ کوچک نمایش داده می‌شود.
 */
export function FieldHint({ text, label }: { text?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <>
      <button type="button" className="field-hint-btn" onClick={() => setOpen(true)} title="راهنما">
        <InfoIcon />
      </button>
      {open && (
        <Modal title={label || "راهنما"} onClose={() => setOpen(false)}>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.9, color: "var(--ink)" }}>{text}</p>
        </Modal>
      )}
    </>
  );
}
