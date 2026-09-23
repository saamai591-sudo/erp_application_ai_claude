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

// دقیقاً هم‌الگوی PurchaseTypes.tsx — طبق تصمیم صریح کاربر (۱۴۰۵/۰۶/۱۷).

export type SalesNature = "DOMESTIC" | "EXPORT";

export const SALES_NATURE_FA: Record<SalesNature, string> = {
  DOMESTIC: "داخلی",
  EXPORT: "صادراتی",
};

export interface SalesType {
  id: number;
  code: number;
  title: string;
  nature: SalesNature;
  hasTransactions: boolean;
}

export default function SalesTypes() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <SalesTypeForm />;
  if (isEdit) return <SalesTypeForm editId={Number(id)} />;
  return <SalesTypeList />;
}

function SalesTypeList() {
  const cacheKey = "/sales-types";
  const [items, setItems] = usePersistedState<SalesType[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function reload() {
    api.get("/sales-types").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: SalesType) {
    try {
      await api.del(`/sales-types/${row.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="تعریف نوع فروش (داخلی/صادراتی) برای استفاده در فاکتور فروش و حسابداری کالا و خدمت" title="نوع فروش" />
          <NewRecordButton path="/sales-types/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        columns={[
          { header: "کد", render: (r) => toFaDigits(String(r.code)), width: "80px", filterType: "number", filterValue: (r) => r.code },
          { header: "عنوان", render: (r) => r.title, filterType: "string", filterValue: (r) => r.title },
          { header: "نوع", render: (r) => SALES_NATURE_FA[r.nature], filterType: "string", filterValue: (r) => SALES_NATURE_FA[r.nature] },
        ]}
        rows={items}
        edit={{ path: (r) => `/sales-types/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const DEFAULT_FORM = { code: "", title: "", nature: "" as SalesNature | "" };

function SalesTypeForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [hasTransactions, setHasTransactions] = useState(false);
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    if (!editId) {
      if (!hasPersistedState(cacheKey)) {
        setForm(DEFAULT_FORM);
        setHasTransactions(false);
      }
      return;
    }
    if (hasPersistedState(cacheKey)) return;
    api.get("/sales-types").then((items: SalesType[]) => {
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
        await api.put(`/sales-types/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/sales-types", body);
        flash();
        navigate(`/sales-types/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/sales-types/${editId}`);
      navigate("/sales-types");
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش نوع فروش" : "نوع فروش جدید"}
      formId="sales-type-form"
      closePath="/sales-types"
      newPath="/sales-types/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="sales-type-form" onSubmit={onSubmit}>
        {error && <div className="alert error">{error}</div>}
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
              {hasTransactions && <FieldHint label="نوع" text="این نوع فروش گردش دارد" />}
            </label>
            <select value={form.nature} onChange={(e) => setForm({ ...form, nature: e.target.value as SalesNature })}>
              <option value="">انتخاب کنید</option>
              {(Object.keys(SALES_NATURE_FA) as SalesNature[]).map((n) => (
                <option key={n} value={n}>{SALES_NATURE_FA[n]}</option>
              ))}
            </select>
          </div>
        </div>
      </form>
    </FormPage>
  );
}
