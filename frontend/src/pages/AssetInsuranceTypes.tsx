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
import { toFaDigits } from "../lib/formatAmount";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// دارایی ثابت › تنظیمات › نوع بیمه دارایی: آتش‌سوزی، بدنه، سرقت، … ؛ نوع روی بیمه‌نامه انتخاب می‌شود و حساب‌های هزینه/پیش‌پرداخت بیمه در
// «حسابهای دارایی ثابت» به‌تفکیک نوع بیمه (و گروه دارایی) تعریف می‌شوند. کد را سرور می‌دهد.

interface InsType {
  id: number;
  code: number;
  title: string;
  isActive: boolean;
  policyCount: number;
}

export default function AssetInsuranceTypes() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <TypeForm />;
  if (location.pathname.endsWith("/edit")) return <TypeForm editId={Number(id)} />;
  return <TypeList />;
}

function TypeList() {
  const cacheKey = "/asset-insurance-types";
  const [items, setItems] = usePersistedState<InsType[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/asset-insurance-types").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: InsType) {
    try {
      await api.del(`/asset-insurance-types/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="نوع بیمه روی بیمه‌نامه انتخاب می‌شود و کلید حساب‌های هزینه و پیش‌پرداخت بیمه در «حسابهای دارایی ثابت» است." title="نوع بیمه دارایی" />
          <NewRecordButton path="/asset-insurance-types/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد", render: (r: InsType) => toFaDigits(String(r.code)), width: "90px", filterType: "number", filterValue: (r: InsType) => r.code },
          { header: "عنوان", render: (r: InsType) => r.title, filterType: "string", filterValue: (r: InsType) => r.title },
          { header: "فعال", render: (r: InsType) => (r.isActive ? "بله" : "خیر"), width: "80px", filterType: "string", filterValue: (r: InsType) => (r.isActive ? "بله" : "خیر") },
        ]}
        rows={items}
        edit={{ path: (r: InsType) => `/asset-insurance-types/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const DEFAULT_FORM = { code: "", title: "", isActive: true };

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
    api.get("/asset-insurance-types").then((rows: InsType[]) => {
      const r = rows.find((x) => x.id === editId);
      if (r && !hasPersistedState(cacheKey)) setForm({ code: String(r.code), title: r.title, isActive: r.isActive });
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("عنوان الزامی است");
    const body = { title: form.title.trim(), isActive: form.isActive };
    try {
      if (editId) {
        await api.put(`/asset-insurance-types/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/asset-insurance-types", body);
        flash();
        navigate(`/asset-insurance-types/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/asset-insurance-types/${editId}`);
      navigate("/asset-insurance-types");
    } catch (err) {
      showError((err as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش نوع بیمه" : "نوع بیمه جدید"}
      formId="asset-insurance-type-form"
      closePath="/asset-insurance-types"
      newPath="/asset-insurance-types/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="asset-insurance-type-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>کد</label>
            <input disabled value={form.code ? toFaDigits(form.code) : ""} placeholder="پس از ذخیره صادر می‌شود" />
          </div>
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
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
