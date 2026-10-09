import { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";
import { api, ApiError } from "../lib/api";

// دکمه‌ی «چاپ» نوار ابزار فرم‌ها (toolbarExtra): قالب‌های فعالِ همان نوع سند را می‌آورد، سند را با قالب انتخابی در سرور رندر می‌کند و در
// یک iframe بدون اسکریپت (sandbox + CSP داخل خود سند) نشان می‌دهد؛ «چاپ» همان iframe را با چاپ مرورگر می‌فرستد (اندازه‌ی کاغذ را @page خود قالب تعیین می‌کند).
// هر نوع سندِ تازه فقط docType را می‌دهد (نوع‌ها در backend/src/services/printService.ts تعریف می‌شوند).

interface TemplateOption { id: number; title: string; isDefault: boolean; paper: string; orientation: string; digits: "LATIN" | "PERSIAN" }

function PrintIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M7 9V4h10v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 17H5a2 2 0 01-2-2v-4a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2h-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 14h10v6H7z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/** نمایش HTML تولیدشده‌ی سرور؛ بدون allow-scripts (اسکریپت قالب اجرا نمی‌شود) ولی با allow-same-origin/allow-modals برای فراخوانی چاپ از بیرون */
export function PrintFrame({ html, frameRef, height = "68vh" }: { html: string; frameRef?: React.RefObject<HTMLIFrameElement>; height?: string }) {
  return <iframe ref={frameRef} title="پیش‌نمایش چاپ" sandbox="allow-same-origin allow-modals" srcDoc={html} style={{ width: "100%", height, border: "1px solid var(--border, #ccc)", background: "#fff" }} />;
}

/**
 * چاپ محتوای iframe. مرورگر عنوان صفحه را پیشنهادِ نام فایل «ذخیره به‌صورت PDF» می‌گیرد؛ پس هم عنوان خودِ سند چاپ و هم عنوان صفحه‌ی اصلی موقتاً
 * برابر fileName می‌شود (مرورگرها یکی از این دو را برمی‌دارند) و بعد از چاپ برمی‌گردد. نهایتاً انتخاب نام با خود مرورگر است.
 */
export function printFrame(frame: HTMLIFrameElement | null, fileName?: string) {
  const w = frame?.contentWindow;
  if (!w) return;
  const topTitle = document.title;
  const restore = () => {
    document.title = topTitle;
    w.removeEventListener("afterprint", restore);
    window.removeEventListener("afterprint", restore);
  };
  if (fileName) {
    document.title = fileName;
    w.addEventListener("afterprint", restore);
    window.addEventListener("afterprint", restore);
  }
  w.focus();
  w.print();
  // مرورگرهایی که afterprint را نمی‌فرستند
  if (fileName) setTimeout(restore, 60_000);
}

function PrintDialog({ docType, sourceId, onClose }: { docType: string; sourceId: number; onClose: () => void }) {
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [templateId, setTemplateId] = useState<number | null>(null);
  // ارقام: خالی = پیش‌فرض خودِ قالب؛ در غیر این صورت LATIN/PERSIAN برای همین چاپ
  const [digits, setDigits] = useState("");
  const [html, setHtml] = useState("");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    api.get(`/print/${docType}/templates`)
      .then((list: TemplateOption[]) => {
        setTemplates(list);
        setTemplateId((list.find((t) => t.isDefault) ?? list[0])?.id ?? null);
        if (list.length === 0) {
          setError("قالب چاپ فعالی برای این سند تعریف نشده است");
          setLoading(false);
        }
      })
      .catch((e) => {
        setError((e as ApiError).message);
        setLoading(false);
      });
  }, [docType]);

  useEffect(() => {
    if (templateId === null) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.get(`/print/${docType}/${sourceId}/render?templateId=${templateId}${digits ? `&digits=${digits}` : ""}`)
      .then((r: { html: string; fileName?: string }) => {
        if (!cancelled) {
          setHtml(r.html);
          setFileName(r.fileName ?? "");
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setHtml("");
          setError((e as ApiError).message);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [docType, sourceId, templateId, digits]);

  return (
    <Modal title="چاپ" onClose={onClose} wide>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          قالب
          <select value={templateId ?? ""} onChange={(e) => setTemplateId(Number(e.target.value))} disabled={templates.length <= 1}>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.title}{t.isDefault ? " (پیش‌فرض)" : ""}</option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          ارقام
          <select value={digits} onChange={(e) => setDigits(e.target.value)}>
            <option value="">پیش‌فرض قالب</option>
            <option value="PERSIAN">فارسی (۰-۹)</option>
            <option value="LATIN">انگلیسی (0-9)</option>
          </select>
        </label>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn" disabled={!html || loading} onClick={() => printFrame(frameRef.current, fileName)}>چاپ</button>
        <button type="button" className="btn secondary" onClick={onClose}>بستن</button>
      </div>
      {error && <div className="alert error" style={{ marginBottom: 8 }}>{error}</div>}
      {loading && !error && <div style={{ padding: 12 }}>در حال آماده‌سازی…</div>}
      {html && !error && <PrintFrame html={html} frameRef={frameRef} />}
    </Modal>
  );
}

export function PrintButton({ docType, sourceId, title = "چاپ" }: { docType: string; sourceId: number; title?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="toolbar-icon-btn" onClick={() => setOpen(true)} title={title}>
        <PrintIcon />
      </button>
      {open && <PrintDialog docType={docType} sourceId={sourceId} onClose={() => setOpen(false)} />}
    </>
  );
}
