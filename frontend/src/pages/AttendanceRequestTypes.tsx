import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// مدیریت تردد › تنظیمات › «نوع درخواست»: عنوان + ماهیت (مرخصی / ماموریت) + واحد (روزانه / ساعتی) + [نوع مرخصی، فقط برای ماهیت مرخصی] + فعال.
// واحدِ نوع درخواست تعیین می‌کند فرم درخواست روزانه است یا ساعتی (چک‌باکس «ساعتی» در فرم‌ها نیست). «نیازمند گزارش» ذخیره نمی‌شود: نوع درخواستِ ماموریتی که
// «نوع ماموریت» (گزارش) فعال دارد گزارش می‌خواهد. قواعد در سرور (services/attendanceRequestTypeService.ts).

interface TypeRow {
  id: number;
  title: string;
  nature: "LEAVE" | "MISSION";
  natureTitle: string;
  unit: "DAILY" | "HOURLY";
  unitTitle: string;
  leaveTypeId: number | null;
  leaveTypeTitle: string;
  isActive: boolean;
  description: string;
  requiresReport: boolean;
  usageCount?: number;
  updatedAt?: string;
}
interface LeaveTypeOpt {
  id: number;
  title: string;
  isActive: boolean;
  unit: "DAY" | "BOTH";
}

export default function AttendanceRequestTypes() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <TypeForm />;
  if (location.pathname.endsWith("/edit")) return <TypeForm editId={Number(id)} />;
  return <TypeList />;
}

