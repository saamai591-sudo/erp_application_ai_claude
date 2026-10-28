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
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePermissions } from "../lib/usePermissions";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// مدیریت تردد › عملیات › «گزارش ماموریت»: برای یک درخواستِ ماموریت روزانه‌ی پایان‌یافته، بازه‌ای از آن را به یک نوع ماموریت (مثلاً دریا) می‌برد. «ثبت‌شده» ← تایید / رد (با دلیل) ← برگشت.
// فقط گزارش تاییدشده شمرده می‌شود؛ روزهای بدون گزارش در «روز گزارش‌نشده‌ی نوع درخواست» می‌آید. نوع گزارش فقط از «نوع ماموریت»‌های وصل‌به‌نوعِ درخواستِ همان ماموریت انتخاب می‌شود. وقتی حقوقِ ماهِ پایانِ ماموریت محاسبه شده، گزارش قفل است. قواعد در سرور.

interface TypeOpt {
  id: number;
  title: string;
  isActive: boolean;
  requestTypeId: number;
}
interface ReqOpt {
  id: number;
  number: number;
  employeeName: string;
  personnelCode: string;
  destination: string;
  fromDate: string;
  toDate: string;
  requestTypeId: number;
  requestTypeTitle: string;
}
interface RepRow {
  id: number;
  number: number;
  requestId: number;
  requestNumber: number | null;
  personnelCode: string;
  employeeName: string;
  destination: string;
  requestFrom: string;
  requestTo: string;
  requestTypeId: number | null;
  requestTypeTitle: string;
  typeId: number;
  typeTitle: string;
  fromDate: string;
  toDate: string;
  days: number;
  description: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  statusTitle: string;
  decisionNote: string;
  locked: boolean;
  updatedAt?: string;
}

const range = (a: string, b: string) => (a === b ? formatJalaliDate(a) : `${formatJalaliDate(a)} تا ${formatJalaliDate(b)}`);

export default function AttendanceMissionReports() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <RepForm />;
  if (location.pathname.endsWith("/edit")) return <RepForm editId={Number(id)} />;
  return <RepList />;
}

