import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { RefreshButton } from "../components/RefreshButton";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { toFaDigits, formatAmountFa } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { API_URL } from "../lib/apiUrl";
import { api, ApiError, getToken } from "../lib/api";
import { showError, showToast } from "../lib/toast";
import { usePermissions } from "../lib/usePermissions";
import { WorkflowTaskAction } from "../components/WorkflowTaskAction";

// کارتابل › «کارهای من» (دسکتاپ و موبایل): فهرست کارها و جزئیات هر کار — خلاصه‌ی فقط‌خواندنی سند، تاریخچه، پیوست‌ها و «برداشتن / انجام شد».
// مرحله‌ی دستی: توضیح + حداقل یک مدرک (تصویر/PDF تا ۵ مگابایت) الزامی است؛ مرحله‌ی خودکار با ثبت سند بسته می‌شود. قواعد در سرور (workflowTaskService).

export interface TaskRow {
  id: number;
  rootTitle: string;
  stepTitle: string;
  completion: "MANUAL" | "EVENT";
  requireNote: boolean;
  requireAttachment: boolean;
  branchPerEvent?: boolean;
  parentTitle?: string | null;
  completionEvent?: string | null;
  quoteId?: number | null;
  deliveryId?: number | null;
  progress?: { total: number; done: number; branches: { docNumber: number | null; status: string }[] } | null;
  status: string;
  claimedByName: string;
  createdAt: string;
  dueAt: string | null;
  overdue: boolean;
  completedAt: string | null;
  completedByName: string;
  isMine: boolean;
  canClaim: boolean;
  canComplete: boolean;
}

const STATUS_FA: Record<string, string> = { OPEN: "باز", CLAIMED: "برداشته‌شده", DONE: "انجام‌شده", SKIPPED: "ردشده", CANCELLED: "لغو" };
const SCOPES: { key: string; label: string }[] = [
  { key: "mine", label: "کارهای من" },
  { key: "claimed", label: "برداشته‌شده توسط من" },
  { key: "overdue", label: "عقب‌افتاده" },
  { key: "done", label: "انجام‌شده" },
  { key: "cancelled", label: "لغو‌شده" },
];
const ACTION_FA: Record<string, string> = {
  CREATED: "ایجاد شد", CLAIMED: "برداشته شد", RELEASED: "رها شد", REASSIGNED: "واگذار شد", ATTACHED: "پیوست شد", DONE: "انجام شد",
  DONE_BY_EVENT: "با ثبت سند بسته شد", SKIPPED: "رد شد", CANCELLED: "لغو شد", OVERDUE: "مهلت گذشت",
};
const EVENT_FA: Record<string, string> = {
  SALES_QUOTE_FOLLOWUP_REOPENED: "بازگشایی پیگیری پیش‌فاکتور",
  SALES_QUOTE_FOLLOWUP_CLOSED: "بستن پیگیری پیش‌فاکتور", SALES_QUOTE_APPROVED: "تایید پیش‌فاکتور", RECEIPT_APPROVED: "ثبت دریافت", SALES_DELIVERY_REGISTERED: "ثبت حواله فروش", SALES_INVOICE_CREATED: "ثبت فاکتور فروش", TAX_INVOICE_SENT: "ارسال فاکتور به مودیان",
};

const BRANCH_STATUS_FA: Record<string, string> = { RUNNING: "در جریان", DONE: "تمام‌شده", CANCELLED: "لغو" };

/** نوار پیشرفت حواله‌ی پیش‌فاکتور (مرحله‌ی «هر حواله یک مسیر») */
function ProgressBar({ p }: { p: NonNullable<TaskRow["progress"]> }) {
  const pct = p.total > 0 ? Math.min(100, Math.round((p.done / p.total) * 100)) : 0;
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ height: 8, borderRadius: 4, background: "var(--border, #ddd)", overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: "var(--primary, #2563eb)" }} /></div>
      <div style={{ marginTop: 2, fontSize: "0.9em", opacity: 0.85 }}>{toFaDigits(String(pct))}٪ حواله شده ({formatAmountFa(p.done)} از {formatAmountFa(p.total)}) — {toFaDigits(String(p.branches.length))} حواله ثبت شده</div>
    </div>
  );
}

const dt = (iso: string | null) => (iso ? `${formatJalaliDate(iso)} ${toFaDigits(new Date(iso).toTimeString().slice(0, 5))}` : "—");

function dueText(t: TaskRow): string {
  if (!t.dueAt) return "";
  const ms = new Date(t.dueAt).getTime() - Date.now();
  const h = Math.round(Math.abs(ms) / 3600_000);
  const span = h >= 48 ? `${toFaDigits(String(Math.round(h / 24)))} روز` : `${toFaDigits(String(h))} ساعت`;
  return ms < 0 ? `${span} عقب‌افتاده` : `${span} تا مهلت`;
}

