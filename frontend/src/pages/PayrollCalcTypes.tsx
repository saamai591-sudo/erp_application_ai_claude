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
import type { CalcType } from "../lib/useCalcTypes";

// حقوق و دستمزد › تنظیمات › نوع محاسبه: حقوق ماهانه (نوع پایه، غیرقابل حذف) و انواع دیگر مثل عیدی، ذخیره سنوات، بازخرید مرخصی و بازخرید سنوات.
// هر عامل حقوق به یک نوع وصل می‌شود و در فرم «محاسبه حقوق» نوع محاسبه انتخاب می‌شود.

export default function PayrollCalcTypes() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <TypeForm />;
  if (location.pathname.endsWith("/edit")) return <TypeForm editId={Number(id)} />;
  return <TypeList />;
}

function TypeList() {
  const cacheKey = "/payroll-calc-types";
  const [items, setItems] = usePersistedState<CalcType[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/payroll-calc-types").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: CalcType) {
    try {
      await api.del(`/payroll-calc-types/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: CalcType) => string, extra: object = {}) => ({ render: (r: CalcType) => f(r), filterType: "string" as const, filterValue: (r: CalcType) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint
            text="نوع محاسبه تعیین می‌کند چه محاسبه‌ای انجام می‌شود: «حقوق ماهانه» نوع پایه است و باقی (عیدی، ذخیره سنوات، بازخرید مرخصی، بازخرید سنوات و …) هر کدام عامل‌ها و فیش جداگانه دارند. محاسبه‌ی هر نوعِ غیر از حقوق ماهانه فقط برای کارمندی ممکن است که حقوق ماهانه‌ی همان ماهش محاسبه شده باشد."
            title="نوع محاسبه"
          />
          <NewRecordButton path="/payroll-calc-types/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "عنوان", ...s((r) => r.title) },
          { header: "نوع پایه", ...s((r) => (r.isBase ? "بله" : "")), width: "90px" },
          { header: "تعداد عامل", ...s((r) => String(r.componentCount)), width: "100px" },
          { header: "فعال", ...s((r) => (r.isActive ? "بله" : "خیر")), width: "70px" },
        ]}
        rows={items}
        edit={{ path: (r: CalcType) => `/payroll-calc-types/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const DEFAULT_FORM = { title: "", description: "", isActive: true };

function TypeForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_FORM);
  const [isBase, setIsBase] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    if (!editId) return;
    api.get("/payroll-calc-types").then((rows: CalcType[]) => {
      const t = rows.find((r) => r.id === editId);
      if (t) {
        setIsBase(t.isBase);
        if (!hasPersistedState(cacheKey)) setForm({ title: t.title, description: t.description ?? "", isActive: t.isActive });
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
        await api.put(`/payroll-calc-types/${editId}`, form);
        flash();
      } else {
        const created = await api.post("/payroll-calc-types", form);
        flash();
        navigate(`/payroll-calc-types/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/payroll-calc-types/${editId}`);
      navigate("/payroll-calc-types");
    } catch (err) {
      showError((err as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش نوع محاسبه" : "نوع محاسبه‌ی جدید"}
      formId="payroll-calc-type-form"
      closePath="/payroll-calc-types"
      newPath="/payroll-calc-types/new"
      onDelete={editId && !isBase ? handleDelete : undefined}
    >
      <form id="payroll-calc-type-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        {isBase && <div className="alert">این نوع پایه است (حقوق ماهانه)؛ فقط عنوان و شرح آن قابل ویرایش است و حذف یا غیرفعال نمی‌شود.</div>}
        <div className="form-grid">
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          {editId && !isBase && (
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
        {!editId && <p style={{ opacity: 0.75 }}>بعد از ثبت، در «عامل حقوق» عامل‌های این نوع را تعریف و به آن وصل کنید.</p>}
      </form>
    </FormPage>
  );
}
