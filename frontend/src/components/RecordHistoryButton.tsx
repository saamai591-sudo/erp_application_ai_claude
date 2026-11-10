import { useState } from "react";
import { useLocation } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { formatJalaliDate } from "../lib/formatDate";
import { AUDIT_MODEL_BY_PATH, auditActionTitle, AuditEventView } from "../lib/auditLabels";
import { usePermissions } from "../lib/usePermissions";
import { Modal } from "./Modal";
import { AuditChangesTable } from "./AuditChangesTable";

// دکمه‌ی «تاریخچه‌ی این رکورد» در نوار ابزار فرم‌های ویرایش (یک‌بار در FormPage؛ فرم‌ها کاری ندارند). فقط وقتی دیده می‌شود که مسیر
// /<فرم>/<شناسه>/edit در AUDIT_MODEL_BY_PATH باشد و کاربر مجوز «مرور لاگ تغییرات» داشته باشد (که خودش به مجوز لایسنس وابسته است).
const KEY = "settings.reports.audit-log.view";

function HistoryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M3 12a9 9 0 1 0 3-6.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M3 4v5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function timeFa(iso: string) {
  return `${formatJalaliDate(iso)} ${new Date(iso).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran" })}`;
}

export function RecordHistoryButton() {
  const { pathname } = useLocation();
  const { hasPermission } = usePermissions();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<AuditEventView[] | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const m = /^\/([a-z-]+)\/(\d+)\/edit$/.exec(pathname);
  const model = m ? AUDIT_MODEL_BY_PATH[m[1]] : undefined;
  if (!m || !model || !hasPermission(KEY)) return null;
  const recordId = m[2];

  async function show() {
    setOpen(true);
    setRows(null);
    setError(null);
    try {
      const r: { modelTitle: string; rows: AuditEventView[] } = await api.get(`/audit-log/record?model=${model}&recordId=${recordId}`);
      setRows(r.rows);
      setTitle(r.modelTitle);
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  return (
    <>
      <button type="button" className="toolbar-icon-btn" onClick={show} title="تاریخچه‌ی تغییرات این رکورد">
        <HistoryIcon />
      </button>
      {open && (
        <Modal title={`تاریخچه‌ی ${title || "رکورد"} #${recordId}`} onClose={() => setOpen(false)} wide>
          {error && <div className="alert error">{error}</div>}
          {!rows && !error && <div className="mg-muted">در حال خواندن…</div>}
          {rows && rows.length === 0 && <div className="mg-muted">برای این رکورد تغییری ثبت نشده است (لاگ ممکن است بعد از ایجاد رکورد روشن شده باشد).</div>}
          {rows && rows.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: "65vh", overflow: "auto" }}>
              {rows.map((r) => (
                <div key={r.id} className="audit-event-card">
                  <div className="audit-event-head">
                    <strong>{auditActionTitle(r.action)}</strong>
                    <span>{r.userName || "سیستم"}</span>
                    <span className="mg-muted">{timeFa(r.at)}</span>
                  </div>
                  <AuditChangesTable event={r} />
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
