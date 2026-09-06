import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { toFaDigits } from "../lib/formatAmount";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

export type PurchaseNature = "IMPORTED" | "DOMESTIC";

export const PURCHASE_NATURE_FA: Record<PurchaseNature, string> = {
  IMPORTED: "وارداتی",
  DOMESTIC: "داخلی",
};

export interface PurchaseType {
  id: number;
  code: number;
  title: string;
  nature: PurchaseNature;
  hasTransactions: boolean;
}

export default function PurchaseTypes() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <PurchaseTypeForm />;
  if (isEdit) return <PurchaseTypeForm editId={Number(id)} />;
  return <PurchaseTypeList />;
}

function PurchaseTypeList() {
  const cacheKey = "/purchase-types";
  const [items, setItems] = usePersistedState<PurchaseType[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function reload() {
    api.get("/purchase-types").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: PurchaseType) {
    try {
      await api.del(`/purchase-types/${row.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="تعریف نوع خرید (وارداتی/داخلی) برای استفاده در فاکتور خرید و حسابداری کالا و خدمت" title="نوع خرید" />
          <NewRecordButton path="/purchase-types/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        columns={[
          { header: "کد", render: (r) => toFaDigits(String(r.code)), width: "80px", filterType: "number", filterValue: (r) => r.code },
          { header: "عنوان", render: (r) => r.title, filterType: "string", filterValue: (r) => r.title },
          { header: "نوع", render: (r) => PURCHASE_NATURE_FA[r.nature], filterType: "string", filterValue: (r) => PURCHASE_NATURE_FA[r.nature] },
        ]}
        rows={items}
        edit={{ path: (r) => `/purchase-types/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const DEFAULT_FORM = { code: "", title: "", nature: "" as PurchaseNature | "" };

function PurchaseTypeForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [hasTransactions, setHasTransactions] = useState(false);
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { saved, flash } = useSavedFlash();

  useEffect(() => {
    if (!editId) {
      if (!hasPersistedState(cacheKey)) {
        setForm(DEFAULT_FORM);
        setHasTransactions(false);
      }
      return;
    }
    if (hasPersistedState(cacheKey)) return;
    api.get("/purchase-types").then((items: PurchaseType[]) => {
      const found = items.find((i) => i.id === editId);
      if (found) {
        setHasTransactions(found.hasTransactions);
        setForm({ code: String(found.code), title: found.title, nature: found.nature });
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title) return setError("عنوان الزامی است");
    if (!form.nature) return setError("نوع الزامی است");
    const body = { code: form.code ? Number(form.code) : undefined, title: form.title, nature: form.nature };
    try {
      if (editId) {
        await api.put(`/purchase-types/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/purchase-types", body);
        flash();
        navigate(`/purchase-types/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/purchase-types/${editId}`);
      navigate("/purchase-types");
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش نوع خرید" : "نوع خرید جدید"}
      formId="purchase-type-form"
      closePath="/purchase-types"
      newPath="/purchase-types/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="purchase-type-form" onSubmit={onSubmit}>
        {error && <div className="alert error">{error}</div>}
        {saved && <div className="alert warn">تغییرات ذخیره شد</div>}
        <div className="form-grid">
          <div className="form-field">
            <label>کد <FieldHint label="کد" text="اختیاری — در صورت خالی بودن، سیستم تعیین می‌کند" /></label>
            <input dir="ltr" disabled={!!editId} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </div>
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div className="form-field">
            <label>
              نوع
              <RequiredMark />
              {hasTransactions && <FieldHint label="نوع" text="این نوع خرید گردش دارد" />}
            </label>
            <select value={form.nature} onChange={(e) => setForm({ ...form, nature: e.target.value as PurchaseNature })}>
              <option value="">انتخاب کنید</option>
              {(Object.keys(PURCHASE_NATURE_FA) as PurchaseNature[]).map((n) => (
                <option key={n} value={n}>{PURCHASE_NATURE_FA[n]}</option>
              ))}
            </select>
          </div>
        </div>
      </form>
    </FormPage>
  );
}
