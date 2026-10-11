import { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";
import { absoluteApiUrl, api, ApiError } from "../lib/api";
import { formatJalaliDate } from "../lib/formatDate";

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

interface ShareLinkRow {
  id: number;
  status: "ACTIVE" | "EXPIRED" | "REVOKED";
  createdAt: string;
  createdByName: string;
  expiresAt: string;
  firstViewedAt: string | null;
  lastViewedAt: string | null;
  viewCount: number;
}

const SHARE_STATUS_FA: Record<ShareLinkRow["status"], string> = { ACTIVE: "فعال", EXPIRED: "منقضی", REVOKED: "لغوشده" };

/**
 * لینک اشتراک‌گذاری با مشتری: از همین قالب/ارقامِ انتخاب‌شده یک عکس‌فوری می‌سازد که مشتری بدون ورود تا تاریخ انقضا می‌بیند.
 * لینک فقط همین لحظه‌ی ساخت نمایش داده می‌شود (سرور فقط هش آن را نگه می‌دارد)؛ گم‌شده را باید دوباره ساخت.
 */
function ShareDialog({ docType, sourceId, templateId, digits, title, onClose }: { docType: string; sourceId: number; templateId: number | null; digits: string; title: string; onClose: () => void }) {
  const [days, setDays] = useState(7);
  const [links, setLinks] = useState<ShareLinkRow[]>([]);
  const [created, setCreated] = useState<{ url: string; expiresAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const base = `/print/${docType}/${sourceId}/share-links`;

  const load = () =>
    api.get(base).then((r: ShareLinkRow[]) => setLinks(r)).catch((e) => setError((e as ApiError).message));
  useEffect(() => {
    load();
  }, [docType, sourceId]);

  async function create() {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const r = await api.post(base, { templateId, digits: digits || undefined, days }, { silent: true });
      setCreated({ url: absoluteApiUrl(`/share/${r.token}`), expiresAt: r.expiresAt });
      await load();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: number) {
    if (!window.confirm("این لینک لغو شود؟ مشتری دیگر نمی‌تواند آن را باز کند.")) return;
    try {
      await api.post(`${base}/${id}/revoke`, {}, { silent: true });
      await load();
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // مرورگرهای بدون clipboard: کاربر متن را دستی انتخاب می‌کند
      setCopied(false);
    }
  }

  return (
    <Modal title="لینک اشتراک‌گذاری با مشتری" onClose={onClose} wide>
      <p style={{ marginTop: 0 }}>
        مشتری با این لینک نسخه‌ی همین لحظه‌ی سند را بدون ورود به سیستم می‌بیند و تا تاریخ انقضا می‌تواند چاپ یا PDF بگیرد.
        ویرایش بعدی سند، لینک ساخته‌شده را تغییر نمی‌دهد.
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          مدت اعتبار
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {[1, 3, 7, 14, 30, 60].map((d) => (
              <option key={d} value={d}>{d} روز</option>
            ))}
          </select>
        </label>
        <button type="button" className="btn" disabled={busy || templateId === null} onClick={create}>ساخت لینک</button>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn secondary" onClick={onClose}>بستن</button>
      </div>
      {error && <div className="alert error" style={{ marginBottom: 8 }}>{error}</div>}
      {created && (
        <div className="alert" style={{ marginBottom: 8 }}>
          <div style={{ marginBottom: 6 }}>لینک ساخته شد (تا {formatJalaliDate(created.expiresAt)} معتبر است). این لینک فقط همین‌جا نمایش داده می‌شود:</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <input readOnly dir="ltr" value={created.url} style={{ flex: 1, minWidth: 260 }} onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="btn" onClick={() => copy(created.url)}>{copied ? "کپی شد" : "کپی"}</button>
            <a className="btn secondary" target="_blank" rel="noreferrer" href={`https://t.me/share/url?url=${encodeURIComponent(created.url)}&text=${encodeURIComponent(title)}`}>تلگرام</a>
            <a className="btn secondary" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(title + "\n" + created.url)}`}>واتساپ</a>
          </div>
        </div>
      )}
      <h4 style={{ margin: "12px 0 6px" }}>لینک‌های ساخته‌شده برای این سند</h4>
      {links.length === 0 ? (
        <div style={{ color: "var(--muted, #666)" }}>هنوز لینکی ساخته نشده است.</div>
      ) : (
        <table className="data-table" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>وضعیت</th>
              <th>ساخته‌شده</th>
              <th>توسط</th>
              <th>انقضا</th>
              <th>بازدید</th>
              <th>اولین بازدید</th>
              <th>آخرین بازدید</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {links.map((l) => (
              <tr key={l.id}>
                <td>{SHARE_STATUS_FA[l.status]}</td>
                <td>{formatJalaliDate(l.createdAt)}</td>
                <td>{l.createdByName || "—"}</td>
                <td>{formatJalaliDate(l.expiresAt)}</td>
                <td>{l.viewCount}</td>
                <td>{formatJalaliDate(l.firstViewedAt)}</td>
                <td>{formatJalaliDate(l.lastViewedAt)}</td>
                <td>{l.status === "ACTIVE" && <button type="button" className="btn secondary" onClick={() => revoke(l.id)}>لغو</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
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
  const [shareOpen, setShareOpen] = useState(false);
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
        <button type="button" className="btn secondary" disabled={!html || loading || templateId === null} onClick={() => setShareOpen(true)}>اشتراک‌گذاری با مشتری</button>
        <button type="button" className="btn" disabled={!html || loading} onClick={() => printFrame(frameRef.current, fileName)}>چاپ</button>
        <button type="button" className="btn secondary" onClick={onClose}>بستن</button>
      </div>
      {error && <div className="alert error" style={{ marginBottom: 8 }}>{error}</div>}
      {loading && !error && <div style={{ padding: 12 }}>در حال آماده‌سازی…</div>}
      {html && !error && <PrintFrame html={html} frameRef={frameRef} />}
      {shareOpen && (
        <ShareDialog docType={docType} sourceId={sourceId} templateId={templateId} digits={digits} title={fileName} onClose={() => setShareOpen(false)} />
      )}
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
