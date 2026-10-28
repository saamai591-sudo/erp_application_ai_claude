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
import { useTabs } from "../lib/TabsContext";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { EmployeePickerField, useEmployeeOptions } from "./AttendancePunches";

// مدیریت تردد › درخواست‌های پرسنلی › «درخواست ماموریت»: کارمند + «نوع درخواست» (ماهیت ماموریت؛ روزانه یا ساعتی‌بودن از واحد آن می‌آید و چک‌باکس «ساعتی» نداریم) + روزانه (از تاریخ تا تاریخ) یا ساعتی (یک تاریخ + ساعت شروع/پایان) + مقصد + شرح.
// «ثبت‌شده» ← تایید / رد (با دلیل) ← برگشت. تاییدشده = روزهای ماموریت غیبت نمی‌خورد. برای تاییدشده‌ی روزانه تا قبل از «پایان ماموریت» فقط «تا تاریخ» قابل تغییر است
// (تمدید/کوتاه‌کردن)؛ «پایان ماموریت» تاریخ پایان را قطعی می‌کند و کل بازه در ماهِ پایان به تفکیک نوع درخواست احتساب می‌شود؛ نوع درخواستی که «نوع ماموریت» (گزارش) دارد برای محاسبه گزارشِ تاییدشده می‌خواهد. قواعد در سرور.

/** نوع درخواستِ ماهیت ماموریت؛ واحدش تعیین می‌کند فرم روزانه است یا ساعتی */
interface TypeOpt {
  id: number;
  title: string;
  isActive: boolean;
  unit: "DAILY" | "HOURLY";
  requiresReport: boolean;
}
interface ReqRow {
  id: number;
  number: number;
  employeeId: number;
  personnelCode: string;
  employeeName: string;
  requestTypeId: number;
  requestTypeTitle: string;
  requiresReport: boolean;
  fromDate: string;
  toDate: string;
  plannedToDate: string;
  hourly: boolean;
  startMinute: number | null;
  endMinute: number | null;
  periodText: string;
  amountText: string;
  destination: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  statusTitle: string;
  decisionNote: string;
  ended: boolean;
  canEditEnd: boolean;
  locked: boolean;
  reportCount: number;
  updatedAt?: string;
}

const dateText = (r: ReqRow) => (r.fromDate === r.toDate ? formatJalaliDate(r.fromDate) : `${formatJalaliDate(r.fromDate)} تا ${formatJalaliDate(r.toDate)}`);
const stageText = (r: ReqRow) => (r.status !== "APPROVED" || r.hourly ? "" : r.ended ? "پایان‌یافته" : "در جریان");

export default function AttendanceMissionRequests() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <ReqForm />;
  if (location.pathname.endsWith("/edit")) return <ReqForm editId={Number(id)} />;
  return <ReqList />;
}

