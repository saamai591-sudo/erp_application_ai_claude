import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { Modal } from "../components/Modal";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { TimeInput, maskToMinutes, minutesToMask } from "../components/TimeInput";
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate, localTodayIso } from "../lib/formatDate";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePermissions } from "../lib/usePermissions";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { EmployeePickerField, useEmployeeOptions } from "./AttendancePunches";

// مدیریت تردد › عملیات › «درخواست اصلاح تردد» (مثلاً فراموشی ثبت ورود/خروج): کارمند + روز + ترددهای درخواستی + دلیل. با «تایید» ترددها با منبع «درخواست اصلاح»
// در فرم «ورود و خروج» ثبت می‌شوند؛ «رد» دلیل می‌خواهد؛ «برگشت از تایید/رد» ترددهای ساخته‌شده را حذف و درخواست را دوباره «ثبت‌شده» می‌کند. قواعد در سرور.

interface ReqRow {
  id: number;
  number: number;
  employeeId: number;
  personnelCode: string;
  employeeName: string;
  date: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  statusTitle: string;
  decisionNote: string;
  lineSummary: string;
  lines: { minute: number; time: string }[];
  updatedAt?: string;
}

export default function AttendanceCorrectionRequests() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <ReqForm />;
  if (location.pathname.endsWith("/edit")) return <ReqForm editId={Number(id)} />;
  return <ReqList />;
}

