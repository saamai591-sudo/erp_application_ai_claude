import { ChangeEvent, FormEvent, useEffect, useState } from "react";
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
import { API_URL } from "../lib/apiUrl";
import { api, ApiError, getToken } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePermissions } from "../lib/usePermissions";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { EmployeePickerField, useEmployeeOptions } from "./AttendancePunches";

// مدیریت تردد › عملیات › «درخواست مرخصی»: کارمند + نوع مرخصی + روزانه (از تاریخ تا تاریخ) یا ساعتی (یک تاریخ + ساعت شروع/پایان) + دلیل (+ پیوست). «ثبت‌شده» ← تایید / رد (با دلیل)
// ← برگشت؛ فقط «ثبت‌شده» ویرایش می‌شود و نوعی که «مدرک الزامی» دارد بدون پیوست تایید نمی‌شود. فقط درخواست تاییدشده در کارکرد/فرمول‌ها اثر دارد. قواعد در سرور.

type Unit = "DAY" | "BOTH";
interface TypeOpt {
  id: number;
  title: string;
  isActive: boolean;
  unit: Unit;
  requiresAttachment: boolean;
  deductsBalance: boolean;
}
interface Att {
  id: number;
  fileName: string;
  mimeType: string;
  size: number;
}
interface ReqRow {
  id: number;
  number: number;
  employeeId: number;
  personnelCode: string;
  employeeName: string;
  leaveTypeId: number;
  leaveTypeTitle: string;
  requiresAttachment: boolean;
  fromDate: string;
  toDate: string;
  hourly: boolean;
  startMinute: number | null;
  endMinute: number | null;
  periodText: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  statusTitle: string;
  decisionNote: string;
  attachments: Att[];
  attachmentCount: number;
  updatedAt?: string;
}

const MAX_BYTES = 5 * 1024 * 1024;
const dateText = (r: ReqRow) => (r.fromDate === r.toDate ? formatJalaliDate(r.fromDate) : `${formatJalaliDate(r.fromDate)} تا ${formatJalaliDate(r.toDate)}`);

async function openAttachment(id: number) {
  const res = await fetch(`${API_URL}/attendance-leave-attachments/${id}`, { headers: { Authorization: `Bearer ${getToken() ?? ""}` } });
  if (!res.ok) throw new ApiError((await res.json().catch(() => ({}))).error || "خطا در باز کردن پیوست");
  const url = URL.createObjectURL(await res.blob());
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export default function AttendanceLeaveRequests() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <ReqForm />;
  if (location.pathname.endsWith("/edit")) return <ReqForm editId={Number(id)} />;
  return <ReqList />;
}

