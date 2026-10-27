import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { FieldHint } from "../components/FieldHint";
import { RequiredMark } from "../components/RequiredMark";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { TimeInput, maskToMinutes, minutesToMask } from "../components/TimeInput";
import { WorkMonthPicker } from "../components/WorkMonthPicker";
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate, localTodayIso } from "../lib/formatDate";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { EmployeePickerField, useEmployeeOptions } from "./AttendancePunches";

// مدیریت تردد › عملیات › «مجوزها»: مقدارِ «عامل مجوز» (عوامل تردد با منبع مجوز) برای یک کارمند. عامل روزانه = مقدار برای یک تاریخ؛ عامل ماهانه = مقدار از یک ماه (تقویم کاری) تا مقدار بعدی.
// قالب مقدار از نوع مقدارِ عامل می‌آید (زمان = ساعت:دقیقه، روز و عدد = عدد). در هر تاریخ/ماه برای هر کارمند و عامل فقط یک مقدار هست (برای تغییر همان را ویرایش کنید).
// با «محاسبه تردد» ماهِ مربوط قفل می‌شود. قواعد در سرور (services/attendancePermitService.ts).

type Level = "DAY" | "MONTH";
type ValueType = "NUMBER" | "TIME" | "DAYS";
interface FactorOpt {
  id: number;
  title: string;
  level: Level;
  valueType: ValueType;
  source: "COMPUTED" | "PERMIT";
  isActive: boolean;
}
interface Row {
  id: number;
  employeeId: number;
  personnelCode: string;
  employeeName: string;
  factorId: number;
  factorTitle: string;
  level: Level;
  valueType: ValueType;
  date: string | null;
  year: number | null;
  month: number | null;
  periodText: string;
  value: number;
  valueText: string;
  updatedAt?: string;
}

const whenText = (r: Row) => (r.level === "DAY" ? formatJalaliDate(r.date as string) : r.periodText);

export default function AttendancePermits() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <PermitForm />;
  if (location.pathname.endsWith("/edit")) return <PermitForm editId={Number(id)} />;
  return <PermitList />;
}