export default function MyTasks() {
  const { id } = useParams();
  if (id) return <TaskDetail taskId={Number(id)} />;
  return <TaskList />;
}

function TaskList() {
  const navigate = useNavigate();
  const [scope, setScope] = useState("mine");
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<{ id: number; taskId: number; kind: string; message: string; createdAt: string; read: boolean }[]>([]);
  const loadNotes = useCallback(() => api.get("/workflow/notifications").then(setNotes).catch(() => {}), []);
  useEffect(() => {
    loadNotes();
  }, [loadNotes]);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await api.get(`/workflow/tasks?scope=${scope}`));
      setError(null);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setLoading(false);
    }
  }, [scope]);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <div className="mytasks">
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="کارهای من" text="کارهایی که به شما یا نقش‌های شما محول شده‌اند. کار را «برداشتن» تا برای دیگران بسته شود؛ مرحله‌ی دستی با توضیح و مدرک بسته می‌شود و مرحله‌ی خودکار با ثبت سند مربوط." />
          <RefreshButton onClick={load} />
        </div>
      </div>
      <ErrorToast message={error} />
      {notes.some((n) => !n.read) && (
        <div className="card" style={{ padding: 10, marginBottom: 8, border: "1px solid var(--warn, #f59e0b)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <b>اطلاعیه‌ها</b>
            <button type="button" className="btn-link" onClick={() => api.post("/workflow/notifications/read", {}, { silent: true } as any).then(loadNotes)}>خوانده شد</button>
          </div>
          {notes.filter((n) => !n.read).slice(0, 8).map((n) => (
            <div key={n.id}><button type="button" className="link-btn" onClick={() => navigate(`/my-tasks/${n.taskId}`)}>{n.message}</button> <span style={{ opacity: 0.6 }}>({dt(n.createdAt)})</span></div>
          ))}
        </div>
      )}
      <div className="mytasks-tabs" style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0" }}>
        {SCOPES.map((s) => (
          <button key={s.key} type="button" className={scope === s.key ? "btn" : "btn secondary"} onClick={() => setScope(s.key)}>{s.label}</button>
        ))}
      </div>
      {loading ? (
        <p style={{ opacity: 0.7 }}>در حال بارگذاری…</p>
      ) : rows.length === 0 ? (
        <p style={{ opacity: 0.7 }}>کاری وجود ندارد.</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {rows.map((t) => (
            <button key={t.id} type="button" className="card mytask-card" onClick={() => navigate(`/my-tasks/${t.id}`)} style={{ textAlign: "start", padding: 12, cursor: "pointer", border: t.overdue ? "1px solid var(--danger, #c0392b)" : undefined }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <b>{t.stepTitle}</b>
                <span style={{ opacity: 0.8 }}>{STATUS_FA[t.status] ?? t.status}{t.claimedByName && t.status === "CLAIMED" ? ` — ${t.claimedByName}` : ""}</span>
              </div>
              <div style={{ marginTop: 4 }}>{t.rootTitle}</div>
              {t.progress && <ProgressBar p={t.progress} />}
              <div style={{ marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap", opacity: 0.8, fontSize: "0.9em" }}>
                <span>{t.completion === "EVENT" ? "خودکار (با ثبت سند)" : "دستی"}</span>
                {t.dueAt && t.status !== "DONE" && <span style={t.overdue ? { color: "var(--danger, #c0392b)" } : undefined}>{dueText(t)}</span>}
                {t.status === "DONE" && <span>انجام: {dt(t.completedAt)} {t.completedByName && `— ${t.completedByName}`}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface Detail extends TaskRow {
  stepDescription: string | null;
  actionContext: { quoteNumber: number; partyId: number; partyTitle: string } | null;
  note: string | null;
  eventRef: string | null;
  summary: { kind?: string; title: string; fields: { label: string; value: string; isDate?: boolean }[]; lines: { title: string; quantity: number; unitPrice: number; amount: number; discount: number }[]; total: number; totalVat: number } | null;
  events: { eventType: string; docType: string; docNumber: number | null; at: string }[];
  logs: { action: string; message: string | null; at: string; userName: string }[];
  attachments: { id: number; fileName: string; mimeType: string; size: number; mine: boolean }[];
}

const MAX_BYTES = 5 * 1024 * 1024;

async function openAttachment(id: number) {
  const res = await fetch(`${API_URL}/workflow/attachments/${id}`, { headers: { Authorization: `Bearer ${getToken() ?? ""}` } });
  if (!res.ok) throw new ApiError((await res.json().catch(() => ({}))).error || "خطا در باز کردن پیوست");
  const url = URL.createObjectURL(await res.blob());
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function TaskDetail({ taskId }: { taskId: number }) {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canAct = hasPermission("workflow.inbox.my-tasks.act");
  const canReassign = hasPermission("workflow.reports.workflow-all-tasks.reassign");
  const [users, setUsers] = useState<{ id: number; title: string }[]>([]);
  const [toUser, setToUser] = useState("");
  const [d, setD] = useState<Detail | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setD(await api.get(`/workflow/tasks/${taskId}`));
      setError(null);
    } catch (e) {
      setError((e as ApiError).message);
    }
  }, [taskId]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (canReassign) api.get("/workflow/users").then(setUsers).catch(() => {});
  }, [canReassign]);

  async function run(fn: () => Promise<unknown>, okMsg?: string) {
    setBusy(true);
    try {
      await fn();
      if (okMsg) showToast(okMsg);
      await load();
    } catch (e) {
      showError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > MAX_BYTES) return showError("حجم فایل بیش از ۵ مگابایت است");
    if (!(f.type.startsWith("image/") || f.type === "application/pdf")) return showError("فقط تصویر یا PDF پذیرفته می‌شود");
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result).split(",")[1] ?? "";
      run(() => api.post(`/workflow/tasks/${taskId}/attachments`, { fileName: f.name, mimeType: f.type, dataBase64: base64 }), "پیوست اضافه شد");
    };
    reader.readAsDataURL(f);
  }

  if (!d) return <div><ErrorToast message={error} /><p style={{ opacity: 0.7 }}>در حال بارگذاری…</p></div>;
  const active = d.status === "OPEN" || d.status === "CLAIMED";
  return (
    <div className="mytask-detail" style={{ maxWidth: 820 }}>
      <ErrorToast message={error} />
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <button type="button" className="btn secondary" onClick={() => navigate("/my-tasks")}>بازگشت</button>
        <h3 style={{ margin: 0 }}>{d.stepTitle}</h3>
        <span style={{ opacity: 0.8 }}>{STATUS_FA[d.status] ?? d.status}</span>
      </div>
      <div className="card" style={{ padding: 12, marginBottom: 8 }}>
        <div><b>{d.rootTitle}</b></div>
        {d.progress && (
          <>
            <ProgressBar p={d.progress} />
            {d.progress.branches.length > 0 && <div style={{ marginTop: 4, opacity: 0.85 }}>{d.progress.branches.map((b, i) => <span key={i} style={{ marginInlineEnd: 10 }}>حواله {b.docNumber != null ? toFaDigits(String(b.docNumber)) : "—"}: {BRANCH_STATUS_FA[b.status] ?? b.status}</span>)}</div>}
            <div style={{ marginTop: 4, opacity: 0.7, fontSize: "0.9em" }}>این کار تا حواله‌شدن کامل پیش‌فاکتور (یا بستن پیگیری آن) باز می‌ماند؛ هر حواله مسیر جدای خودش را برای مرحله‌های بعد دارد.</div>
          </>
        )}
        {d.stepDescription && <div style={{ opacity: 0.85, marginTop: 4 }}>{d.stepDescription}</div>}
        <div style={{ opacity: 0.8, marginTop: 4 }}>
          مهلت: {dt(d.dueAt)} {d.overdue && <span style={{ color: "var(--danger, #c0392b)" }}>(عقب‌افتاده)</span>}
          {" — "}{d.completion === "EVENT" ? "بسته‌شدن خودکار با ثبت سند" : `توضیح ${d.requireNote ? "اجباری" : "اختیاری"}، مدرک ${d.requireAttachment ? "اجباری" : "اختیاری"}`}
        </div>
      </div>

      {d.summary && (
        <div className="card" style={{ padding: 12, marginBottom: 8 }}>
          <h4 style={{ margin: "0 0 6px" }}>{d.summary.title} (فقط‌خواندنی)</h4>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 4 }}>
            {d.summary.fields.map((f) => <div key={f.label}><span style={{ opacity: 0.7 }}>{f.label}: </span>{f.isDate ? formatJalaliDate(f.value) : f.value}</div>)}
          </div>
          {d.summary.lines.length > 0 && (
            <div className="grid-scroll-area" style={{ marginTop: 8, maxHeight: 220 }}>
              <table className="je-lines-table">
                <thead><tr><th>کالا/خدمت</th><th>مقدار</th>{d.summary.kind !== "SALES_DELIVERY" && <><th>فی</th><th>مبلغ</th></>}</tr></thead>
                <tbody>{d.summary.lines.map((l, i) => <tr key={i}><td>{l.title}</td><td>{formatAmountFa(l.quantity)}</td>{d.summary!.kind !== "SALES_DELIVERY" && <><td>{formatAmountFa(l.unitPrice)}</td><td>{formatAmountFa(l.amount - l.discount)}</td></>}</tr>)}</tbody>
              </table>
            </div>
          )}
          {d.summary.kind !== "SALES_DELIVERY" && <div style={{ marginTop: 6 }}>جمع (پس از تخفیف): <b>{formatAmountFa(d.summary.total)}</b></div>}
        </div>
      )}

      {d.events.length > 0 && (
        <div className="card" style={{ padding: 12, marginBottom: 8 }}>
          <h4 style={{ margin: "0 0 6px" }}>رویدادهای سندهای مرتبط</h4>
          {d.events.map((e, i) => <div key={i}>{EVENT_FA[e.eventType] ?? e.eventType}{e.docNumber ? ` — شماره ${toFaDigits(String(e.docNumber))}` : ""} <span style={{ opacity: 0.7 }}>({dt(e.at)})</span></div>)}
        </div>
      )}

      <div className="card" style={{ padding: 12, marginBottom: 8 }}>
        <h4 style={{ margin: "0 0 6px" }}>مدارک{d.completion === "MANUAL" && d.requireAttachment && <RequiredMark />}</h4>
        {d.attachments.length === 0 ? <div style={{ opacity: 0.7 }}>مدرکی پیوست نشده است.</div> : d.attachments.map((a) => (
          <div key={a.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button type="button" className="link-btn" onClick={() => openAttachment(a.id).catch((e) => showError((e as ApiError).message))}>{a.fileName}</button>
            <span style={{ opacity: 0.7 }}>{toFaDigits(String(Math.round(a.size / 1024)))} کیلوبایت</span>
            {active && a.mine && <button type="button" className="btn-link" onClick={() => run(() => api.del(`/workflow/attachments/${a.id}`))}>حذف</button>}
          </div>
        ))}
        {active && canAct && d.completion === "MANUAL" && (
          <>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" capture="environment" style={{ display: "none" }} onChange={onFile} />
            <button type="button" className="btn secondary" style={{ marginTop: 6 }} disabled={busy} onClick={() => fileRef.current?.click()}>افزودن مدرک (عکس / PDF)</button>
          </>
        )}
      </div>

      {active && canAct && (
        <div className="card" style={{ padding: 12, marginBottom: 8 }}>
          {d.completion === "EVENT" && <span style={{ marginInlineEnd: 6 }}><WorkflowTaskAction task={{ id: d.id, status: d.status, isMine: d.isMine, canClaim: d.canClaim, completionEvent: d.completionEvent ?? null, quoteId: d.quoteId ?? null, deliveryId: d.deliveryId ?? null, actionContext: d.actionContext }} onClaimed={load} /></span>}
          {d.canClaim && <button type="button" className="btn secondary" disabled={busy} onClick={() => run(() => api.post(`/workflow/tasks/${taskId}/claim`, {}), "کار برداشته شد")}>برداشتن کار</button>}
          {d.status === "CLAIMED" && d.isMine && <button type="button" className="btn secondary" disabled={busy} style={{ marginInlineStart: 6 }} onClick={() => run(() => api.post(`/workflow/tasks/${taskId}/release`, {}), "کار رها شد")}>رها کردن</button>}
          {d.completion === "MANUAL" && d.canComplete && (
            <div style={{ marginTop: 8 }}>
              <label>توضیح انجام کار{d.requireNote && <RequiredMark />}</label>
              <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} style={{ width: "100%" }} />
              <button type="button" className="btn" style={{ marginTop: 6 }} disabled={busy} onClick={() => run(async () => { await api.post(`/workflow/tasks/${taskId}/complete`, { note }); navigate("/my-tasks"); }, "کار انجام شد")}>انجام شد</button>
            </div>
          )}
        </div>
      )}
      {active && canReassign && (
        <div className="card" style={{ padding: 12, marginBottom: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
          <select value={toUser} onChange={(e) => setToUser(e.target.value)}><option value="">واگذاری به…</option>{users.map((u) => <option key={u.id} value={u.id}>{u.title}</option>)}</select>
          <button type="button" className="btn secondary" disabled={busy || !toUser} onClick={() => run(() => api.post(`/workflow/tasks/${taskId}/reassign`, { userId: Number(toUser) }), "کار واگذار شد")}>واگذاری</button>
        </div>
      )}
      {d.status === "DONE" && d.note && <div className="card" style={{ padding: 12, marginBottom: 8 }}><b>توضیح:</b> {d.note}</div>}

      <div className="card" style={{ padding: 12 }}>
        <h4 style={{ margin: "0 0 6px" }}>تاریخچه</h4>
        {d.logs.map((l, i) => <div key={i} style={{ opacity: 0.9 }}>{dt(l.at)} — {ACTION_FA[l.action] ?? l.action}{l.userName ? ` (${l.userName})` : ""}{l.message ? `: ${l.message}` : ""}</div>)}
      </div>
    </div>
  );
}
