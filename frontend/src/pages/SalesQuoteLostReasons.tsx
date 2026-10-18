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

// فروش › تنظیمات › دلایل فروش‌نشدن پیش‌فاکتور: فهرستی که هنگام «بستن پیگیری» پیش‌فاکتور انتخاب می‌شود (قیمت بالا، رقیب، بودجه نداشت، …)؛
// پایه‌ی گزارش «چرا فروش نشد». دلیلی که برای پیش‌فاکتوری استفاده شده حذف نمی‌شود، فقط غیرفعال می‌شود.

interface Reason {
  id: number;
  title: string;
  isActive: boolean;
  usageCount: number;
}

export default function SalesQuoteLostReasons() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <ReasonForm />;
  if (location.pathname.endsWith("/edit")) return <ReasonForm editId={Number(id)} />;
  return <ReasonList />;
}

function ReasonList() {
  const cacheKey = "/sales-quote-lost-reasons";
  const [items, setItems] = usePersistedState<Reason[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/sales-quote-lost-reasons").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: Reason) {
    try {
      await api.del(`/sales-quote-lost-reasons/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: Reason) => string, extra: object = {}) => ({ render: (r: Reason) => f(r), filterType: "string" as const, filterValue: (r: Reason) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text="دلایلی که هنگام «بستن پیگیری» پیش‌فاکتور (وقتی مشتری منصرف شد یا فروش نشد) انتخاب می‌شود؛ برای تحلیل اینکه چرا فروش نمی‌شود. دلیلی که استفاده شده فقط غیرفعال می‌شود." title="دلایل فروش‌نشدن پیش‌فاکتور" />
          <NewRecordButton path="/sales-quote-lost-reasons/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "عنوان", ...s((r) => r.title) },
          { header: "تعداد استفاده", ...s((r) => toFaDigits(String(r.usageCount))), width: "110px" },
          { header: "فعال", ...s((r) => (r.isActive ? "بله" : "خیر")), width: "70px" },
        ]}
        rows={items}
        edit={{ path: (r: Reason) => `/sales-quote-lost-reasons/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

const DEFAULT_FORM = { title: "", isActive: true };

function ReasonForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    if (!editId) return;
    api.get("/sales-quote-lost-reasons").then((rows: Reason[]) => {
      const r = rows.find((x) => x.id === editId);
      if (r && !hasPersistedState(cacheKey)) setForm({ title: r.title, isActive: r.isActive });
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
        await api.put(`/sales-quote-lost-reasons/${editId}`, form);
        flash();
      } else {
        const created = await api.post("/sales-quote-lost-reasons", form);
        flash();
        navigate(`/sales-quote-lost-reasons/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/sales-quote-lost-reasons/${editId}`);
      navigate("/sales-quote-lost-reasons");
    } catch (err) {
      showError((err as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={editId ? "ویرایش دلیل فروش‌نشدن" : "دلیل فروش‌نشدن جدید"}
      formId="sales-quote-lost-reason-form"
      closePath="/sales-quote-lost-reasons"
      newPath="/sales-quote-lost-reasons/new"
      onDelete={editId ? handleDelete : undefined}
    >
      <form id="sales-quote-lost-reason-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
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
