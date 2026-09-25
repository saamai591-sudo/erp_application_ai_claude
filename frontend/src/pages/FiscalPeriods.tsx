import { FormEvent, useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { showError } from "../lib/toast";
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
import { RequiredMark } from "../components/RequiredMark";
import { digitsOnly } from "../lib/digits";
import { toFaDigits } from "../lib/formatAmount";
import DateObject from "react-date-object";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import gregorian from "react-date-object/calendars/gregorian";
import gregorian_en from "react-date-object/locales/gregorian_en";

const toIsoDate = (d: DateObject) => d.convert(gregorian, gregorian_en).format("YYYY-MM-DD");

/** یک روز بعد از یک تاریخ میلادی (YYYY-MM-DD) */
function dayAfter(iso: string): string {
  const d = new Date(iso.slice(0, 10) + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** پایان پیش‌فرض دوره: یک روز قبل از «همان تاریخ در سال جلالی بعد» — مثلاً شروع ۱۳۹۹/۰۱/۰۱ → پایان ۱۳۹۹/۱۲/۲۹ */
function defaultPeriodEnd(startIso: string): string {
  const s = new DateObject({ date: startIso, format: "YYYY-MM-DD", calendar: gregorian, locale: gregorian_en }).convert(persian, persian_fa);
  try {
    const nextYearSame = new DateObject({ year: s.year + 1, month: s.month.number, day: s.day, calendar: persian, locale: persian_fa });
    return toIsoDate(nextYearSame.subtract(1, "day"));
  } catch {
    return "";
  }
}

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
  const navigate = useNavigate();
  const lastPeriod = [...items].sort((a, b) => (a.toDate < b.toDate ? 1 : -1))[0];

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}><InfoHint text={`هر دوره باید ادامه‌ی بدون فاصله‌ی دوره‌ی قبلی باشد؛ فقط تا‌تاریخ آخرین دوره قابل ویرایش است`} title="دوره مالی" /><NewRecordButton path="/fiscal-periods/new" /><RefreshButton onClick={reload} /></div>
      </div>
      <ErrorToast message={error} />
      {!loading && (
        <DataTable
          columns={[
            { header: "کد", render: (r) => toFaDigits(r.code), width: "100px", filterType: "string", filterValue: (r) => r.code },
            { header: "عنوان", render: (r) => r.title, width: "100px", filterType: "string", filterValue: (r) => r.title },
            { header: "از تاریخ", render: (r) => formatJalaliDate(r.fromDate), filterType: "date", filterValue: (r) => r.fromDate.slice(0, 10) },
            { header: "تا تاریخ", render: (r) => formatJalaliDate(r.toDate), filterType: "date", filterValue: (r) => r.toDate.slice(0, 10) },
            { header: "وضعیت", render: (r) => (lastPeriod?.id === r.id ? <span className="badge">دوره جاری/آخرین</span> : "بسته") },
          ]}
          rows={items}
          edit={
            lastPeriod
              ? { path: (r) => `/fiscal-periods/${r.id}/edit`, guard: (r) => r.id === lastPeriod.id || "فقط تا‌تاریخ آخرین دوره مالی قابل ویرایش است" }
              : undefined
          }
          onDelete={async (r) => {
            const res = await remove(r.id);
            if (!res.ok) showError(res.error);
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
  // اگر دوره‌ای از قبل تعریف شده باشد، «از تاریخ» خودکار یک روز بعد از پایان آخرین دوره است و قابل ویرایش نیست (بک‌اند هم دقیقاً همین توالی را کنترل می‌کند)
  const [hasPrevious, setHasPrevious] = useState(false);

  useEffect(() => {
    api.get("/fiscal-periods").then((items: Period[]) => {
      if (items.length === 0) return;
      const last = items.reduce((a, b) => (a.toDate >= b.toDate ? a : b));
      const start = dayAfter(last.toDate);
      setHasPrevious(true);
      // «تا تاریخ» فقط وقتی هنوز چیزی وارد نشده پیش‌فرض می‌گیرد؛ کاربر می‌تواند آن را تغییر دهد
      setForm((prev) => ({ ...prev, fromDate: start, toDate: prev.toDate && prev.fromDate === start ? prev.toDate : defaultPeriodEnd(start) }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const res = await create(form);
    if (res.ok && res.data) navigate(`/fiscal-periods/${res.data.id}/edit`, { state: { justCreated: true } });
    else setFormError(res.error || "خطا");
  }

  return (
    <FormPage title="دوره مالی جدید" formId="period-form" closePath="/fiscal-periods" newPath="/fiscal-periods/new">
      <form id="period-form" onSubmit={onSubmit}>
        <ErrorToast message={formError} />
        <div className="form-grid">
          <div className="form-field">
            <label>عنوان (عدد ۴ رقمی)<RequiredMark /></label>
            <input dir="ltr" value={form.title} onChange={(e) => setForm({ ...form, title: digitsOnly(e.target.value).slice(0, 4) })} />
          </div>
          <div />
          <div className="form-field">
            <label>از تاریخ<RequiredMark /></label>
            <JalaliDatePicker value={form.fromDate} onChange={(v) => setForm({ ...form, fromDate: v })} disabled={hasPrevious} placeholder="انتخاب تاریخ" />
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
  const [fromDate, setFromDate] = usePersistedState(`${cacheKey}:fromDate`, "");
  const [toDate, setToDate] = usePersistedState(`${cacheKey}:toDate`, "");
  const [title, setTitle] = usePersistedState(`${cacheKey}:title`, "");
  const [formError, setFormError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(hasPersistedState(`${cacheKey}:toDate`));
  const { flash } = useSavedFlash();

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
      showError((err as ApiError).message);
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
        <ErrorToast message={formError} />
        <div className="form-grid">
          {/* فیلد «عنوان» بعد از ذخیره هم نمایش داده می‌شود (فقط‌خواندنی، هم‌ساختار فرم ایجاد) */}
          <div className="form-field">
            <label>عنوان (عدد ۴ رقمی)</label>
            <input dir="ltr" value={title} disabled />
          </div>
          <div />
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
