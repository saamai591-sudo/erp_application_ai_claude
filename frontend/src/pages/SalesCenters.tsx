import { FormEvent, useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { showError } from "../lib/toast";
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

// «مرکز فروش» — موجودیت عملیاتی فروش، وابسته به یک واحد سازمانی (۱ واحد سازمانی → چند مرکز فروش)، در
// اسناد فروش برای شناسایی مرکز فروش مسئول تراکنش استفاده می‌شود. طبق تصمیم صریح کاربر، یک کد ساده‌ی
// سریالی دارد (نه کد تفصیل، برخلاف مرکز هزینه) — دقیقاً هم‌الگوی گروه انبار/نوع خرید/نوع فروش.

interface OrgUnitOption { id: number; title: string }
export interface SalesCenter {
  id: number;
  code: number;
  title: string;
  description: string | null;
  organizationUnitId: number;
  organizationUnit: OrgUnitOption;
  isActive: boolean;
  hasTransactions: boolean;
}

export default function SalesCenters() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <SalesCenterForm />;
  if (isEdit) return <SalesCenterForm editId={Number(id)} />;
  return <SalesCenterList />;
}

function SalesCenterList() {
  const cacheKey = "/sales-centers";
  const [items, setItems] = usePersistedState<SalesCenter[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function reload() {
    api.get("/sales-centers").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: SalesCenter) {
    try {
      await api.del(`/sales-centers/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="تعریف مراکز فروش وابسته به واحدهای سازمانی — در اسناد فروش برای شناسایی مرکز فروش مسئول تراکنش استفاده می‌شود" title="مرکز فروش" />
          <NewRecordButton path="/sales-centers/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد", render: (r) => toFaDigits(String(r.code)), width: "80px", filterType: "number", filterValue: (r) => r.code },
          { header: "عنوان", render: (r) => r.title, filterType: "string", filterValue: (r) => r.title },
          { header: "واحد سازمانی", render: (r) => r.organizationUnit?.title || "—", filterType: "string", filterValue: (r) => r.organizationUnit?.title || "" },
          { header: "شرح", render: (r) => r.description || "—", filterType: "string", filterValue: (r) => r.description || "" },
          { header: "فعال", render: (r) => (r.isActive ? "بله" : "خیر"), width: "80px" },
        ]}
        rows={items}
        edit={{ path: (r) => `/sales-centers/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const DEFAULT_FORM = { code: "", title: "", description: "", organizationUnitId: "", isActive: true };

function SalesCenterForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [orgUnits, setOrgUnits] = useState<OrgUnitOption[]>([]);
  const [hasTransactions, setHasTransactions] = useState(false);
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/org-units").then(setOrgUnits);
  }, []);

  useEffect(() => {
    if (!editId) {
      if (!hasPersistedState(cacheKey)) {
        setForm(DEFAULT_FORM);
        setHasTransactions(false);
      }
      return;
    }
    if (hasPersistedState(cacheKey)) return;
    api.get("/sales-centers").then((items: SalesCenter[]) => {
      const found = items.find((i) => i.id === editId);
      if (found) {
        setHasTransactions(found.hasTransactions);
        setForm({
          code: String(found.code),
          title: found.title,
          description: found.description || "",
          organizationUnitId: String(found.organizationUnitId),
          isActive: found.isActive,
        });
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title) return setError("عنوان الزامی است");
    if (!form.organizationUnitId) return setError("واحد سازمانی الزامی است");
    const body = {
      code: form.code ? Number(form.code) : undefined,
      title: form.title,
      description: form.description || null,
      organizationUnitId: Number(form.organizationUnitId),
      isActive: form.isActive,
    };
    try {
      if (editId) {
        await api.put(`/sales-centers/${editId}`, body);
        flash();
      } else {
        const created = await api.post("/sales-centers", body);
        flash();
        navigate(`/sales-centers/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/sales-centers/${editId}`);
      navigate("/sales-centers");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش مرکز فروش" : "مرکز فروش جدید"}
      formId="sales-center-form"
      closePath="/sales-centers"
      newPath="/sales-centers/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="sales-center-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>کد <FieldHint label="کد" text="اختیاری — در صورت خالی بودن، سیستم تعیین می‌کند" /></label>
            <input dir="ltr" disabled={!!editId} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </div>
          <div className="form-field">
            <label>عنوان<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div className="form-field full">
            <label>
              واحد سازمانی
              <RequiredMark />
              {hasTransactions && <FieldHint label="واحد سازمانی" text="این مرکز فروش گردش دارد" />}
            </label>
            <select value={form.organizationUnitId} onChange={(e) => setForm({ ...form, organizationUnitId: e.target.value })}>
              <option value="">انتخاب کنید</option>
              {orgUnits.map((u) => <option key={u.id} value={u.id}>{u.title}</option>)}
            </select>
          </div>
          <div className="form-field full">
            <label>شرح</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