function RepList() {
  const cacheKey = "/attendance-mission-reports";
  const [status, setStatus] = usePersistedState(`${cacheKey}:status`, "");
  const [items, setItems] = usePersistedState<RepRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get(`/attendance-mission-reports${status ? `?status=${status}` : ""}`).then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: RepRow) {
    try {
      await api.del(`/attendance-mission-reports/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: RepRow) => string, extra: object = {}) => ({ render: (r: RepRow) => f(r), filterType: "string" as const, filterValue: (r: RepRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="گزارش ماموریت" text="برای ماموریتِ پایان‌یافته، بازه‌ای از آن را به یک نوع ماموریت (مثلاً دریا) می‌برد. روزهای بدون گزارش به نوعِ خودِ درخواست (پیش‌فرض: نوع پایه) تعلق دارد. فقط گزارش «تاییدشده» در احتساب شمرده می‌شود." />
          <NewRecordButton path="/attendance-mission-reports/new" />
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
          { header: "ماموریت", ...s((r) => toFaDigits(String(r.requestNumber ?? ""))), width: "80px" },
          { header: "کد پرسنلی", ...s((r) => toFaDigits(r.personnelCode)), width: "110px" },
          { header: "کارمند", ...s((r) => r.employeeName) },
          { header: "مقصد", ...s((r) => r.destination) },
          { header: "بازه‌ی ماموریت", ...s((r) => range(r.requestFrom, r.requestTo)), width: "190px" },
          { header: "نوع درخواست", ...s((r) => r.requestTypeTitle), width: "120px" },
          { header: "نوع ماموریت (گزارش)", ...s((r) => r.typeTitle), width: "140px" },
          { header: "بازه‌ی گزارش", ...s((r) => range(r.fromDate, r.toDate)), width: "190px" },
          { header: "روز", ...s((r) => toFaDigits(String(r.days))), width: "60px" },
          { header: "وضعیت", ...s((r) => r.statusTitle), width: "100px" },
          { header: "دلیل رد", ...s((r) => r.decisionNote) },
        ]}
        rows={items}
        edit={{ path: (r: RepRow) => `/attendance-mission-reports/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function RepForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = usePermissions();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, { requestId: "", typeId: "", fromDate: "", toDate: "", description: "" });
  const [meta, setMeta] = useState<RepRow | null>(null);
  const [requests, setRequests] = useState<ReqOpt[]>([]);
  const [types, setTypes] = useState<TypeOpt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [busy, setBusy] = useState(false);
  const { flash } = useSavedFlash();

  const toForm = (r: RepRow) => ({ requestId: String(r.requestId), typeId: String(r.typeId), fromDate: r.fromDate, toDate: r.toDate === r.fromDate ? "" : r.toDate, description: r.description });
  async function load() {
    const r: RepRow = await api.get(`/attendance-mission-reports/${editId}`);
    setMeta(r);
    return r;
  }
  useEffect(() => {
    api.get("/attendance-mission-types").then((r: TypeOpt[]) => setTypes(r)).catch(() => {});
    api.get("/attendance-mission-reports/requests/options").then((r: ReqOpt[]) => {
      setRequests(r);
      // لینک «ثبت گزارش ماموریت» از فرم درخواست: ?requestId=
      const rid = new URLSearchParams(window.location.search).get("requestId");
      const pre = rid ? r.find((x) => String(x.id) === rid) : undefined;
      if (!editId && pre) setForm((f) => (f.requestId ? f : { ...f, requestId: String(pre.id), fromDate: pre.fromDate, toDate: pre.toDate === pre.fromDate ? "" : pre.toDate }));
    }).catch(() => {});
    if (!editId) return;
    load().then((r) => {
      if (!hasPersistedState(cacheKey)) setForm(toForm(r));
      setLoaded(true);
    }).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const req = requests.find((x) => String(x.id) === form.requestId);
  const reqTypeId = req?.requestTypeId ?? meta?.requestTypeId ?? undefined;

  function pickRequest(id: string) {
    const r = requests.find((x) => String(x.id) === id);
    setForm({ ...form, requestId: id, fromDate: r ? r.fromDate : form.fromDate, toDate: r ? (r.toDate === r.fromDate ? "" : r.toDate) : form.toDate });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.requestId) return setError("درخواست ماموریت را انتخاب کنید");
    if (!form.typeId) return setError("نوع ماموریت را انتخاب کنید");
    if (!form.fromDate) return setError("تاریخ شروع بازه الزامی است");
    const body = { requestId: Number(form.requestId), typeId: Number(form.typeId), fromDate: form.fromDate, toDate: form.toDate || form.fromDate, description: form.description };
    try {
      if (editId) {
        await api.put(`/attendance-mission-reports/${editId}`, { ...body, updatedAt: meta?.updatedAt });
        flash();
        await load();
      } else {
        const created = await api.post("/attendance-mission-reports", body);
        flash();
        navigate(`/attendance-mission-reports/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function act(path: "approve" | "unapprove" | "reject", body: object = {}) {
    setBusy(true);
    try {
      await api.post(`/attendance-mission-reports/${editId}/${path}`, body);
      setRejectOpen(false);
      setRejectNote("");
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
      await api.del(`/attendance-mission-reports/${editId}`);
      navigate("/attendance-mission-reports");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  const pending = !editId || meta?.status === "PENDING";
  const P = "attendance.operations.attendance-mission-reports";
  const extra = editId && meta ? (
    <>
      {meta.status === "PENDING" && hasPermission(`${P}.approve`) && <button type="button" className="btn" disabled={busy} onClick={() => act("approve")}>تایید</button>}
      {meta.status === "PENDING" && hasPermission(`${P}.reject`) && <button type="button" className="btn secondary" disabled={busy} onClick={() => setRejectOpen(true)}>رد</button>}
      {meta.status !== "PENDING" && hasPermission(`${P}.unapprove`) && <button type="button" className="btn secondary" disabled={busy} onClick={() => act("unapprove")}>برگشت از {meta.status === "APPROVED" ? "تایید" : "رد"}</button>}
    </>
  ) : null;

  return (
    <FormPage title={editId ? `گزارش ماموریت شماره ${toFaDigits(String(meta?.number ?? ""))}` : "گزارش ماموریت جدید"} formId="attendance-mission-report-form" closePath="/attendance-mission-reports" newPath="/attendance-mission-reports/new" onDelete={editId && meta?.status !== "APPROVED" ? handleDelete : undefined} toolbarExtra={extra}>
      <form id="attendance-mission-report-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        {meta && (
          <div className={meta.status === "REJECTED" ? "alert warn" : "alert"} style={{ marginBottom: 12, maxWidth: 900 }}>
            <b>وضعیت: {meta.statusTitle}</b>
            {meta.status === "APPROVED" && <div style={{ marginTop: 4, fontSize: 13 }}>این گزارش در احتسابِ ماموریت شمرده می‌شود.{meta.locked ? " «محاسبه تردد» ماهِ پایانِ ماموریت انجام شده و گزارش قفل است." : " برای ویرایش، ابتدا برگشت از تایید کنید."}</div>}
            {meta.status === "REJECTED" && <div style={{ marginTop: 4, fontSize: 13 }}>دلیل رد: {meta.decisionNote || "—"}</div>}
          </div>
        )}
        <fieldset disabled={!pending} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="form-grid">
            <div className="form-field" style={{ gridColumn: "1 / -1" }}>
              <label>درخواست ماموریت<RequiredMark /> <FieldHint label="درخواست ماموریت" text="فقط درخواست‌های ماموریتِ روزانه‌ی تاییدشده و پایان‌یافته (که ماه پایانشان هنوز در حقوق محاسبه نشده) فهرست می‌شوند." /></label>
              {editId && meta ? (
                <input disabled value={`ماموریت ${toFaDigits(String(meta.requestNumber ?? ""))} — ${toFaDigits(meta.personnelCode)} ${meta.employeeName} — ${meta.destination} (${range(meta.requestFrom, meta.requestTo)}، نوع ${meta.requestTypeTitle})`} />
              ) : (
                <select value={form.requestId} onChange={(e) => pickRequest(e.target.value)}>
                  <option value="">— انتخاب کنید —</option>
                  {requests.map((r) => <option key={r.id} value={r.id}>{`${toFaDigits(String(r.number))} — ${toFaDigits(r.personnelCode)} ${r.employeeName} — ${r.destination} (${range(r.fromDate, r.toDate)}، نوع ${r.requestTypeTitle})`}</option>)}
                </select>
              )}
            </div>
            <div className="form-field">
              <label>نوع ماموریت در این بازه<RequiredMark /> <FieldHint label="نوع ماموریت" text="نوعی که این بازه به آن برده می‌شود (مثلاً دریا). نباید با نوعِ خودِ درخواست یکی باشد؛ روزهای بدون گزارش خودبه‌خود به نوعِ درخواست تعلق دارند." /></label>
              <select value={form.typeId} onChange={(e) => setForm({ ...form, typeId: e.target.value })}>
                <option value="">— انتخاب کنید —</option>
                {types.filter((t) => (t.isActive || String(t.id) === form.typeId) && t.requestTypeId === reqTypeId).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>از تاریخ<RequiredMark /> <FieldHint label="بازه‌ی گزارش" text="بازه باید داخل بازه‌ی ماموریت باشد و با گزارش‌های دیگرِ همان ماموریت هم‌پوشانی نداشته باشد. خالی‌بودنِ «تا تاریخ» = فقط همان یک روز." /></label>
              <JalaliDatePicker value={form.fromDate} onChange={(v) => setForm({ ...form, fromDate: v })} />
            </div>
            <div className="form-field">
              <label>تا تاریخ</label>
              <JalaliDatePicker value={form.toDate} onChange={(v) => setForm({ ...form, toDate: v })} />
            </div>
            <div className="form-field" style={{ gridColumn: "1 / -1" }}>
              <label>توضیح</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
        </fieldset>
      </form>
      {rejectOpen && (
        <Modal title="رد گزارش" onClose={() => setRejectOpen(false)}>
          <div className="form-field">
            <label>دلیل رد<RequiredMark /></label>
            <input value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} autoFocus />
          </div>
          <div className="actions">
            <button type="button" className="btn" disabled={busy || !rejectNote.trim()} onClick={() => act("reject", { note: rejectNote })}>رد گزارش</button>
            <button type="button" className="btn secondary" onClick={() => setRejectOpen(false)}>انصراف</button>
          </div>
        </Modal>
      )}
    </FormPage>
  );
}