function ReqList() {
  const cacheKey = "/attendance-mission-requests";
  const [status, setStatus] = usePersistedState(`${cacheKey}:status`, "");
  const [items, setItems] = usePersistedState<ReqRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get(`/attendance-mission-requests${status ? `?status=${status}` : ""}`).then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: ReqRow) {
    try {
      await api.del(`/attendance-mission-requests/${row.id}`);
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
          <InfoHint title="درخواست ماموریت" text="ماموریت روزانه (از تاریخ تا تاریخ) یا ساعتی. درخواست «تاییدشده» غیبتِ روزهای ماموریت را برمی‌دارد. برای ماموریت روزانه، تا قبل از «پایان ماموریت» می‌توان «تا تاریخ» را تغییر داد؛ با ثبت پایان، کل روزهای ماموریت در ماهِ پایان به تفکیک نوع درخواست احتساب می‌شود. برای نوع درخواستی که «نوع ماموریت» (گزارش) دارد، «محاسبه تردد» گزارشِ تاییدشده می‌خواهد." />
          <NewRecordButton path="/attendance-mission-requests/new" />
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
          { header: "نوع درخواست", ...s((r) => r.requestTypeTitle), width: "140px" },
          { header: "تاریخ", ...s((r) => dateText(r)), width: "190px" },
          { header: "ساعت", ...s((r) => (r.hourly ? toFaDigits(r.periodText) : "تمام‌روز")), width: "170px" },
          { header: "مدت", ...s((r) => toFaDigits(r.amountText)), width: "100px" },
          { header: "مقصد", ...s((r) => r.destination) },
          { header: "وضعیت", ...s((r) => r.statusTitle), width: "100px" },
          { header: "مرحله", ...s((r) => stageText(r)), width: "100px" },
          { header: "گزارش‌ها", ...s((r) => (r.reportCount ? toFaDigits(String(r.reportCount)) : "")), width: "80px" },
          { header: "دلیل رد", ...s((r) => r.decisionNote) },
        ]}
        rows={items}
        edit={{ path: (r: ReqRow) => `/attendance-mission-requests/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function ReqForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { openTab } = useTabs();
  const { hasPermission } = usePermissions();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, { employeeId: "", requestTypeId: "", fromDate: localTodayIso(), toDate: "", start: "", end: "", destination: "", reason: "" });
  const [meta, setMeta] = useState<ReqRow | null>(null);
  const [types, setTypes] = useState<TypeOpt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [finishOpen, setFinishOpen] = useState(false);
  const [finishDate, setFinishDate] = useState("");
  const [busy, setBusy] = useState(false);
  const employees = useEmployeeOptions();
  const { flash } = useSavedFlash();

  const toForm = (r: ReqRow) => ({ employeeId: String(r.employeeId), requestTypeId: String(r.requestTypeId), fromDate: r.fromDate, toDate: r.toDate === r.fromDate ? "" : r.toDate, start: r.startMinute !== null ? minutesToMask(r.startMinute) : "", end: r.endMinute !== null ? minutesToMask(r.endMinute) : "", destination: r.destination, reason: r.reason });
  async function load() {
    const r: ReqRow = await api.get(`/attendance-mission-requests/${editId}`);
    setMeta(r);
    return r;
  }
  useEffect(() => {
    api.get("/attendance-request-types?nature=MISSION").then((r: TypeOpt[]) => setTypes(r)).catch(() => {});
    if (!editId) return;
    load().then((r) => {
      if (!hasPersistedState(cacheKey)) setForm(toForm(r));
      setLoaded(true);
    }).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // واحد نوع درخواست تعیین می‌کند ساعتی است یا روزانه (در ویرایش، از خود درخواست)
  const reqType = types.find((t) => String(t.id) === form.requestTypeId);
  const hourly = reqType ? reqType.unit === "HOURLY" : !!meta?.hourly;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    // تاییدشده‌ی پایان‌نیافته: فقط «تا تاریخ»
    if (editId && meta?.canEditEnd) {
      try {
        await api.put(`/attendance-mission-requests/${editId}`, { toDate: form.toDate || form.fromDate, updatedAt: meta.updatedAt });
        flash();
        setForm(toForm(await load()));
      } catch (err) {
        setError((err as ApiError).message);
      }
      return;
    }
    if (!form.employeeId) return setError("کارمند را انتخاب کنید");
    if (!form.requestTypeId) return setError("نوع درخواست را انتخاب کنید");
    if (!form.fromDate) return setError("تاریخ الزامی است");
    if (!form.destination.trim()) return setError("مقصد ماموریت الزامی است");
    if (!form.reason.trim()) return setError("شرح ماموریت الزامی است");
    let startMinute: number | null = null, endMinute: number | null = null;
    if (hourly) {
      startMinute = maskToMinutes(form.start);
      endMinute = maskToMinutes(form.end);
      if (startMinute === null || endMinute === null) return setError("ساعت شروع و پایان ماموریت را کامل وارد کنید");
    }
    const body = { employeeId: Number(form.employeeId), requestTypeId: Number(form.requestTypeId), fromDate: form.fromDate, toDate: form.toDate || form.fromDate, startMinute, endMinute, destination: form.destination, reason: form.reason };
    try {
      if (editId) {
        await api.put(`/attendance-mission-requests/${editId}`, { ...body, updatedAt: meta?.updatedAt });
        flash();
        await load();
      } else {
        const created = await api.post("/attendance-mission-requests", body);
        flash();
        navigate(`/attendance-mission-requests/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function act(path: "approve" | "unapprove" | "reject" | "finish" | "unfinish", body: object = {}) {
    setBusy(true);
    try {
      await api.post(`/attendance-mission-requests/${editId}/${path}`, body);
      setRejectOpen(false);
      setRejectNote("");
      setFinishOpen(false);
      setForm(toForm(await load()));
    } catch (e) {
      showError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/attendance-mission-requests/${editId}`);
      navigate("/attendance-mission-requests");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  const pending = !editId || meta?.status === "PENDING";
  const canEditEnd = !!meta?.canEditEnd;
  const P = "attendance.requests.attendance-mission-requests";
  const daily = !!meta && !meta.hourly;
  const extra = editId && meta ? (
    <>
      {meta.status === "PENDING" && hasPermission(`${P}.approve`) && <button type="button" className="btn" disabled={busy} onClick={() => act("approve")}>تایید</button>}
      {meta.status === "PENDING" && hasPermission(`${P}.reject`) && <button type="button" className="btn secondary" disabled={busy} onClick={() => setRejectOpen(true)}>رد</button>}
      {meta.status === "APPROVED" && daily && !meta.ended && hasPermission(`${P}.finish`) && <button type="button" className="btn" disabled={busy} onClick={() => { setFinishDate(form.toDate || form.fromDate); setFinishOpen(true); }}>پایان ماموریت</button>}
      {meta.ended && !meta.locked && hasPermission(`${P}.finish`) && <button type="button" className="btn secondary" disabled={busy} onClick={() => act("unfinish")}>برگشت پایان</button>}
      {meta.ended && meta.requiresReport && hasPermission("attendance.operations.attendance-mission-reports.create") && !meta.locked && <button type="button" className="btn secondary" onClick={() => openTab(`/attendance-mission-reports/new?requestId=${meta.id}`)}>ثبت گزارش ماموریت</button>}
      {meta.status !== "PENDING" && !meta.ended && hasPermission(`${P}.unapprove`) && <button type="button" className="btn secondary" disabled={busy} onClick={() => act("unapprove")}>برگشت از {meta.status === "APPROVED" ? "تایید" : "رد"}</button>}
    </>
  ) : null;

  return (
    <FormPage title={editId ? `درخواست ماموریت شماره ${toFaDigits(String(meta?.number ?? ""))}` : "درخواست ماموریت جدید"} formId="attendance-mission-form" closePath="/attendance-mission-requests" newPath="/attendance-mission-requests/new" onDelete={editId && meta?.status !== "APPROVED" ? handleDelete : undefined} toolbarExtra={extra}>
      <form id="attendance-mission-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        {meta && (
          <div className={meta.status === "REJECTED" ? "alert warn" : "alert"} style={{ marginBottom: 12, maxWidth: 900 }}>
            <b>وضعیت: {meta.statusTitle}{meta.status === "APPROVED" && daily ? (meta.ended ? " — پایان‌یافته" : " — در جریان") : ""}</b>
            {meta.status === "APPROVED" && !meta.ended && daily && <div style={{ marginTop: 4, fontSize: 13 }}>روزهای ماموریت غیبت نمی‌خورد. تا ثبت «پایان ماموریت» می‌توانید «تا تاریخ» را تغییر دهید (نه در ماهی که «محاسبه تردد»ش برای این کارمند انجام شده). پایان برنامه‌ای ثبت‌اولیه: {formatJalaliDate(meta.plannedToDate)}.</div>}
            {meta.status === "APPROVED" && meta.ended && <div style={{ marginTop: 4, fontSize: 13 }}>پایان ماموریت ثبت شده است؛ کل بازه ({toFaDigits(meta.amountText)}) در ماهِ پایان به تفکیک نوع احتساب می‌شود.{meta.locked ? " «محاسبه تردد» آن ماه انجام شده و ماموریت قفل است." : ""}</div>}
            {meta.status === "APPROVED" && meta.hourly && <div style={{ marginTop: 4, fontSize: 13 }}>ماموریت ساعتی تاییدشده ویرایش نمی‌شود و «پایان» ندارد؛ برای تغییر ابتدا برگشت از تایید کنید.</div>}
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
              <label>نوع درخواست<RequiredMark /> <FieldHint label="نوع درخواست" text="روزانه یا ساعتی‌بودن ماموریت از واحدِ «نوع درخواست» (تنظیمات › نوع درخواست) می‌آید. ماموریت ساعتی «پایان ماموریت» و گزارش ندارد: یک بازه‌ی پیوسته از تاریخ و ساعت شروع تا تاریخ و ساعت پایان (حداکثر ۲۴ ساعت) که فقط بخش هم‌پوشان با بازه‌های کاریِ شیفت غیبت را برمی‌دارد." /></label>
              <select value={form.requestTypeId} onChange={(e) => setForm({ ...form, requestTypeId: e.target.value })}>
                <option value="">— انتخاب کنید —</option>
                {types.filter((t) => t.isActive || String(t.id) === form.requestTypeId).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
              {reqType && <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{hourly ? "ساعتی" : "روزانه"}{reqType.requiresReport ? " — این نوع برای محاسبه گزارش ماموریتِ تاییدشده می‌خواهد" : ""}</div>}
            </div>
            <div className="form-field">
              <label>از تاریخ<RequiredMark /></label>
              <JalaliDatePicker value={form.fromDate} onChange={(v) => setForm({ ...form, fromDate: v })} />
            </div>
            {hourly && (
              <div className="form-field">
                <label>از ساعت<RequiredMark /></label>
                <TimeInput value={form.start} width={90} placeholder="08:00" onChange={(t) => setForm({ ...form, start: t })} />
              </div>
            )}
          </div>
        </fieldset>
        <fieldset disabled={!pending && !canEditEnd} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="form-grid">
            <div className="form-field">
              <label>تا تاریخ <FieldHint label="تا تاریخ" text={hourly ? "خالی = همان تاریخ شروع (برای ماموریت شبانه تاریخ روز بعد را بگذارید)." : "خالی = فقط همان یک روز. برای ماموریتِ تاییدشده‌ی پایان‌نیافته فقط همین فیلد قابل تغییر است (تمدید یا کوتاه‌کردن) و ذخیره کنترل می‌کند که قبل از آخرین ماهِ محاسبه‌شده‌ی حقوق نباشد."} /></label>
              <JalaliDatePicker value={form.toDate} onChange={(v) => setForm({ ...form, toDate: v })} />
            </div>
            {hourly && pending && (
              <div className="form-field">
                <label>تا ساعت<RequiredMark /></label>
                <TimeInput value={form.end} width={90} placeholder="12:00" onChange={(t) => setForm({ ...form, end: t })} />
              </div>
            )}
          </div>
        </fieldset>
        <fieldset disabled={!pending} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="form-grid">
            <div className="form-field">
              <label>مقصد<RequiredMark /></label>
              <input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
            </div>
            <div className="form-field" style={{ gridColumn: "1 / -1" }}>
              <label>شرح ماموریت<RequiredMark /></label>
              <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </div>
          </div>
        </fieldset>
        {meta && (
          <div className="alert" style={{ marginTop: 10, maxWidth: 900, fontSize: 14 }}>
            مدت ماموریت: <b>{toFaDigits(meta.amountText)}</b>
            <FieldHint label="مدت ماموریت" text="ماموریت روزانه: تعداد روزهای تقویمی از تاریخ شروع تا پایان (با تعطیلی‌ها). ماموریت ساعتی: ساعت:دقیقه‌ی بازه‌ی درخواستی." />
          </div>
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
      {finishOpen && (
        <Modal title="پایان ماموریت" onClose={() => setFinishOpen(false)}>
          <div className="form-field">
            <label>تاریخ پایان واقعی ماموریت (آخرین روز ماموریت)<RequiredMark /> <FieldHint label="پایان ماموریت" text="آخرین روزِ ماموریت، همان روز هم ماموریت حساب می‌شود. بعد از ثبت، کل بازه در ماهِ این تاریخ احتساب می‌شود و «تا تاریخ» دیگر تغییر نمی‌کند. تاریخ نمی‌تواند در آینده یا قبل از آخرین ماهِ محاسبه‌شده‌ی حقوق کارمند باشد." /></label>
            <JalaliDatePicker value={finishDate} onChange={setFinishDate} />
          </div>
          <div className="actions">
            <button type="button" className="btn" disabled={busy || !finishDate} onClick={() => act("finish", { endDate: finishDate })}>ثبت پایان ماموریت</button>
            <button type="button" className="btn secondary" onClick={() => setFinishOpen(false)}>انصراف</button>
          </div>
        </Modal>
      )}
    </FormPage>
  );
}
