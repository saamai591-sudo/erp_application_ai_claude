import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { FormPage } from "../components/FormPage";
import { RefreshButton } from "../components/RefreshButton";
import { NewRecordButton } from "../components/NewRecordButton";
import { InfoHint } from "../components/InfoHint";
import { RequiredMark } from "../components/RequiredMark";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { MONTHS_FA } from "../lib/payrollLabels";

// منابع انسانی › تنظیمات › تقویم کاری: برای هر سال شمسی ساعات کاری روزانه و ۱۲ ماه (روز/ساعت استاندارد و مجاز + بازه‌ی تردد) تعریف می‌شود.
// ماه در فرم‌های حقوق (روش محاسبه، پارامتر مبنا، ورود اطلاعات، محاسبه) فقط از همین تقویم انتخاب می‌شود.

interface ListRow {
  id: number;
  year: number;
  dailyMinutes: number;
  used: boolean;
}
interface MonthRow {
  month: number;
  startDate: string;
  endDate: string;
  standardDays: number;
  allowedDays: number;
  standardMinutes: number;
  allowedMinutes: number;
  trafficStartDate: string;
  trafficEndDate: string;
  used: boolean;
}

/** دقیقه → «ساعت:دقیقه» (ساعت تا سه رقم، مثل ۲۲۷:۲۰) */
export function minutesToHm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}
const toLatin = (s: string) => s.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
/** «۷:۲۰» → دقیقه (null = نامعتبر) */
function hmToMinutes(s: string): number | null {
  const m = /^(\d{1,3}):([0-5]\d)$/.exec(toLatin(s).trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export default function WorkCalendars() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <CalendarForm />;
  if (location.pathname.endsWith("/edit")) return <CalendarForm editId={Number(id)} />;
  return <CalendarList />;
}

function CalendarList() {
  const cacheKey = "/work-calendars";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/work-calendars").then(setItems).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: ListRow) {
    try {
      await api.del(`/work-calendars/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: ListRow) => string, extra: object = {}) => ({ render: (r: ListRow) => f(r), filterType: "string" as const, filterValue: (r: ListRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint
            text="تقویم کاری هر سال شمسی: ساعات کاری روزانه و ۱۲ ماه با روز و ساعت استاندارد و مجاز. ماه در فرم‌های حقوق و دستمزد (روش محاسبه عامل، پارامترهای مبنا، ورود اطلاعات، محاسبه حقوق) فقط از همین تقویم انتخاب می‌شود. روز و ساعت استاندارد و مجاز به‌صورت متغیر در فرمول‌ها هم قابل استفاده است."
            title="تقویم کاری"
          />
          <NewRecordButton path="/work-calendars/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "سال", ...s((r) => toFaDigits(String(r.year))), width: "100px" },
          { header: "ساعات روزانه", ...s((r) => toFaDigits(minutesToHm(r.dailyMinutes))), width: "130px" },
          { header: "استفاده‌شده", ...s((r) => (r.used ? "بله" : "")), width: "110px" },
        ]}
        rows={items}
        edit={{ path: (r: ListRow) => `/work-calendars/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

/** ورودی ساعت:دقیقه با متن محلی تا نوشتن نیمه‌کاره مختل نشود؛ فقط مقدار معتبر به بیرون می‌رود */
function HmInput({ minutes, onChange, disabled, width = 90 }: { minutes: number; onChange: (m: number) => void; disabled?: boolean; width?: number }) {
  const [text, setText] = useState(minutesToHm(minutes));
  useEffect(() => setText(minutesToHm(minutes)), [minutes]);
  return (
    <input
      dir="ltr"
      inputMode="numeric"
      disabled={disabled}
      value={text}
      style={{ width, textAlign: "center" }}
      onChange={(e) => {
        const t = toLatin(e.target.value).replace(/[^0-9:]/g, "");
        setText(t);
        const m = hmToMinutes(t);
        if (m !== null) onChange(m);
      }}
      onBlur={() => setText(minutesToHm(minutes))}
    />
  );
}

const DEFAULT_FORM = { year: "", dailyTime: "" };

function CalendarForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}`;
  const [form, setForm] = usePersistedState(`${cacheKey}:form`, DEFAULT_FORM);
  const [rows, setRows] = usePersistedState<MonthRow[] | null>(`${cacheKey}:rows`, null);
  const [dailyMinutes, setDailyMinutes] = usePersistedState<number>(`${cacheKey}:daily`, 0);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(`${cacheKey}:rows`));
  const { flash } = useSavedFlash();

  async function load(id: number) {
    const c = await api.get(`/work-calendars/${id}`);
    setForm({ year: String(c.year), dailyTime: minutesToHm(c.dailyMinutes) });
    setDailyMinutes(c.dailyMinutes);
    setRows(c.months);
  }
  useEffect(() => {
    if (!editId || hasPersistedState(`${cacheKey}:rows`)) return;
    load(editId).then(() => setLoaded(true)).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // «ایجاد تقویم»: ماه‌های شمسی سال را با مقدار پیش‌فرض پایین فرم می‌گذارد (ذخیره نمی‌شود تا «ذخیره»)
  async function createCalendar() {
    setError(null);
    try {
      const r = await api.get(`/work-calendars/preview?year=${encodeURIComponent(toLatin(form.year).trim())}&dailyTime=${encodeURIComponent(toLatin(form.dailyTime).trim())}`);
      setDailyMinutes(r.dailyMinutes);
      setRows(r.months);
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  function patch(month: number, p: Partial<MonthRow>) {
    setRows((rows ?? []).map((r) => (r.month === month ? { ...r, ...p } : r)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!rows) return setError("ابتدا «ایجاد تقویم» را بزنید");
    const months = rows.map((r) => ({ month: r.month, allowedDays: r.allowedDays, allowedMinutes: r.allowedMinutes, trafficStartDate: r.trafficStartDate, trafficEndDate: r.trafficEndDate }));
    try {
      if (editId) {
        await api.put(`/work-calendars/${editId}`, { months });
        await load(editId);
        flash();
      } else {
        const created = await api.post("/work-calendars", { year: Number(toLatin(form.year).trim()), dailyTime: toLatin(form.dailyTime).trim(), months });
        flash();
        navigate(`/work-calendars/${created.id}/edit`);
      }
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/work-calendars/${editId}`);
      navigate("/work-calendars");
    } catch (err) {
      showError((err as ApiError).message);
    }
  }

  if (!loaded) return null;
  const anyUsed = !!rows?.some((r) => r.used);

  return (
    <FormPage
      title={editId ? "ویرایش تقویم کاری" : "تقویم کاری جدید"}
      formId="work-calendar-form"
      closePath="/work-calendars"
      newPath="/work-calendars/new"
      onDelete={editId && !anyUsed ? handleDelete : undefined}
    >
      <form id="work-calendar-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>سال<RequiredMark /></label>
            <input dir="ltr" inputMode="numeric" disabled={!!editId} maxLength={4} value={form.year} onChange={(e) => setForm({ ...form, year: toLatin(e.target.value).replace(/\D/g, "") })} autoFocus={!editId} />
          </div>
          <div className="form-field">
            <label>ساعات روزانه<RequiredMark /></label>
            <input
              dir="ltr"
              inputMode="numeric"
              disabled={!!editId}
              placeholder="07:20"
              value={form.dailyTime}
              onChange={(e) => setForm({ ...form, dailyTime: toLatin(e.target.value).replace(/[^0-9:]/g, "") })}
            />
          </div>
          {!editId && (
            <div className="form-field" style={{ alignSelf: "end" }}>
              <button type="button" className="btn secondary" onClick={createCalendar} disabled={!form.year || !form.dailyTime}>
                ایجاد تقویم
              </button>
            </div>
          )}
        </div>
        {editId && <p style={{ opacity: 0.75, fontSize: 12 }}>سال و ساعات روزانه بعد از ثبت قابل تغییر نیست. روز/ساعت مجاز و بازه‌ی تردد فقط برای ماه‌های استفاده‌نشده قابل ویرایش است.</p>}

        {rows && (
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table className="hr-table">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>ردیف</th>
                  <th>ماه</th>
                  <th>تاریخ شروع</th>
                  <th>تاریخ پایان</th>
                  <th>روزهای استاندارد</th>
                  <th>روزهای مجاز</th>
                  <th>ساعات استاندارد</th>
                  <th>ساعات مجاز</th>
                  <th>شروع تردد</th>
                  <th>پایان تردد</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const dis = r.used;
                  return (
                    <tr key={r.month}>
                      <td>{toFaDigits(String(i + 1))}</td>
                      <td>
                        {MONTHS_FA[r.month - 1]}
                        {r.used && <span title="این ماه در محاسبه‌ی حقوق، ورود اطلاعات یا روش محاسبه استفاده شده و قفل است" style={{ marginInlineStart: 6, opacity: 0.7, fontSize: 12 }}>🔒</span>}
                      </td>
                      <td>{formatJalaliDate(r.startDate)}</td>
                      <td>{formatJalaliDate(r.endDate)}</td>
                      <td>{toFaDigits(String(r.standardDays))}</td>
                      <td>
                        <input
                          dir="ltr"
                          inputMode="numeric"
                          disabled={dis}
                          style={{ width: 60, textAlign: "center" }}
                          value={String(r.allowedDays)}
                          onChange={(e) => {
                            const v = Number(toLatin(e.target.value).replace(/\D/g, "").slice(0, 2) || 0);
                            // ساعت مجاز پیش‌فرض = روز مجاز × ساعات روزانه (بعداً قابل ویرایش دستی است)
                            patch(r.month, { allowedDays: v, allowedMinutes: v * dailyMinutes });
                          }}
                        />
                      </td>
                      <td>{toFaDigits(minutesToHm(r.standardMinutes))}</td>
                      <td><HmInput minutes={r.allowedMinutes} disabled={dis} onChange={(m) => patch(r.month, { allowedMinutes: m })} /></td>
                      <td><JalaliDatePicker value={r.trafficStartDate} disabled={dis} onChange={(v) => patch(r.month, { trafficStartDate: v })} /></td>
                      <td><JalaliDatePicker value={r.trafficEndDate} disabled={dis} onChange={(v) => patch(r.month, { trafficEndDate: v })} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!rows && !editId && <p style={{ opacity: 0.75 }}>سال و ساعات روزانه را وارد کنید و «ایجاد تقویم» را بزنید؛ ماه‌های شمسی سال پایین فرم می‌آید.</p>}
      </form>
    </FormPage>
  );
}
