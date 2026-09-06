import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { toFaDigits } from "../lib/formatAmount";

const NATURE_FA: Record<string, string> = {
  CENTER_REQUEST: "درخواست مرکز",
  PROJECT_REQUEST: "درخواست پروژه",
  FIXED_ASSET_REQUEST: "درخواست دارایی ثابت",
};

export interface GoodsRequestType {
  id: number;
  code: number;
  title: string;
  nature: string;
  hasTransactions: boolean;
}

export default function GoodsRequestTypes() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <RequestTypeForm />;
  if (isEdit) return <RequestTypeForm editId={Number(id)} />;
  return <RequestTypeList />;
}

function RequestTypeList() {
  const cacheKey = "/goods-request-types";
  const [items, setItems] = usePersistedState<GoodsRequestType[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function reload() {
    api.get("/goods-request-types").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: GoodsRequestType) {
    try {
      await api.del(`/goods-request-types/${row.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={`تعریف انواع درخواست کالا در سیستم`} title="نوع درخواست کالا" />
          <NewRecordButton path="/goods-request-types/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        columns={[
          { header: "کد", render: (r) => toFaDigits(String(r.code)), width: "80px", filterType: "number", filterValue: (r) => r.code },
          { header: "عنوان", render: (r) => r.title, filterType: "string", filterValue: (r) => r.title },
          { header: "ماهیت", render: (r) => NATURE_FA[r.nature] || r.nature, width: "140px" },
        ]}
        rows={items}
        edit={{ path: (r) => `/goods-request-types/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const DEFAULT_REQUEST_TYPE_FORM = { title: "", nature: "CENTER_REQUEST" };

function RequestTypeForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [hasTransactions, setHasTransactions] = useState(false);
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_REQUEST_TYPE_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { saved, flash } = useSavedFlash();

  useEffect(() => {
    // این کامپوننت وقتی از حالت ویرایش با دکمه‌ی «جدید» به فرم خالی می‌رود، remount نمی‌شود؛
    // پس باید فرم را صریحاً به مقدار پیش‌فرض برگردانیم
    if (!editId) {
      if (!hasPersistedState(cacheKey)) {
        setForm(DEFAULT_REQUEST_TYPE_FORM);
        setHasTransactions(false);
      }
      return;
    }
    if (hasPersistedState(cacheKey)) return;
    api.get("/goods-request-types").then((items: GoodsRequestType[]) => {
      const found = items.find((i) => i.id === editId);
      if (found) {
        setHasTransactions(found.hasTransactions);
        setForm({ title: found.title, nature: found.nature });
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const body = { title: form.title, nature: form.nature };
    try {
      if (editId) {
        await api.put(`/goods-request-types/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/goods-request-types", body);
        flash();
        navigate(`/goods-request-types/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/goods-request-types/${editId}`);
      navigate("/goods-request-types");
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش نوع درخواست کالا" : "نوع درخواست کالا جدید"}
      description={!editId ? "کد به‌صورت سریالی و کاملا سیستمی توسط سیستم تعیین می‌شود" : undefined}
      formId="goods-request-type-form"
      closePath="/goods-request-types"
      newPath="/goods-request-types/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="goods-request-type-form" onSubmit={onSubmit}>
        {error && <div className="alert error">{error}</div>}
        {saved && <div className="alert warn">تغییرات ذخیره شد</div>}
        <div className="form-grid">
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div className="form-field">
            <label>
              ماهیت
              {hasTransactions && <FieldHint label="ماهیت" text="این نوع درخواست گردش دارد و ماهیت آن قابل تغییر نیست" />}
            </label>
            <select value={form.nature} disabled={hasTransactions} onChange={(e) => setForm({ ...form, nature: e.target.value })}>
              {Object.entries(NATURE_FA).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>
      </form>
    </FormPage>
  );
}
