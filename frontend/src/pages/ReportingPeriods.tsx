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
import { toFaDigits } from "../lib/formatAmount";
import { getSavedFiscalPeriodId } from "../lib/userSettings";
import { RequiredMark } from "../components/RequiredMark";

interface Period {
  id: number;
  fiscalPeriodId: number;
  code: string;
  title: string;
  fromDate: string;
  toDate: string;
  status: "OPEN" | "CLOSED";
  hasBeenClosed: boolean;
}

interface FiscalPeriod { id: number; title: string; fromDate: string; toDate: string }

const STATUS_FA: Record<Period["status"], string> = { OPEN: "باز", CLOSED: "بسته" };

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M7 8H4V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 8A8 8 0 1 1 4 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// «دوره مالی جاری» یک تنظیم سراسری قابل انتخاب توسط کاربر است (تنظیمات کاربری)، نه لزوماً آخرین دوره
// مالی تعریف‌شده — دقیقاً همان الگوی resolveFiscalPeriod در JournalEntries.tsx. فقط وقتی کاربر هنوز
// هیچ دوره‌ای انتخاب نکرده، به آخرین دوره مالی برمی‌گردیم.
function useCurrentFiscalPeriodId() {
  const saved = getSavedFiscalPeriodId();
  const [fiscalPeriodId, setFiscalPeriodId] = useState(saved);
  const [resolved, setResolved] = useState(!!saved);

  useEffect(() => {
    if (saved) return;
    api
      .get("/fiscal-periods")
      .then((fps: FiscalPeriod[]) => {
        const last = [...fps].sort((a, b) => (a.toDate < b.toDate ? 1 : -1))[0];
        setFiscalPeriodId(last ? String(last.id) : "");
      })
      .finally(() => setResolved(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { fiscalPeriodId, resolved };
}

export default function ReportingPeriods() {
  const location = useLocation();
  const { id } = useParams();
  const isNew = location.pathname.endsWith("/new");
  const isEdit = location.pathname.endsWith("/edit");
  if (isNew) return <PeriodForm />;
  if (isEdit) return <PeriodEditForm editId={Number(id)} />;
  return <PeriodList />;
}

function PeriodList() {
  const { fiscalPeriodId, resolved } = useCurrentFiscalPeriodId();
  const basePath = fiscalPeriodId ? `/reporting-periods?fiscalPeriodId=${fiscalPeriodId}` : "/reporting-periods";
  const { items, loading, error, remove, reload } = useCrud<Period>(basePath);

  async function bulkClose(rows: Period[]) {
    const targets = rows.filter((r) => r.status === "OPEN");
    if (targets.length === 0) {
      alert("هیچ دوره «باز»ی در انتخاب شما نیست");
      return;
    }
    if (!window.confirm(`${toFaDigits(String(targets.length))} دوره بسته شود؟ دوره بسته قابل ویرایش و حذف نیست.`)) return;
    for (const row of targets) {
      try {
        await api.put(`/reporting-periods/${row.id}/close`, {});
      } catch (e) {
        alert(`دوره ${row.title}: ${(e as ApiError).message}`);
      }
    }
    await reload();
  }

  async function bulkReopen(rows: Period[]) {
    const targets = rows.filter((r) => r.status === "CLOSED");
    if (targets.length === 0) {
      alert("هیچ دوره «بسته»ای در انتخاب شما نیست");
      return;
    }
    for (const row of targets) {
      try {
        await api.put(`/reporting-periods/${row.id}/reopen`, {});
      } catch (e) {
        alert(`دوره ${row.title}: ${(e as ApiError).message}`);
      }
    }
    await reload();
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={`لیست فقط دوره‌های گزارشگری مربوط به دوره مالی جاری را نمایش می‌دهد`} title="دوره گزارشگری" />
          <NewRecordButton path="/reporting-periods/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      {resolved && !loading && (
        <DataTable
          columns={[
            { header: "کد", render: (r) => r.code, width: "90px", filterType: "string", filterValue: (r) => r.code },
            { header: "عنوان", render: (r) => r.title, filterType: "string", filterValue: (r) => r.title },
            { header: "از تاریخ", render: (r) => formatJalaliDate(r.fromDate), filterType: "date", filterValue: (r) => r.fromDate.slice(0, 10) },
            { header: "تا تاریخ", render: (r) => formatJalaliDate(r.toDate), filterType: "date", filterValue: (r) => r.toDate.slice(0, 10) },
            { header: "وضعیت", render: (r) => <span className="badge">{STATUS_FA[r.status]}</span>, filterType: "string", filterValue: (r) => STATUS_FA[r.status] },
          ]}
          rows={items}
          edit={{ path: (r) => `/reporting-periods/${r.id}/edit`, guard: (r) => r.status !== "CLOSED" || "دوره بسته قابل ویرایش نیست" }}
          onDelete={async (r) => {
            const res = await remove(r.id);
            if (!res.ok) alert(res.error);
          }}
          bulkActions={[
            { label: (n) => `بستن دوره (${toFaDigits(String(n))})`, icon: <CheckIcon />, onClick: bulkClose },
            { label: (n) => `بازکردن دوره (${toFaDigits(String(n))})`, icon: <UndoIcon />, onClick: bulkReopen },
          ]}
        />
      )}
    </div>
  );
}

function PeriodForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { fiscalPeriodId, resolved } = useCurrentFiscalPeriodId();
  const { create } = useCrud<Period>("/reporting-periods");
  const [form, setForm] = usePersistedState(`form:${location.pathname}`, { code: "", title: "", toDate: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [fromPreview, setFromPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!resolved || !fiscalPeriodId) return;
    Promise.all([api.get("/fiscal-periods"), api.get(`/reporting-periods?fiscalPeriodId=${fiscalPeriodId}`)]).then(
      ([fps, periods]: [FiscalPeriod[], Period[]]) => {
        const fp = fps.find((f) => String(f.id) === fiscalPeriodId) || null;
        if (!fp) return;
        const lastPeriod = [...periods].sort((a, b) => (a.toDate < b.toDate ? 1 : -1))[0];
        setFromPreview(lastPeriod ? addOneDay(lastPeriod.toDate) : fp.fromDate.slice(0, 10));
      }
    );
  }, [resolved, fiscalPeriodId]);

  function addOneDay(iso: string): string {
    const d = new Date(iso.slice(0, 10));
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const res = await create({ ...form, fiscalPeriodId: fiscalPeriodId ? Number(fiscalPeriodId) : undefined });
    if (res.ok && res.data) navigate(`/reporting-periods/${res.data.id}/edit`, { state: { justCreated: true } });
    else setFormError(res.error || "خطا");
  }

  return (
    <FormPage title="دوره گزارشگری جدید" formId="reporting-period-form" closePath="/reporting-periods" newPath="/reporting-periods/new">
      <form id="reporting-period-form" onSubmit={onSubmit}>
        {formError && <div className="alert error">{formError}</div>}
        <div className="form-grid">
          <div className="form-field">
            <label>کد دوره<RequiredMark /></label>
            <input dir="ltr" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} autoFocus />
          </div>
          <div className="form-field">
            <label>عنوان دوره<RequiredMark /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="form-field">
            <label>از تاریخ</label>
            <JalaliDatePicker value={fromPreview || ""} onChange={() => {}} disabled placeholder="—" />
          </div>
          <div className="form-field">
            <label>تا تاریخ<RequiredMark /></label>
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
  const [code, setCode] = usePersistedState(`${cacheKey}:code`, "");
  const [title, setTitle] = usePersistedState(`${cacheKey}:title`, "");
  const [fromDate, setFromDate] = usePersistedState(`${cacheKey}:fromDate`, "");
  const [toDate, setToDate] = usePersistedState(`${cacheKey}:toDate`, "");
  const [formError, setFormError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(hasPersistedState(`${cacheKey}:toDate`));
  const { flash } = useSavedFlash();

  useEffect(() => {
    if (hasPersistedState(`${cacheKey}:toDate`)) return;
    api
      .get(`/reporting-periods/${editId}`)
      .then((found: Period) => {
        setCode(found.code);
        setTitle(found.title);
        setFromDate(found.fromDate.slice(0, 10));
        setToDate(found.toDate.slice(0, 10));
      })
      .finally(() => setLoaded(true));
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
      await api.put(`/reporting-periods/${editId}`, { code, title, toDate });
      flash();
    } catch (err) {
      setFormError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    try {
      await api.del(`/reporting-periods/${editId}`);
      navigate("/reporting-periods");
    } catch (err) {
      alert((err as ApiError).message);
    }
  }

  if (!loaded) return null;

  return (
    <FormPage
      title={`ویرایش دوره گزارشگری ${title}`}
      description="از تاریخ قابل ویرایش نیست"
      formId="reporting-period-edit-form"
      closePath="/reporting-periods"
      newPath="/reporting-periods/new"
      onDelete={handleDelete}
    >
      <form id="reporting-period-edit-form" onSubmit={onSubmit}>
        {formError && <div className="alert error">{formError}</div>}
        <div className="form-grid">
          <div className="form-field">
            <label>کد دوره<RequiredMark /></label>
            <input dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div className="form-field">
            <label>عنوان دوره<RequiredMark /></label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="form-field">
            <label>از تاریخ</label>
            <JalaliDatePicker value={fromDate} onChange={() => {}} disabled placeholder="انتخاب تاریخ" />
          </div>
          <div className="form-field">
            <label>تا تاریخ<RequiredMark /></label>
            <JalaliDatePicker value={toDate} onChange={setToDate} placeholder="انتخاب تاریخ" />
          </div>
        </div>
      </form>
    </FormPage>
  );
}