function ReqList() {
  const cacheKey = "/attendance-correction-requests";
  const [status, setStatus] = usePersistedState(`${cacheKey}:status`, "");
  const [items, setItems] = usePersistedState<ReqRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get(`/attendance-correction-requests${status ? `?status=${status}` : ""}`).then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: ReqRow) {
    try {
      await api.del(`/attendance-correction-requests/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: ReqRow) => string, extra: object = {}) => ({ render: (r: ReqRow) => f(r), filterType: "string" as const, filterValue: (r: ReqRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="درخواست اصلاح تردد" text="برای ترددی که فراموش شده یا اشتباه ثبت شده است. با تایید، ترددهای درخواستی در «ورود و خروج» ثبت می‌شوند (با منبع «درخواست اصلاح» و قابل تفکیک از ورود مستقیم)." />
          <NewRecordButton path="/attendance-correction-requests/new" />
          <RefreshButton onClick={reload} />
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ marginInlineStart: 8 }}>
            <option value="">همه‌ی وضعیت‌ها</option>
            <option value="PENDING">ثبت‌شده</option>
            <option value="APPROVED">تاییدشده</option>
            <option value="REJECTED">ردشده</option>
          </select>
          <button type="button" className="btn secondary" onClick={reload}>نمایش</button>
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "شماره", ...s((r) => toFaDigits(String(r.number))), width: "80px" },
          { header: "کد پرسنلی", ...s((r) => toFaDigits(r.personnelCode)), width: "110px" },
          { header: "کارمند", ...s((r) => r.employeeName) },
          { header: "تاریخ", ...s((r) => formatJalaliDate(r.date)), width: "110px" },
          { header: "ترددهای درخواستی", ...s((r) => toFaDigits(r.lineSummary)) },
          { header: "دلیل", ...s((r) => r.reason) },
          { header: "وضعیت", ...s((r) => r.statusTitle), width: "110px" },
          { header: "دلیل رد", ...s((r) => r.decisionNote) },
        ]}
        rows={items}
        edit={{ path: (r: ReqRow) => `/attendance-correction-requests/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

interface Line {
  time: string;
}
const emptyLine = (): Line => ({ time: "" });

function ReqForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = usePermissions();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, { employeeId: "", date: localTodayIso(), reason: "", lines: [emptyLine()] as Line[] });
  const [meta, setMeta] = useState<{ number: number; status: string; statusTitle: string; decisionNote: string; updatedAt?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [busy, setBusy] = useState(false);
  const employees = useEmployeeOptions();
  const { flash } = useSavedFlash();

  async function load() {
    const r: ReqRow = await api.get(`/attendance-correction-requests/${editId}`);
    setMeta({ number: r.number, status: r.status, statusTitle: r.statusTitle, decisionNote: r.decisionNote, updatedAt: r.updatedAt });
    return r;
  }
  useEffect(() => {
    if (!editId) return;
    load().then((r) => {
      if (!hasPersistedState(cacheKey)) setForm({ employeeId: String(r.employeeId), date: r.date, reason: r.reason, lines: r.lines.map((l) => ({ time: minutesToMask(l.minute) })) });
      setLoaded(true);
    }).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const setLine = (i: number, patch: Partial<Line>) => setForm({ ...form, lines: form.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.employeeId) return setError("کارمند را انتخاب کنید");
    if (!form.date) return setError("تاریخ الزامی است");
    if (!form.reason.trim()) return setError("دلیل درخواست الزامی است");
    const filled = form.lines.filter((l) => l.time.trim());
    if (filled.length === 0) return setError("دست‌کم یک تردد درخواستی وارد کنید");
    const lines = [];
    for (const [i, l] of filled.entries()) {
      const m = maskToMinutes(l.time);
      if (m === null || m >= 1440) return setError(`ساعت ردیف ${toFaDigits(String(i + 1))} نامعتبر است (۰۰:۰۰ تا ۲۳:۵۹)`);
      lines.push({ minute: m });
    }
    try {
      const body = { employeeId: Number(form.employeeId), date: form.date, reason: form.reason, lines };
      if (editId) {
        await api.put(`/attendance-correction-requests/${editId}`, { ...body, updatedAt: meta?.updatedAt });
        flash();
        await load();
      } else {
        const created = await api.post("/attendance-correction-requests", body);
        flash();
        navigate(`/attendance-correction-requests/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function act(path: "approve" | "unapprove" | "reject", body: object = {}) {
    setBusy(true);
    try {
      await api.post(`/attendance-correction-requests/${editId}/${path}`, body);
      setRejectOpen(false);
      setRejectNote("");
      await load();
      // فرم از سرور تازه شود (حافظه‌ی فرم ممکن است کهنه باشد)
      const r: ReqRow = await api.get(`/attendance-correction-requests/${editId}`);
      setForm({ employeeId: String(r.employeeId), date: r.date, reason: r.reason, lines: r.lines.map((l) => ({ time: minutesToMask(l.minute) })) });
    } catch (e) {
      showError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/attendance-correction-requests/${editId}`);
      navigate("/attendance-correction-requests");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  const pending = !editId || meta?.status === "PENDING";
  const extra = editId && meta ? (
    <>
      {meta.status === "PENDING" && hasPermission("attendance.operations.attendance-correction-requests.approve") && <button type="button" className="btn" disabled={busy} onClick={() => act("approve")}>تایید</button>}
      {meta.status === "PENDING" && hasPermission("attendance.operations.attendance-correction-requests.reject") && <button type="button" className="btn secondary" disabled={busy} onClick={() => setRejectOpen(true)}>رد</button>}
      {meta.status !== "PENDING" && hasPermission("attendance.operations.attendance-correction-requests.unapprove") && <button type="button" className="btn secondary" disabled={busy} onClick={() => act("unapprove")}>برگشت از {meta.status === "APPROVED" ? "تایید" : "رد"}</button>}
    </>
  ) : null;

  return (
    <FormPage title={editId ? `درخواست اصلاح تردد شماره ${toFaDigits(String(meta?.number ?? ""))}` : "درخواست اصلاح تردد جدید"} formId="attendance-correction-form" closePath="/attendance-correction-requests" newPath="/attendance-correction-requests/new" onDelete={editId && meta?.status !== "APPROVED" ? handleDelete : undefined} toolbarExtra={extra}>
      <form id="attendance-correction-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        {meta && (
          <div className={meta.status === "REJECTED" ? "alert warn" : "alert"} style={{ marginBottom: 12, maxWidth: 900 }}>
            <b>وضعیت: {meta.statusTitle}</b>
            {meta.status === "APPROVED" && <div style={{ marginTop: 4, fontSize: 13 }}>ترددهای این درخواست در «ورود و خروج» با منبع «درخواست اصلاح» ثبت شده‌اند. برای ویرایش، ابتدا برگشت از تایید کنید.</div>}
            {meta.status === "REJECTED" && <div style={{ marginTop: 4, fontSize: 13 }}>دلیل رد: {meta.decisionNote || "—"}</div>}
          </div>
        )}
        <fieldset disabled={!pending} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="form-grid">
            <div className="form-field">
              <label>کارمند<RequiredMark /></label>
              <EmployeePickerField employees={employees} value={form.employeeId} onSelect={(x) => setForm({ ...form, employeeId: String(x.id) })} />
            </div>
            <div className="form-field">
              <label>تاریخ<RequiredMark /></label>
              <JalaliDatePicker value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
            </div>
            <div className="form-field" style={{ gridColumn: "1 / -1" }}>
              <label>دلیل درخواست<RequiredMark /></label>
              <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </div>
          </div>
          <h4 style={{ margin: "14px 0 6px" }}>
            ترددهای درخواستی <FieldHint label="ترددهای درخواستی" text="ترددهایی که باید برای این روز ثبت شوند. اگر در همان ساعت قبلاً تردد ثبت شده باشد، تایید رد می‌شود." />
          </h4>
          <table className="je-lines-table" style={{ maxWidth: 360 }}>
            <thead>
              <tr><th style={{ width: 50 }}>ردیف</th><th style={{ width: 120 }}>ساعت</th><th style={{ width: 40 }}></th></tr>
            </thead>
            <tbody>
              {form.lines.map((l, i) => (
                <tr key={i}>
                  <td>{toFaDigits(String(i + 1))}</td>
                  <td><TimeInput value={l.time} width={90} onChange={(t) => setLine(i, { time: t })} /></td>
                  <td>{form.lines.length > 1 && <button type="button" className="btn-link" onClick={() => setForm({ ...form, lines: form.lines.filter((_, j) => j !== i) })}>×</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="btn secondary" style={{ marginTop: 6 }} onClick={() => setForm({ ...form, lines: [...form.lines, emptyLine()] })}>+ ردیف</button>
        </fieldset>
      </form>
      {rejectOpen && (
        <Modal title="رد درخواست" onClose={() => setRejectOpen(false)}>
          <div className="form-field">
            <label>دلیل رد<RequiredMark /></label>
            <input value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} autoFocus />
          </div>
          <div className="actions">
            <button type="button" className="btn" disabled={busy || !rejectNote.trim()} onClick={() => act("reject", { note: rejectNote })}>رد درخواست</button>
            <button type="button" className="btn secondary" onClick={() => setRejectOpen(false)}>انصراف</button>
          </div>
        </Modal>
      )}
    </FormPage>
  );
}
