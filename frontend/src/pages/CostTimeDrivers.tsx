import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { toFaDigits } from "../lib/formatAmount";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// تولید › تنظیمات › «مبناهای زمانی تسهیم»: نام زمان‌هایی که هزینه‌ها بر اساس آن‌ها تسهیم می‌شوند (زمان بافت، زمان دوخت، زمان ماشین، …).
// زمان هر کالا در هر مرکز در «زمان‌بندی تولید» ثبت می‌شود و معین در «عامل جمع‌آوری هزینه‌ها» یکی از این مبناها را انتخاب می‌کند. قواعد: backend/src/services/productionTimeService.ts

const INFO_TEXT =
  "هر مبنای زمانی یک نام است، مثل «زمان بافت» یا «زمان دوخت». مقدار زمان هر کالا در هر مرکز را در «زمان‌بندی تولید» وارد کنید و در «عامل جمع‌آوری هزینه‌ها» برای هر معین مبنای تسهیمش را انتخاب کنید؛ مثلاً هزینه‌ی بافندگی با «زمان بافت» و حقوق مونتاژ با «زمان دستمزد».";

interface Driver { id: number; code: number; title: string; isActive: boolean; isSystem: boolean; used: boolean }
interface FormState { title: string; isActive: boolean }
const EMPTY: FormState = { title: "", isActive: true };

export default function CostTimeDrivers() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <DriverForm />;
  if (location.pathname.endsWith("/edit")) return <DriverForm editId={Number(id)} />;
  return <DriverList />;
}

function DriverList() {
  const cacheKey = "/cost-time-drivers";
  const [items, setItems] = usePersistedState<Driver[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const reload = () => api.get("/cost-time-drivers").then(setItems).catch((e) => setError(e.message));
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: Driver) {
    try {
      await api.del(`/cost-time-drivers/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={INFO_TEXT} title="مبناهای زمانی تسهیم" />
          <NewRecordButton path="/cost-time-drivers/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد", render: (r: Driver) => toFaDigits(String(r.code)), width: "90px", filterType: "number", filterValue: (r: Driver) => r.code },
          { header: "عنوان", render: (r: Driver) => r.title, filterType: "string", filterValue: (r: Driver) => r.title },
          { header: "نوع", render: (r: Driver) => (r.isSystem ? "سیستمی" : ""), width: "90px", filterType: "string", filterValue: (r: Driver) => (r.isSystem ? "سیستمی" : "") },
          { header: "وضعیت", render: (r: Driver) => (r.isActive ? "فعال" : "غیرفعال"), width: "100px", filterType: "string", filterValue: (r: Driver) => (r.isActive ? "فعال" : "غیرفعال") },
        ]}
        rows={items}
        edit={{ path: (r: Driver) => `/cost-time-drivers/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function DriverForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState<FormState>(cacheKey, EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [isSystem, setIsSystem] = useState(false);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    if (!editId) return;
    api.get(`/cost-time-drivers/${editId}`).then((d: Driver) => {
      setIsSystem(d.isSystem);
      if (!hasPersistedState(cacheKey)) setForm({ title: d.title, isActive: d.isActive });
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (editId) {
        await api.put(`/cost-time-drivers/${editId}`, form);
        flash();
      } else {
        const created = await api.post("/cost-time-drivers", form);
        flash();
        navigate(`/cost-time-drivers/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/cost-time-drivers/${editId}`);
      navigate("/cost-time-drivers");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  return (
    <FormPage title={editId ? "ویرایش مبنای زمانی" : "مبنای زمانی جدید"} formId="cost-time-driver-form" closePath="/cost-time-drivers" newPath="/cost-time-drivers/new" onDelete={editId && !isSystem ? handleDelete : undefined}>
      <form id="cost-time-driver-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} disabled={isSystem} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثلاً زمان بافت" />
            {isSystem && <small>مبنای سیستمی است؛ عنوانش تغییر نمی‌کند و حذف نمی‌شود.</small>}
          </div>
          <div className="form-field">
            <label><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> فعال</label>
          </div>
        </div>
      </form>
    </FormPage>
  );
}
