import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useCrud } from "../lib/useCrud";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { formatJalaliDate } from "../lib/formatDate";
import { api, ApiError } from "../lib/api";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { InfoHint } from "../components/InfoHint";
import { digitsOnly } from "../lib/digits";
import { toFaDigits } from "../lib/formatAmount";

interface Period { id: number; code: string; title: string; fromDate: string; toDate: string; hasTransactions: boolean }

export default function FiscalPeriods() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <PeriodForm />;
  if (isEdit) return <PeriodEditForm editId={Number(id)} />;
  return <PeriodList />;
}

function PeriodList() {
  const { items, loading, error, remove, reload } = useCrud<Period>("/fiscal-periods");
  const [bulkSlot, setBulkSlot] = useState<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const lastPeriod = [...items].sort((a, b) => (a.toDate < b.toDate ? 1 : -1))[0];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>دوره مالی</h2>
        </div>
        <div className="header-toolbar" style={{ gap: 4 }}><InfoHint text={`هر دوره باید ادامه‌ی بدون فاصله‌ی دوره‌ی قبلی باشد؛ فقط تا‌تاریخ آخرین دوره قابل ویرایش است`} title="دوره مالی" /><NewRecordButton path="/fiscal-periods/new" /><RefreshButton onClick={reload} /><div ref={setBulkSlot} className="bulk-slot" style={{ display: "flex" }} /></div>
      </div>
      {error && <div className="alert error">{error}</div>}
      {!loading && (
        <DataTable
        bulkActionsContainer={bulkSlot}
          columns={[
            { header: "کد", render: (r) => toFaDigits(r.code), width: "100px", filterType: "string", filterValue: (r) => r.code },
            { header: "عنوان", render: (r) => r.title, width: "100px", filterType: "string", filterValue: (r) => r.title },
            { header: "از تاریخ", render: (r) => formatJalaliDate(r.fromDate), filterType: "date", filterValue: (r) => r.fromDate.slice(0, 10) },
            { header: "تا تاریخ", render: (r) => formatJalaliDate(r.toDate), filterType: "date", filterValue: (r) => r.toDate.slice(0, 10) },
            { header: "وضعیت", render: (r) => (lastPeriod?.id === r.id ? <span className="badge">دوره جاری/آخرین</span> : "بسته") },
          ]}
          rows={items}
          onEdit={lastPeriod ? (r) => (r.id === lastPeriod.id ? navigate(`/fiscal-periods/${r.id}/edit`) : alert("فقط تا‌تاریخ آخرین دوره مالی قابل ویرایش است")) : undefined}
          onDelete={async (r) => {
            const res = await remove(r.id);
            if (!res.ok) alert(res.error);
          }}
        />
      )}
    </div>
  );
}

function PeriodForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { create } = useCrud<Period>("/fiscal-periods");
  const [form, setForm] = usePersistedState(`form:${location.pathname}`, { title: "", fromDate: "", toDate: "" });
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const res = await create(form);
    if (res.ok && res.data) navigate(`/fiscal-periods/${res.data.id}/edit`, { state: { justCreated: true } });
    else setFormError(res.error || "خطا");
  }

  return (
    <FormPage title="دوره مالی جدید" formId="period-form" closePath="/fiscal-periods" newPath="/fiscal-periods/new">
      <form id="period-form" onSubmit={onSubmit}>
        {formError && <div className="alert error">{formError}</div>}
        <div className="form-grid">
          <div className="form-field">
            <label>عنوان (عدد ۴ رقمی)</label>
            <input dir="ltr" value={form.title} onChange={(e) => setForm({ ...form, title: digitsOnly(e.target.value).slice(0, 4) })} />
          </div>
          <div />
          <div className="form-field">
            <label>از تاریخ</label>
            <JalaliDatePicker value={form.fromDate} onChange={(v) => setForm({ ...form, fromDate: v })} placeholder="انتخاب تاریخ" />
          </div>
          <div className="form-field">
            <label>تا تاریخ</label>
            <JalaliDatePicker value={form.toDate} onChange={(v) => setForm({ ...form, toDate: v })} placeholder="انتخاب تاریخ" />
          </div>
        </div>
      </form>
    </FormPage>
  );
}

function PeriodEditForm({ editId }: { editId: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const [fromDate, setFromDate] = usePersistedState(`${cacheKey}:fromDate`, "");
  const [toDate, setToDate] = usePersistedState(`${cacheKey}:toDate`, "");
  const [title, setTitle] = usePersistedState(`${cacheKey}:title`, "");
  const [formError, setFormError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(hasPersistedState(`${cacheKey}:toDate`));
  const { saved, flash } = useSavedFlash();

  useEffect(() => {
    if (hasPersistedState(`${cacheKey}:toDate`)) return;
    api.get("/fiscal-periods").then((items: Period[]) => {
      const found = items.find((i) => i.id === editId);
      if (found) {
        setFromDate(found.fromDate.slice(0, 10));
        setToDate(found.toDate.slice(0, 10));
        setTitle(found.title);
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  useEffect(() => {
    if ((location.state as any)?.justCreated) {
      flash();
      window.history.replaceState({}, "", location.pathname + location.search);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await api.put(`/fiscal-periods/${editId}`, { toDate });
      flash();
    } catch (err) {
      setFormError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    try {
      await api.del(`/fiscal-periods/${editId}`);
      navigate("/fiscal-periods");
    } catch (err) {
      alert((err as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={`ویرایش دوره مالی ${title}`}
      description="فقط تا‌تاریخ آخرین دوره مالی قابل ویرایش است"
      formId="period-edit-form"
      closePath="/fiscal-periods"
      newPath="/fiscal-periods/new"
      onDelete={handleDelete}
    >
      <form id="period-edit-form" onSubmit={onSubmit}>
        {formError && <div className="alert error">{formError}</div>}
        {saved && <div className="alert warn">تغییرات ذخیره شد</div>}
        <div className="form-grid">
          <div className="form-field">
            <label>از تاریخ</label>
            <JalaliDatePicker value={fromDate} onChange={() => {}} disabled placeholder="انتخاب تاریخ" />
          </div>
          <div className="form-field">
            <label>تا تاریخ</label>
            <JalaliDatePicker value={toDate} onChange={setToDate} placeholder="انتخاب تاریخ" />
          </div>
        </div>
      </form>
    </FormPage>
  );
}