function PermitList() {
  const location = useLocation();
  // لینک «مشاهده سوابق» از پرونده‌ی کارمند: ?employeeId=
  const empQ = new URLSearchParams(location.search).get("employeeId");
  const cacheKey = `/attendance-permits${empQ ? `?employeeId=${empQ}` : ""}`;
  const [items, setItems] = usePersistedState<Row[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get(`/attendance-permits${empQ ? `?employeeId=${empQ}` : ""}`).then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: Row) {
    try {
      await api.del(`/attendance-permits/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: Row) => string, extra: object = {}) => ({ render: (r: Row) => f(r), filterType: "string" as const, filterValue: (r: Row) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="مجوزها" text="مقدار عامل‌های «مجوز» برای هر کارمند: عامل روزانه برای یک تاریخ (مثلاً مجوز ۳ ساعت اضافه‌کار در آن روز) و عامل ماهانه از یک ماه به بعد (مثلاً سقف اضافه‌کار ماهانه تا تغییر بعدی). فرمول‌های تردد این مقدارها را می‌خوانند و ثبت‌نشده = ۰. ماهی که «محاسبه تردد» شده قفل است." />
          <NewRecordButton path="/attendance-permits/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد پرسنلی", ...s((r) => toFaDigits(r.personnelCode)), width: "110px" },
          { header: "کارمند", ...s((r) => r.employeeName) },
          { header: "عامل مجوز", ...s((r) => r.factorTitle) },
          { header: "سطح", ...s((r) => (r.level === "DAY" ? "روزانه" : "ماهانه")), width: "90px" },
          { header: "تاریخ / از ماه", ...s((r) => toFaDigits(whenText(r))), width: "150px" },
          { header: "مقدار", ...s((r) => toFaDigits(r.valueText)), width: "130px" },
        ]}
        rows={items}
        edit={{ path: (r: Row) => `/attendance-permits/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function PermitForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, { employeeId: "", factorId: "", date: localTodayIso(), year: 0, month: 0, value: "" });
  const [meta, setMeta] = useState<Row | null>(null);
  const [factors, setFactors] = useState<FactorOpt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const employees = useEmployeeOptions();
  const { flash } = useSavedFlash();

  const valueToField = (r: { valueType: ValueType; value: number }) => (r.valueType === "TIME" ? minutesToMask(r.value) : String(r.value));
  const toForm = (r: Row) => ({ employeeId: String(r.employeeId), factorId: String(r.factorId), date: r.date ?? localTodayIso(), year: r.year ?? 0, month: r.month ?? 0, value: valueToField(r) });
  async function load() {
    const r: Row = await api.get(`/attendance-permits/${editId}`);
    setMeta(r);
    return r;
  }
  useEffect(() => {
    api.get("/attendance-factors").then((r: FactorOpt[]) => setFactors(r.filter((f) => f.source === "PERMIT"))).catch(() => {});
    // ثبتِ جدید از لینک کارمند (?employeeId=)
    const eid = new URLSearchParams(window.location.search).get("employeeId");
    if (!editId && eid) setForm((f) => (f.employeeId ? f : { ...f, employeeId: eid }));
    if (!editId) return;
    load().then((r) => {
      if (!hasPersistedState(cacheKey)) setForm(toForm(r));
      setLoaded(true);
    }).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const factor = editId && meta ? ({ id: meta.factorId, level: meta.level, valueType: meta.valueType } as Partial<FactorOpt>) : factors.find((f) => String(f.id) === form.factorId);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!editId) {
      if (!form.employeeId) return setError("کارمند را انتخاب کنید");
      if (!form.factorId) return setError("عامل مجوز را انتخاب کنید");
      if (factor?.level === "DAY" && !form.date) return setError("تاریخ را انتخاب کنید");
      if (factor?.level === "MONTH" && !form.year) return setError("ماه را انتخاب کنید");
    }
    let value: number | null;
    if (factor?.valueType === "TIME") {
      value = maskToMinutes(form.value);
      if (value === null) return setError("مقدار را به‌صورت ساعت:دقیقه کامل وارد کنید");
    } else {
      value = form.value === "" ? null : Number(form.value);
      if (value === null || !Number.isFinite(value)) return setError("مقدار را وارد کنید");
    }
    try {
      if (editId) {
        await api.put(`/attendance-permits/${editId}`, { value, updatedAt: meta?.updatedAt });
        flash();
        await load();
      } else {
        const body = { employeeId: Number(form.employeeId), factorId: Number(form.factorId), date: factor?.level === "DAY" ? form.date : undefined, year: factor?.level === "MONTH" ? form.year : undefined, month: factor?.level === "MONTH" ? form.month : undefined, value };
        const created = await api.post("/attendance-permits", body);
        flash();
        navigate(`/attendance-permits/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/attendance-permits/${editId}`);
      navigate("/attendance-permits");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  return (
    <FormPage title={editId ? "ویرایش مقدار مجوز" : "مجوز جدید"} formId="attendance-permit-form" closePath="/attendance-permits" newPath="/attendance-permits/new" onDelete={editId ? handleDelete : undefined}>
      <form id="attendance-permit-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>کارمند<RequiredMark /></label>
            <EmployeePickerField employees={employees} value={form.employeeId} disabled={!!editId} onSelect={(x) => setForm({ ...form, employeeId: String(x.id) })} />
          </div>
          <div className="form-field">
            <label>عامل مجوز<RequiredMark /> <FieldHint label="عامل مجوز" text="فقط عوامل تردد با منبع «مجوز». سطح عامل (روزانه/ماهانه) تعیین می‌کند که تاریخ یا ماه را باید وارد کنید." /></label>
            {editId && meta ? (
              <input disabled value={meta.factorTitle} />
            ) : (
              <select value={form.factorId} onChange={(e) => setForm({ ...form, factorId: e.target.value, value: "" })}>
                <option value="">— انتخاب کنید —</option>
                {factors.filter((f) => f.isActive).map((f) => <option key={f.id} value={f.id}>{f.title} ({f.level === "DAY" ? "روزانه" : "ماهانه"})</option>)}
              </select>
            )}
          </div>
          {factor?.level === "DAY" && (
            <div className="form-field">
              <label>تاریخ<RequiredMark /></label>
              {editId && meta ? <input disabled value={toFaDigits(whenText(meta))} /> : <JalaliDatePicker value={form.date} onChange={(v) => setForm({ ...form, date: v })} />}
            </div>
          )}
          {factor?.level === "MONTH" && (
            <div className="form-field">
              <label>از ماه<RequiredMark /> <FieldHint label="مقدار ماهانه" text="مقدار از این ماه به بعد معتبر است تا مقدارِ بعدی که برای همین کارمند و عامل ثبت شود. برای ماه‌های قبل از اولین مقدار، مقدار صفر است." /></label>
              {editId && meta ? <input disabled value={toFaDigits(whenText(meta))} /> : <WorkMonthPicker year={form.year} month={form.month} autoFix onChange={(y, m) => setForm({ ...form, year: y, month: m })} />}
            </div>
          )}
          {factor && (
            <div className="form-field">
              <label>مقدار<RequiredMark /> <FieldHint label="مقدار" text={factor.valueType === "TIME" ? "ساعت:دقیقه (مثلاً ۳:۰۰)." : factor.valueType === "DAYS" ? "تعداد روز (عدد صحیح)." : "عدد (حداکثر ۴ رقم اعشار)."} /></label>
              {factor.valueType === "TIME" ? (
                <TimeInput value={form.value} width={110} placeholder="3:00" onChange={(t) => setForm({ ...form, value: t })} />
              ) : (
                <input type="number" min={0} step={factor.valueType === "DAYS" ? 1 : "any"} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
              )}
            </div>
          )}
        </div>
        {editId && <p style={{ opacity: 0.7, fontSize: 13 }}>کارمند، عامل و تاریخ/ماهِ یک مقدار بعد از ثبت عوض نمی‌شود؛ برای تغییرشان آن را حذف و دوباره ثبت کنید.</p>}
      </form>
    </FormPage>
  );
}
