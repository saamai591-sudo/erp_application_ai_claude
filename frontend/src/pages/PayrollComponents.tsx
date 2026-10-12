import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { KIND_FA, METHOD_FA } from "../lib/payrollLabels";

// حقوق و دستمزد › تنظیمات › عامل حقوق: فقط هویت عامل (عنوان). کلید داخلی را سیستم خودکار می‌سازد و نمایش داده نمی‌شود؛
// طبقه، روش و فرمول در «روش محاسبه عامل» (تاریخ‌دار) تعریف می‌شود.

interface Comp {
  id: number;
  title: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  method: string | null;
  kind: string | null;
}

export default function PayrollComponents() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <CompForm />;
  if (location.pathname.endsWith("/edit")) return <CompForm editId={Number(id)} />;
  return <CompList />;
}

function CompList() {
  const cacheKey = "/payroll-components";
  const [items, setItems] = usePersistedState<Comp[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/payroll-components").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: Comp) {
    try {
      await api.del(`/payroll-components/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: Comp) => string, extra: object = {}) => ({ render: (r: Comp) => f(r), filterType: "string" as const, filterValue: (r: Comp) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint
            text="عامل حقوق هر موردی است که در محاسبه‌ی ماهانه می‌آید (اضافه‌کار، بیمه، مالیات، روز کارکرد، وام و …). اینجا فقط عنوان عامل تعریف می‌شود؛ طبقه، روش محاسبه و فرمول در «روش محاسبه عامل» ثبت می‌شود."
            title="عامل حقوق"
          />
          <NewRecordButton path="/payroll-components/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "عنوان", ...s((r) => r.title) },
          { header: "روش", ...s((r) => (r.method ? METHOD_FA[r.method] : "تعریف نشده")), width: "170px" },
          { header: "طبقه", ...s((r) => (r.kind ? KIND_FA[r.kind] : "—")), width: "130px" },
          { header: "سیستمی", ...s((r) => (r.isSystem ? "بله" : "")), width: "80px" },
          { header: "فعال", ...s((r) => (r.isActive ? "بله" : "خیر")), width: "70px" },
        ]}
        rows={items}
        edit={{ path: (r: Comp) => `/payroll-components/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const DEFAULT_FORM = { title: "", description: "", isActive: true };

function CompForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_FORM);
  const [isSystem, setIsSystem] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    if (!editId) return;
    api.get("/payroll-components").then((rows: Comp[]) => {
      const c = rows.find((r) => r.id === editId);
      if (c) {
        setIsSystem(c.isSystem);
        if (!hasPersistedState(cacheKey)) setForm({ title: c.title, description: c.description ?? "", isActive: c.isActive });
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("عنوان الزامی است");
    try {
      if (editId) {
        await api.put(`/payroll-components/${editId}`, form);
        flash();
      } else {
        const created = await api.post("/payroll-components", form);
        flash();
        navigate(`/payroll-components/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/payroll-components/${editId}`);
      navigate("/payroll-components");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش عامل حقوق" : "عامل حقوق جدید"}
      formId="payroll-comp-form"
      closePath="/payroll-components"
      newPath="/payroll-components/new"
      onDelete={editId && !isSystem ? handleDelete : undefined}
    >
      <form id="payroll-comp-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          {editId && !isSystem && (
            <div className="form-field">
              <label className="checkbox-row">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                فعال
              </label>
            </div>
          )}
          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label>شرح</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
        {!editId && <p style={{ opacity: 0.75 }}>بعد از ثبت، روش محاسبه‌ی عامل را در «روش محاسبه عامل» تعریف کنید.</p>}
      </form>
    </FormPage>
  );
}