function ReqList() {
  const cacheKey = "/attendance-leave-requests";
  const [status, setStatus] = usePersistedState(`${cacheKey}:status`, "");
  const [items, setItems] = usePersistedState<ReqRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get(`/attendance-leave-requests${status ? `?status=${status}` : ""}`).then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: ReqRow) {
    try {
      await api.del(`/attendance-leave-requests/${row.id}`);
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
          <InfoHint title="درخواست مرخصی" text="مرخصی روزانه (از تاریخ تا تاریخ) یا ساعتی (یک روز با ساعت شروع و پایان). فقط درخواست «تاییدشده» در کارکرد روزانه و فرمول‌ها اثر دارد: غیبتِ روز مرخصی برداشته می‌شود و متغیر «مرخصی <نوع>» مقدار می‌گیرد." />
          <NewRecordButton path="/attendance-leave-requests/new" />
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
          { header: "نوع مرخصی", ...s((r) => r.leaveTypeTitle), width: "130px" },
          { header: "تاریخ", ...s((r) => dateText(r)), width: "190px" },
          { header: "ساعت", ...s((r) => (r.hourly ? toFaDigits(r.periodText) : "تمام‌روز")), width: "190px" },
          { header: "دلیل", ...s((r) => r.reason) },
          { header: "پیوست", ...s((r) => (r.attachmentCount ? toFaDigits(String(r.attachmentCount)) : "")), width: "70px" },
          { header: "وضعیت", ...s((r) => r.statusTitle), width: "100px" },
          { header: "دلیل رد", ...s((r) => r.decisionNote) },
        ]}
        rows={items}
        edit={{ path: (r: ReqRow) => `/attendance-leave-requests/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function ReqForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = usePermissions();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, { employeeId: "", leaveTypeId: "", hourly: false, fromDate: localTodayIso(), toDate: "", start: "", end: "", reason: "" });
  const [meta, setMeta] = useState<{ number: number; status: string; statusTitle: string; decisionNote: string; updatedAt?: string; attachments: Att[] } | null>(null);
  const [types, setTypes] = useState<TypeOpt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [busy, setBusy] = useState(false);
  const employees = useEmployeeOptions();
  const { flash } = useSavedFlash();

  const toForm = (r: ReqRow) => ({ employeeId: String(r.employeeId), leaveTypeId: String(r.leaveTypeId), hourly: r.hourly, fromDate: r.fromDate, toDate: r.toDate === r.fromDate ? "" : r.toDate, start: r.startMinute !== null ? minutesToMask(r.startMinute) : "", end: r.endMinute !== null ? minutesToMask(r.endMinute) : "", reason: r.reason });
  async function load() {
    const r: ReqRow = await api.get(`/attendance-leave-requests/${editId}`);
    setMeta({ number: r.number, status: r.status, statusTitle: r.statusTitle, decisionNote: r.decisionNote, updatedAt: r.updatedAt, attachments: r.attachments });
    return r;
  }
  useEffect(() => {
    api.get("/attendance-leave-types").then((r: TypeOpt[]) => setTypes(r)).catch(() => {});
    if (!editId) return;
    load().then((r) => {
      if (!hasPersistedState(cacheKey)) setForm(toForm(r));
      setLoaded(true);
    }).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const type = types.find((t) => String(t.id) === form.leaveTypeId);
  const hourly = type?.unit === "DAY" ? false : form.hourly;
  // مانده‌ی کارمند برای نوعِ «دارای مانده مرخصی» (تا تاریخ شروع، بدون احتساب خودِ این درخواست)
  const [bal, setBal] = useState<{ text: string; date: string; balance: number; typeTitle: string } | null>(null);
  useEffect(() => {
    setBal(null);
    if (!form.employeeId || !type?.deductsBalance || !form.fromDate) return;
    let dead = false;
    api.get(`/attendance-leave-requests/balance/of?employeeId=${form.employeeId}&leaveTypeId=${type.id}&date=${form.fromDate}${editId ? `&excludeRequestId=${editId}` : ""}`).then((r) => { if (!dead) setBal(r); }).catch(() => {});
    return () => { dead = true; };
  }, [form.employeeId, form.fromDate, type?.id, type?.deductsBalance, editId, meta?.status]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.employeeId) return setError("کارمند را انتخاب کنید");
    if (!form.leaveTypeId) return setError("نوع مرخصی را انتخاب کنید");
    if (!form.fromDate) return setError("تاریخ الزامی است");
    if (!form.reason.trim()) return setError("دلیل درخواست الزامی است");
    let startMinute: number | null = null, endMinute: number | null = null;
    if (hourly) {
      startMinute = maskToMinutes(form.start);
      endMinute = maskToMinutes(form.end);
      if (startMinute === null || endMinute === null) return setError("ساعت شروع و پایان مرخصی را کامل وارد کنید");
    }
    const body = { employeeId: Number(form.employeeId), leaveTypeId: Number(form.leaveTypeId), hourly, fromDate: form.fromDate, toDate: form.toDate || form.fromDate, startMinute, endMinute, reason: form.reason };
    try {
      if (editId) {
        await api.put(`/attendance-leave-requests/${editId}`, { ...body, updatedAt: meta?.updatedAt });
        flash();
        await load();
      } else {
        const created = await api.post("/attendance-leave-requests", body);
        flash();
        navigate(`/attendance-leave-requests/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function act(path: "approve" | "unapprove" | "reject", body: object = {}) {
    setBusy(true);
    try {
      await api.post(`/attendance-leave-requests/${editId}/${path}`, body);
      setRejectOpen(false);
      setRejectNote("");
      setForm(toForm(await load()));
    } catch (e) {
      showError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !editId) return;
    if (f.size > MAX_BYTES) return showError("حجم فایل بیش از ۵ مگابایت است");
    if (!(f.type.startsWith("image/") || f.type === "application/pdf")) return showError("فقط تصویر یا PDF پذیرفته می‌شود");
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await api.post(`/attendance-leave-requests/${editId}/attachments`, { fileName: f.name, mimeType: f.type, dataBase64: String(reader.result).split(",")[1] ?? "" });
        await load();
      } catch (err) {
        showError((err as ApiError).message);
      }
    };
    reader.readAsDataURL(f);
  }
  async function removeAtt(a: Att) {
    try {
      await api.del(`/attendance-leave-attachments/${a.id}`);
      await load();
    } catch (err) {
      showError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/attendance-leave-requests/${editId}`);
      navigate("/attendance-leave-requests");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  const pending = !editId || meta?.status === "PENDING";
  const P = "attendance.operations.attendance-leave-requests";
  const extra = editId && meta ? (
    <>
      {meta.status === "PENDING" && hasPermission(`${P}.approve`) && <button type="button" className="btn" disabled={busy} onClick={() => act("approve")}>تایید</button>}
      {meta.status === "PENDING" && hasPermission(`${P}.reject`) && <button type="button" className="btn secondary" disabled={busy} onClick={() => setRejectOpen(true)}>رد</button>}
      {meta.status !== "PENDING" && hasPermission(`${P}.unapprove`) && <button type="button" className="btn secondary" disabled={busy} onClick={() => act("unapprove")}>برگشت از {meta.status === "APPROVED" ? "تایید" : "رد"}</button>}
    </>
  ) : null;

  return (
    <FormPage title={editId ? `درخواست مرخصی شماره ${toFaDigits(String(meta?.number ?? ""))}` : "درخواست مرخصی جدید"} formId="attendance-leave-form" closePath="/attendance-leave-requests" newPath="/attendance-leave-requests/new" onDelete={editId && meta?.status !== "APPROVED" ? handleDelete : undefined} toolbarExtra={extra}>
      <form id="attendance-leave-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        {meta && (
          <div className={meta.status === "REJECTED" ? "alert warn" : "alert"} style={{ marginBottom: 12, maxWidth: 900 }}>
            <b>وضعیت: {meta.statusTitle}</b>
            {meta.status === "APPROVED" && <div style={{ marginTop: 4, fontSize: 13 }}>این مرخصی در کارکرد روزانه و فرمول‌ها اثر دارد. برای ویرایش، ابتدا برگشت از تایید کنید.</div>}
            {meta.status === "REJECTED" && <div style={{ marginTop: 4, fontSize: 13 }}>دلیل رد: {meta.decisionNote || "—"}</div>}
            {meta.status === "PENDING" && type?.requiresAttachment && meta.attachments.length === 0 && <div style={{ marginTop: 4, fontSize: 13, color: "#b45309" }}>این نوع مرخصی مدرک الزامی دارد؛ بدون پیوست تایید نمی‌شود.</div>}
          </div>
        )}
        <fieldset disabled={!pending} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="form-grid">
            <div className="form-field">
              <label>کارمند<RequiredMark /></label>
              <EmployeePickerField employees={employees} value={form.employeeId} onSelect={(x) => setForm({ ...form, employeeId: String(x.id) })} />
            </div>
            <div className="form-field">
              <label>نوع مرخصی<RequiredMark /></label>
              <select value={form.leaveTypeId} onChange={(e) => setForm({ ...form, leaveTypeId: e.target.value })}>
                <option value="">— انتخاب کنید —</option>
                {types.filter((t) => t.isActive || String(t.id) === form.leaveTypeId).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
            {type?.unit === "BOTH" && (
              <div className="form-field">
                <label className="checkbox-row"><input type="checkbox" checked={form.hourly} onChange={(e) => setForm({ ...form, hourly: e.target.checked })} /> مرخصی ساعتی</label>
              </div>
            )}
            <div className="form-field">
              <label>از تاریخ<RequiredMark /></label>
              <JalaliDatePicker value={form.fromDate} onChange={(v) => setForm({ ...form, fromDate: v })} />
            </div>
            {hourly && (
              <div className="form-field">
                <label>از ساعت<RequiredMark /> <FieldHint label="مرخصی ساعتی" text="یک بازه‌ی پیوسته از تاریخ و ساعت شروع تا تاریخ و ساعت پایان (حداکثر ۲۴ ساعت؛ برای شیفت شب می‌تواند به روز بعد برسد). شروع و پایان باید داخل بازه‌های کاری شیفتِ کارمند باشند، با ترددهای ثبت‌شده تداخل نداشته باشند و فقط بخشی که با بازه‌های کاری هم‌پوشانی دارد مرخصی حساب می‌شود." /></label>
                <TimeInput value={form.start} width={90} placeholder="22:00" onChange={(t) => setForm({ ...form, start: t })} />
              </div>
            )}
            <div className="form-field">
              <label>تا تاریخ <FieldHint label="تا تاریخ" text={hourly ? "خالی = همان تاریخ شروع. برای مرخصی شبانه (مثلاً ۲۲:۰۰ تا ۰۲:۰۰) تاریخ روز بعد را بگذارید." : "خالی = فقط همان یک روز. روز غیرکاری (تعطیلی شیفت/رسمی) دقیقه‌ی مرخصی ندارد. با هر تردد ثبت‌شده در این تاریخ‌ها تداخل دارد."} /></label>
              <JalaliDatePicker value={form.toDate} onChange={(v) => setForm({ ...form, toDate: v })} />
            </div>
            {hourly && (
              <div className="form-field">
                <label>تا ساعت<RequiredMark /></label>
                <TimeInput value={form.end} width={90} placeholder="02:00" onChange={(t) => setForm({ ...form, end: t })} />
              </div>
            )}
            <div className="form-field" style={{ gridColumn: "1 / -1" }}>
              <label>دلیل درخواست<RequiredMark /></label>
              <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </div>
          </div>
        </fieldset>
        {bal && (
          <div className={bal.balance < 0 ? "alert warn" : "alert"} style={{ marginTop: 10, maxWidth: 900, fontSize: 13 }}>
            مانده‌ی «{bal.typeTitle}» تا تاریخ {formatJalaliDate(bal.date)} (بدون احتساب همین درخواست): <b>{toFaDigits(bal.text)}</b>
            <FieldHint label="مانده‌ی مرخصی" text="مانده = مانده‌ی دستی + استحقاق ماهانه − مصرف درخواست‌های ثبت‌شده و تاییدشده. اگر با این درخواست مانده در هر روزِ مصرف منفی شود و مرخصی منفی برای شیفت کارمند در آن تاریخ مجاز نباشد، ثبت و تایید رد می‌شود." />
          </div>
        )}
        {editId && meta ? (
          <>
            <h4 style={{ margin: "14px 0 6px" }}>پیوست‌ها{type?.requiresAttachment && <RequiredMark />}</h4>
            {meta.attachments.length === 0 ? <div style={{ opacity: 0.7, fontSize: 13 }}>پیوستی ثبت نشده است.</div> : meta.attachments.map((a) => (
              <div key={a.id} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 4 }}>
                <button type="button" className="link-btn" onClick={() => openAttachment(a.id).catch((e) => showError((e as ApiError).message))}>{a.fileName}</button>
                <span style={{ opacity: 0.6, fontSize: 12 }}>{toFaDigits(String(Math.max(1, Math.round(a.size / 1024))))} کیلوبایت</span>
                {meta.status === "PENDING" && <button type="button" className="btn-link" onClick={() => removeAtt(a)}>حذف</button>}
              </div>
            ))}
            {meta.status === "PENDING" && <input type="file" accept="image/*,application/pdf" onChange={onFile} style={{ marginTop: 6 }} />}
          </>
        ) : (
          <p style={{ opacity: 0.7, fontSize: 13 }}>پس از ثبت درخواست می‌توانید مدرک (تصویر یا PDF) پیوست کنید.</p>
        )}
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