function TypeList() {
  const cacheKey = "/attendance-request-types";
  const [items, setItems] = usePersistedState<TypeRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/attendance-request-types").then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: TypeRow) {
    try {
      await api.del(`/attendance-request-types/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: TypeRow) => string, extra: object = {}) => ({ render: (r: TypeRow) => f(r), filterType: "string" as const, filterValue: (r: TypeRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="نوع درخواست" text="هر نوع درخواست ماهیت (مرخصی یا ماموریت) و واحد (روزانه یا ساعتی) دارد؛ فرم درخواست مرخصی/ماموریت روزانه یا ساعتی‌بودنش را از همین‌جا می‌گیرد. برای مرخصی، نوع مرخصی هم تعیین می‌شود (مانده و استحقاق روی نوع مرخصی می‌ماند). برای ماموریت، اگر «نوع ماموریت» (گزارش) به نوع درخواستی وصل شود، آن نوع درخواست در «محاسبه تردد» گزارشِ تاییدشده می‌خواهد." />
          <NewRecordButton path="/attendance-request-types/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "عنوان", ...s((r) => r.title) },
          { header: "ماهیت", ...s((r) => r.natureTitle), width: "100px" },
          { header: "واحد", ...s((r) => r.unitTitle), width: "90px" },
          { header: "نوع مرخصی", ...s((r) => r.leaveTypeTitle), width: "150px" },
          { header: "نیازمند گزارش", ...s((r) => (r.nature === "MISSION" ? (r.requiresReport ? "بله" : "خیر") : "")), width: "110px" },
          { header: "فعال", ...s((r) => (r.isActive ? "بله" : "خیر")), width: "80px" },
          { header: "توضیحات", ...s((r) => r.description) },
        ]}
        rows={items}
        edit={{ path: (r: TypeRow) => `/attendance-request-types/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function TypeForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, { title: "", nature: "LEAVE", unit: "DAILY", leaveTypeId: "", isActive: true, description: "" });
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [usage, setUsage] = useState(0);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeOpt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  async function load() {
    if (!editId) return;
    const r: TypeRow = await api.get(`/attendance-request-types/${editId}`);
    setUpdatedAt(r.updatedAt);
    setUsage(r.usageCount ?? 0);
    if (!hasPersistedState(cacheKey)) setForm({ title: r.title, nature: r.nature, unit: r.unit, leaveTypeId: r.leaveTypeId ? String(r.leaveTypeId) : "", isActive: r.isActive, description: r.description });
  }
  useEffect(() => {
    api.get("/attendance-leave-types").then((r: LeaveTypeOpt[]) => setLeaveTypes(r)).catch(() => {});
    load().then(() => setLoaded(true)).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const leave = form.nature === "LEAVE";
  const lt = leaveTypes.find((t) => String(t.id) === form.leaveTypeId);
  // واحد وابسته به نوع مرخصی است: نوع مرخصیِ «روز» فقط واحد «روزانه» دارد؛ تا نوع مرخصی انتخاب نشده واحد هم انتخاب نمی‌شود
  const locked = usage > 0;
  const dayOnly = leave && lt?.unit === "DAY";
  const unitDisabled = locked || (leave && !lt);
  const [unitNote, setUnitNote] = useState<string | null>(null);
  function changeLeaveType(id: string) {
    const t = leaveTypes.find((x) => String(x.id) === id);
    if (t?.unit === "DAY" && form.unit === "HOURLY") {
      setUnitNote(`نوع مرخصی «${t.title}» فقط روزانه است؛ واحد روی «روزانه» تنظیم شد.`);
      setForm({ ...form, leaveTypeId: id, unit: "DAILY" });
    } else {
      setUnitNote(null);
      setForm({ ...form, leaveTypeId: id });
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("عنوان نوع درخواست الزامی است");
    if (leave && !form.leaveTypeId) return setError("برای ماهیت «مرخصی» نوع مرخصی را انتخاب کنید");
    const body = { ...form, leaveTypeId: leave ? Number(form.leaveTypeId) : null };
    try {
      if (editId) {
        await api.put(`/attendance-request-types/${editId}`, { ...body, updatedAt });
        flash();
        await load();
      } else {
        const created = await api.post("/attendance-request-types", body);
        flash();
        navigate(`/attendance-request-types/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/attendance-request-types/${editId}`);
      navigate("/attendance-request-types");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  return (
    <FormPage title={editId ? "ویرایش نوع درخواست" : "نوع درخواست جدید"} formId="attendance-request-type-form" closePath="/attendance-request-types" newPath="/attendance-request-types/new" onDelete={editId ? handleDelete : undefined}>
      <form id="attendance-request-type-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        {locked && <div className="alert" style={{ marginBottom: 12, maxWidth: 900, fontSize: 13 }}>این نوع در {usage} درخواست استفاده شده است؛ ماهیت، واحد و نوع مرخصی آن تغییر نمی‌کند (می‌توانید عنوان را عوض یا آن را غیرفعال کنید).</div>}
        <div className="form-grid">
          <div className="form-field">
            <label>عنوان<RequiredMark /> <FieldHint label="عنوان" text="مثلاً «مرخصی استحقاقی (روزانه)»، «مرخصی استحقاقی (ساعتی)»، «ماموریت درون‌شهری» یا «ماموریت دریا». در فرم درخواست همین عنوان انتخاب می‌شود." /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="form-field">
            <label>ماهیت<RequiredMark /></label>
            <select value={form.nature} disabled={locked} onChange={(e) => { setUnitNote(null); setForm({ ...form, nature: e.target.value, leaveTypeId: e.target.value === "LEAVE" ? form.leaveTypeId : "" }); }}>
              <option value="LEAVE">مرخصی</option>
              <option value="MISSION">ماموریت</option>
            </select>
          </div>
          {leave && (
            <div className="form-field">
              <label>نوع مرخصی<RequiredMark /> <FieldHint label="نوع مرخصی" text="مانده، استحقاق و سقف‌های مرخصی روی همین نوع مرخصی می‌ماند؛ نوع درخواست‌های روزانه و ساعتیِ یک نوع مرخصی از یک مانده کم می‌کنند. واحد نوع درخواست بعد از انتخاب نوع مرخصی تعیین می‌شود: نوع مرخصیِ «روز» فقط واحد روزانه دارد." /></label>
              <select value={form.leaveTypeId} disabled={locked} onChange={(e) => changeLeaveType(e.target.value)}>
                <option value="">— انتخاب کنید —</option>
                {leaveTypes.filter((t) => t.isActive || String(t.id) === form.leaveTypeId).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
          )}
          <div className="form-field">
            <label>واحد<RequiredMark /> <FieldHint label="واحد" text="روزانه: درخواست از تاریخ تا تاریخ. ساعتی: یک بازه‌ی پیوسته با ساعت شروع و پایان. فرم درخواست همین را می‌خواند. برای مرخصی، واحد به نوع مرخصی وابسته است (نوع مرخصیِ «روز» فقط روزانه). ماموریتِ ساعتی گزارش ندارد." /></label>
            <select value={form.unit} disabled={unitDisabled} onChange={(e) => { setUnitNote(null); setForm({ ...form, unit: e.target.value }); }}>
              <option value="DAILY">روزانه</option>
              {!dayOnly && <option value="HOURLY">ساعتی</option>}
            </select>
            {leave && !lt && <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>ابتدا نوع مرخصی را انتخاب کنید.</div>}
            {dayOnly && <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>نوع مرخصیِ «{lt?.title}» فقط روزانه است.</div>}
            {unitNote && <div style={{ fontSize: 12, color: "#b45309", marginTop: 2 }}>{unitNote}</div>}
          </div>
          <div className="form-field">
            <label className="checkbox-row"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> فعال</label>
          </div>
          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label>توضیحات</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
      </form>
    </FormPage>
  );
}
