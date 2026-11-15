import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { ExcelImportButton } from "../components/ExcelImport";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { api, ApiError } from "../lib/api";
import { showError, showToast } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { EmployeePickerField, useEmployeeOptions } from "./AttendancePunches";

// مدیریت تردد › تنظیمات › «نگاشت شناسه‌ی دستگاه»: شناسه‌ی کاربر در سیستم کارت‌ساعت ← کارمند (به ازای هر اتصال). اگر شناسه با کد پرسنلی برابر باشد نگاشت لازم نیست.
// با ثبت نگاشت، ثبت‌های «در انتظار نگاشت» همان شناسه خودکار پردازش می‌شوند. ورود دسته‌ای از اکسل (اتصال، شناسه‌ی دستگاه، کد پرسنلی) هم هست. قواعد در سرور.

interface MapRow {
  id: number;
  connectionId: number;
  connectionName: string;
  deviceUserId: string;
  employeeId: number;
  personnelCode: string;
  employeeName: string;
}
interface ConnOpt {
  id: number;
  name: string;
}

export default function AttendanceDeviceMappings() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <MapForm />;
  if (location.pathname.endsWith("/edit")) return <MapForm editId={Number(id)} />;
  return <MapList />;
}

function MapList() {
  const cacheKey = "/attendance-device-mappings";
  const [items, setItems] = usePersistedState<MapRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/attendance-device-mappings").then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: MapRow) {
    try {
      await api.del(`/attendance-device-mappings/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: MapRow) => string, extra: object = {}) => ({ render: (r: MapRow) => f(r), filterType: "string" as const, filterValue: (r: MapRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="نگاشت شناسه‌ی دستگاه" text="شناسه‌ی کاربر در سیستم کارت‌ساعت را به کارمند وصل می‌کند. اگر شناسه‌ی دستگاه با کد پرسنلی برابر باشد، بدون نگاشت هم وصل می‌شود. با ثبت نگاشت، ثبت‌های در انتظارِ همان شناسه خودکار پردازش می‌شوند." />
          <NewRecordButton path="/attendance-device-mappings/new" />
          <ExcelImportButton
            entityLabel="نگاشت شناسه‌ی دستگاه"
            templateFilename="قالب-نگاشت-شناسه-دستگاه"
            backendEntityType="attendance-device-mapping"
            columns={[
              { key: "connection", label: "نام اتصال", required: true, hint: "باید دقیقاً نام یک اتصال تعریف‌شده باشد" },
              { key: "deviceUserId", label: "شناسه‌ی دستگاه", required: true },
              { key: "personnelCode", label: "کد پرسنلی", required: true },
            ]}
            onDone={reload}
          />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "اتصال", ...s((r) => r.connectionName) },
          { header: "شناسه‌ی دستگاه", ...s((r) => r.deviceUserId), width: "150px" },
          { header: "کد پرسنلی", ...s((r) => r.personnelCode), width: "120px" },
          { header: "کارمند", ...s((r) => r.employeeName) },
        ]}
        rows={items}
        edit={{ path: (r: MapRow) => `/attendance-device-mappings/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function MapForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const employees = useEmployeeOptions();
  const [connections, setConnections] = useState<ConnOpt[]>([]);
  const [form, setForm] = usePersistedState(cacheKey, { connectionId: "", deviceUserId: "", employeeId: "" });
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/attendance-device-connections").then((r: any[]) => setConnections(r.filter((c) => c.isActive || String(c.id) === form.connectionId).map((c) => ({ id: c.id, name: c.name })))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // پیش‌پر کردن از «شناسه‌های نگاشت‌نشده» (?connectionId=&deviceUserId=)
  useEffect(() => {
    if (editId) return;
    const q = new URLSearchParams(location.search);
    if (q.get("deviceUserId") && !form.deviceUserId) setForm({ ...form, connectionId: q.get("connectionId") ?? "", deviceUserId: q.get("deviceUserId") ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!editId) return;
    api.get(`/attendance-device-mappings/${editId}`).then((r: MapRow) => {
      if (!hasPersistedState(cacheKey)) setForm({ connectionId: String(r.connectionId), deviceUserId: r.deviceUserId, employeeId: String(r.employeeId) });
      setLoaded(true);
    }).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.connectionId) return setError("اتصال را انتخاب کنید");
    if (!form.deviceUserId.trim()) return setError("شناسه‌ی دستگاه الزامی است");
    if (!form.employeeId) return setError("کارمند را انتخاب کنید");
    const body = { connectionId: Number(form.connectionId), deviceUserId: form.deviceUserId.trim(), employeeId: Number(form.employeeId) };
    try {
      const r: { id?: number; processed?: { accepted: number } } = editId ? await api.put(`/attendance-device-mappings/${editId}`, body) : await api.post("/attendance-device-mappings", body);
      flash();
      const n = r.processed?.accepted ?? 0;
      if (n > 0) showToast(`${n} ثبت در انتظار پردازش و به تردد تبدیل شد`);
      if (!editId && r.id) navigate(`/attendance-device-mappings/${r.id}/edit`);
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/attendance-device-mappings/${editId}`);
      navigate("/attendance-device-mappings");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  return (
    <FormPage title={editId ? "ویرایش نگاشت" : "نگاشت جدید"} formId="attendance-device-map-form" closePath="/attendance-device-mappings" newPath="/attendance-device-mappings/new" onDelete={editId ? handleDelete : undefined}>
      <form id="attendance-device-map-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>اتصال<RequiredMark /></label>
            <select value={form.connectionId} onChange={(e) => setForm({ ...form, connectionId: e.target.value })}>
              <option value="">— انتخاب —</option>
              {connections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>شناسه‌ی کاربر در دستگاه<RequiredMark /></label>
            <input dir="ltr" value={form.deviceUserId} onChange={(e) => setForm({ ...form, deviceUserId: e.target.value })} />
          </div>
          <div className="form-field">
            <label>کارمند<RequiredMark /></label>
            <EmployeePickerField employees={employees} value={form.employeeId} onSelect={(emp) => setForm({ ...form, employeeId: String(emp.id) })} />
          </div>
        </div>
      </form>
    </FormPage>
  );
}
