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

// دارایی ثابت › تنظیمات › نوع خروج دارایی: عنوان آزاد (اسقاط، آتش‌سوزی، سرقت، اهدا، …) روی یکی از ماهیت‌های ثابت؛ ماهیت، حساب مقابل ارزش دفتری را در سند خروج تعیین می‌کند.
// ماهیت «فروش» هم مثل بقیه ارزش دفتری را به «سود و زیان ناشی از فروش دارایی» گروه می‌برد (مبلغ فروش در فاکتور فروش/سند جدا ثبت می‌شود). نوعی که در سند خروج استفاده شده حذف نمی‌شود و ماهیتش عوض نمی‌شود.

interface ExitType {
  id: number;
  title: string;
  nature: string;
  natureTitle: string;
  isActive: boolean;
  used: boolean;
}

export default function AssetExitTypes() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <TypeForm />;
  if (location.pathname.endsWith("/edit")) return <TypeForm editId={Number(id)} />;
  return <TypeList />;
}

function TypeList() {
  const cacheKey = "/asset-exit-types";
  const [items, setItems] = usePersistedState<ExitType[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/asset-exit-types").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: ExitType) {
    try {
      await api.del(`/asset-exit-types/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: ExitType) => string, extra: object = {}) => ({ render: (r: ExitType) => f(r), filterType: "string" as const, filterValue: (r: ExitType) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="هر نوع خروج یک ماهیت دارد (اسقاط، زیان/خسارت، اهدا) که حساب مقابل ارزش دفتری دارایی را در سند خروج تعیین می‌کند." title="نوع خروج دارایی" />
          <NewRecordButton path="/asset-exit-types/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "عنوان", ...s((r) => r.title) },
          { header: "ماهیت", ...s((r) => r.natureTitle), width: "130px" },
          { header: "فعال", ...s((r) => (r.isActive ? "بله" : "خیر")), width: "70px" },
        ]}
        rows={items}
        edit={{ path: (r: ExitType) => `/asset-exit-types/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const NATURES = [
  { value: "SCRAP", label: "اسقاط" },
  { value: "LOSS", label: "زیان/خسارت (آتش‌سوزی، سرقت، …)" },
  { value: "DONATION", label: "اهدا" },
  { value: "SALE", label: "فروش" },
];
const DEFAULT_FORM = { title: "", nature: "SCRAP", isActive: true, used: false };

function TypeForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    if (!editId) return;
    api.get("/asset-exit-types").then((rows: ExitType[]) => {
      const r = rows.find((x) => x.id === editId);
      if (r && !hasPersistedState(cacheKey)) setForm({ title: r.title, nature: r.nature, isActive: r.isActive, used: r.used });
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
        await api.put(`/asset-exit-types/${editId}`, form);
        flash();
      } else {
        const created = await api.post("/asset-exit-types", form);
        flash();
        navigate(`/asset-exit-types/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/asset-exit-types/${editId}`);
      navigate("/asset-exit-types");
    } catch (err) {
      showError((err as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش نوع خروج" : "نوع خروج جدید"}
      formId="asset-exit-type-form"
      closePath="/asset-exit-types"
      newPath="/asset-exit-types/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="asset-exit-type-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div className="form-field">
            <label>ماهیت<RequiredMark /></label>
            <select value={form.nature} disabled={form.used} title={form.used ? "نوعی که در سند خروج استفاده شده ماهیتش قابل تغییر نیست" : undefined} onChange={(e) => setForm({ ...form, nature: e.target.value })}>
              {NATURES.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
            </select>
          </div>
          {editId && (
            <div className="form-field">
              <label className="checkbox-row">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                فعال
              </label>
            </div>
          )}
        </div>
      </form>
    </FormPage>
  );
}
