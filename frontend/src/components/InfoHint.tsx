import { useState } from "react";
import { Modal } from "./Modal";

function InfoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="7.5" r="1.1" fill="currentColor" />
    </svg>
  );
}

/** آیکن راهنمای تولبار؛ با کلیک، متن توضیحی فرم را در یک دیالوگ کامل نشان می‌دهد */
export function InfoHint({ text, title = "راهنما" }: { text?: string; title?: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <>
      <button type="button" className="toolbar-icon-btn info-hint-btn" onClick={() => setOpen(true)} title="راهنما">
        <InfoIcon />
      </button>
      {open && (
        <Modal title={title} onClose={() => setOpen(false)}>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.9, color: "var(--ink)" }}>{text}</p>
        </Modal>
      )}
    </>
  );
}
