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

export type PurchaseRouteNature = "TENDER" | "INQUIRY" | "NO_FORMALITY" | "EXCLUSIVE";

export const PURCHASE_ROUTE_NATURE_FA: Record<PurchaseRouteNature, string> = {
  TENDER: "مناقصه",
  INQUIRY: "استعلام",
  NO_FORMALITY: "بدون تشریفات",
  EXCLUSIVE: "انحصاری",
};

export interface PurchaseRoute {
  id: number;
  code: number;
  title: string;
  nature: PurchaseRouteNature;
  isActive: boolean;
  hasTransactions: boolean;
}

export default function PurchaseRoutes() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <PurchaseRouteForm />;
  if (isEdit) return <PurchaseRouteForm editId={Number(id)} />;
  return <PurchaseRouteList />;
}

function PurchaseRouteList() {
  const cacheKey = "/purchase-routes";
  const [items, setItems] = usePersistedState<PurchaseRoute[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function reload() {
    api.get("/purchase-routes").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: PurchaseRoute) {
    try {
      await api.del(`/purchase-routes/${row.id}`);
      await reload();
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="تعریف مسیرهای خرید مانند استعلام، مناقصه و ..." title="مسیر خرید" />
          <NewRecordButton path="/purchase-routes/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      <DataTable
        columns={[
          { header: "کد", render: (r) => toFaDigits(String(r.code)), width: "80px", filterType: "number", filterValue: (r) => r.code },
          { header: "عنوان", render: (r) => r.title, filterType: "string", filterValue: (r) => r.title },
          { header: "ماهیت", render: (r) => PURCHASE_ROUTE_NATURE_FA[r.nature], filterType: "string", filterValue: (r) => PURCHASE_ROUTE_NATURE_FA[r.nature] },
          { header: "فعال", render: (r) => (r.isActive ? "بله" : "خیر"), width: "80px" },
        ]}
        rows={items}
        edit={{ path: (r) => `/purchase-routes/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const DEFAULT_FORM = { code: "", title: "", nature: "" as PurchaseRouteNature | "", isActive: true };

function PurchaseRouteForm({ editId }: { editId?: number }) {
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
    api.get("/purchase-routes").then((items: PurchaseRoute[]) => {
      const found = items.find((i) => i.id === editId);
      if (found) {
        setHasTransactions(found.hasTransactions);
        setForm({ code: String(found.code), title: found.title, nature: found.nature, isActive: found.isActive });
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title) return setError("عنوان الزامی است");
    if (!form.nature) return setError("ماهیت الزامی است");
    const body = { code: form.code ? Number(form.code) : undefined, title: form.title, nature: form.nature, isActive: form.isActive };
    try {
      if (editId) {
        await api.put(`/purchase-routes/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/purchase-routes", body);
        flash();
        navigate(`/purchase-routes/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/purchase-routes/${editId}`);
      navigate("/purchase-routes");
    } catch (e) {
      alert((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش مسیر خرید" : "مسیر خرید جدید"}
      formId="purchase-route-form"
      closePath="/purchase-routes"
      newPath="/purchase-routes/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="purchase-route-form" onSubmit={onSubmit}>
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
              ماهیت
              <RequiredMark />
              {hasTransactions && <FieldHint label="ماهیت" text="این مسیر خرید گردش دارد" />}
            </label>
            <select value={form.nature} onChange={(e) => setForm({ ...form, nature: e.target.value as PurchaseRouteNature })}>
              <option value="">انتخاب کنید</option>
              {(Object.keys(PURCHASE_ROUTE_NATURE_FA) as PurchaseRouteNature[]).map((n) => (
                <option key={n} value={n}>{PURCHASE_ROUTE_NATURE_FA[n]}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              فعال
            </label>
          </div>
        </div>
      </form>
    </FormPage>
  );
}
