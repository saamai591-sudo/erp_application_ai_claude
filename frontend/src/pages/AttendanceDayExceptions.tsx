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
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate, localTodayIso } from "../lib/formatDate";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// مدیریت تردد › عملیات › «استثنای روز»: برای یک تاریخ یا بازه‌ی تاریخ (مثلاً چهارشنبه‌سوری)، ساعت شروع اولین بازه و/یا ساعت پایان آخرین بازه‌ی کاریِ «همه‌ی شیفت‌ها» یا شیفت‌های
// انتخابی را عوض می‌کند، یا روز را «تعطیلی شیفت/رسمی» اعلام می‌کند. خودِ شیفت دست نمی‌خورد. قواعد در سرور (services/attendanceDayExceptionService.ts).

interface ExcRow {
  id: number;
  title: string;
  fromDate: string;
  toDate: string;
  allShifts: boolean;
  shiftIds: number[];
  shiftTitles: string[];
  newStartMinute: number | null;
  newEndMinute: number | null;
  dayType: "SHIFT_OFF" | "OFFICIAL_HOLIDAY" | null;
  effectText: string;
  description: string;
  updatedAt?: string;
}
interface ShiftOpt {
  id: number;
  code: number;
  title: string;
  isActive: boolean;
}
type Effect = "HOURS" | "SHIFT_OFF" | "OFFICIAL_HOLIDAY";

const scopeText = (r: ExcRow) => (r.allShifts ? "همه‌ی شیفت‌ها" : r.shiftTitles.join("، "));
const dateText = (r: ExcRow) => (r.fromDate === r.toDate ? formatJalaliDate(r.fromDate) : `${formatJalaliDate(r.fromDate)} تا ${formatJalaliDate(r.toDate)}`);

export default function AttendanceDayExceptions() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <ExcForm />;
  if (location.pathname.endsWith("/edit")) return <ExcForm editId={Number(id)} />;
  return <ExcList />;
}

function ExcList() {
  const cacheKey = "/attendance-day-exceptions";
  const [items, setItems] = usePersistedState<ExcRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/attendance-day-exceptions").then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function onDelete(row: ExcRow) {
    try {
      await api.del(`/attendance-day-exceptions/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: ExcRow) => string, extra: object = {}) => ({ render: (r: ExcRow) => f(r), filterType: "string" as const, filterValue: (r: ExcRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="استثنای روز" text="برای یک تاریخ یا بازه‌ی تاریخ، ساعت شروع اولین بازه و/یا ساعت پایان آخرین بازه‌ی کاری را (برای همه‌ی شیفت‌ها یا شیفت‌های انتخابی) عوض کنید، یا روز را تعطیلی شیفت/رسمی اعلام کنید. خودِ شیفت تغییر نمی‌کند؛ کارکرد روزانه و فرمول‌ها برای آن روز بر اساس ساعت‌های اصلاح‌شده حساب می‌شوند." />
          <NewRecordButton path="/attendance-day-exceptions/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "عنوان", ...s((r) => r.title) },
          { header: "تاریخ", ...s((r) => dateText(r)), width: "190px" },
          { header: "دامنه", ...s((r) => scopeText(r)) },
          { header: "اثر", ...s((r) => toFaDigits(r.effectText)), width: "200px" },
        ]}
        rows={items}
        edit={{ path: (r: ExcRow) => `/attendance-day-exceptions/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

function ExcForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, { title: "", fromDate: localTodayIso(), toDate: "", allShifts: true, shiftIds: [] as number[], effect: "HOURS" as Effect, start: "", end: "", description: "" });
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [shifts, setShifts] = useState<ShiftOpt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const { flash } = useSavedFlash();

  useEffect(() => {
    api.get("/attendance-shifts").then((r: ShiftOpt[]) => setShifts(r)).catch(() => {});
    if (!editId) return;
    api.get(`/attendance-day-exceptions/${editId}`).then((r: ExcRow) => {
      setUpdatedAt(r.updatedAt);
      if (!hasPersistedState(cacheKey)) {
        setForm({
          title: r.title,
          fromDate: r.fromDate,
          toDate: r.toDate === r.fromDate ? "" : r.toDate,
          allShifts: r.allShifts,
          shiftIds: r.shiftIds,
          effect: r.dayType ?? "HOURS",
          start: r.newStartMinute !== null ? minutesToMask(r.newStartMinute) : "",
          end: r.newEndMinute !== null ? minutesToMask(r.newEndMinute) : "",
          description: r.description,
        });
      }
      setLoaded(true);
    }).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const toggleShift = (id: number) => setForm({ ...form, shiftIds: form.shiftIds.includes(id) ? form.shiftIds.filter((x) => x !== id) : [...form.shiftIds, id] });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("عنوان استثنا الزامی است");
    if (!form.fromDate) return setError("تاریخ الزامی است");
    if (!form.allShifts && form.shiftIds.length === 0) return setError("«همه‌ی شیفت‌ها» را بزنید یا دست‌کم یک شیفت انتخاب کنید");
    let newStartMinute: number | null = null, newEndMinute: number | null = null;
    if (form.effect === "HOURS") {
      newStartMinute = form.start ? maskToMinutes(form.start) : null;
      newEndMinute = form.end ? maskToMinutes(form.end) : null;
      if ((form.start && newStartMinute === null) || (form.end && newEndMinute === null)) return setError("ساعت شروع/پایان را کامل و معتبر وارد کنید (مثلاً 15:00)");
      if (newStartMinute === null && newEndMinute === null) return setError("ساعت شروع جدید و/یا ساعت پایان جدید را وارد کنید");
    }
    const body = {
      title: form.title,
      fromDate: form.fromDate,
      toDate: form.toDate || form.fromDate,
      allShifts: form.allShifts,
      shiftIds: form.allShifts ? [] : form.shiftIds,
      newStartMinute,
      newEndMinute,
      dayType: form.effect === "HOURS" ? null : form.effect,
      description: form.description,
      updatedAt,
    };
    try {
      if (editId) {
        await api.put(`/attendance-day-exceptions/${editId}`, body);
        flash();
        const r: ExcRow = await api.get(`/attendance-day-exceptions/${editId}`);
        setUpdatedAt(r.updatedAt);
      } else {
        const created = await api.post("/attendance-day-exceptions", body);
        flash();
        navigate(`/attendance-day-exceptions/${created.id}/edit`);
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/attendance-day-exceptions/${editId}`);
      navigate("/attendance-day-exceptions");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  return (
    <FormPage title={editId ? "ویرایش استثنای روز" : "استثنای روز جدید"} formId="attendance-exc-form" closePath="/attendance-day-exceptions" newPath="/attendance-day-exceptions/new" onDelete={editId ? handleDelete : undefined}>
      <form id="attendance-exc-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        <div className="form-grid">
          <div className="form-field">
            <label>عنوان<RequiredMark /> <FieldHint label="عنوان" text="مثلاً «چهارشنبه‌سوری» یا «بارندگی». کنار ردیف شیفت در گزارش‌های کارکرد نمایش داده می‌شود." /></label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="form-field">
            <label>از تاریخ<RequiredMark /></label>
            <JalaliDatePicker value={form.fromDate} onChange={(v) => setForm({ ...form, fromDate: v })} />
          </div>
          <div className="form-field">
            <label>تا تاریخ <FieldHint label="تا تاریخ" text="خالی = فقط همان یک روز." /></label>
            <JalaliDatePicker value={form.toDate} onChange={(v) => setForm({ ...form, toDate: v })} />
          </div>
          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label>دامنه <FieldHint label="دامنه" text="همه‌ی شیفت‌ها یا شیفت‌های انتخابی. اگر برای یک روز هم استثنای «همه‌ی شیفت‌ها» و هم استثنای «همان شیفت» باشد، استثنای مخصوص شیفت مقدم است؛ دو استثنای هم‌سطح روی یک روز مجاز نیست." /></label>
            <label className="checkbox-row"><input type="checkbox" checked={form.allShifts} onChange={(e) => setForm({ ...form, allShifts: e.target.checked })} /> همه‌ی شیفت‌ها</label>
            {!form.allShifts && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 6 }}>
                {shifts.filter((x) => x.isActive || form.shiftIds.includes(x.id)).map((x) => (
                  <label key={x.id} className="checkbox-row"><input type="checkbox" checked={form.shiftIds.includes(x.id)} onChange={() => toggleShift(x.id)} /> {x.title}</label>
                ))}
              </div>
            )}
          </div>
          <div className="form-field">
            <label>اثر<RequiredMark /></label>
            <select value={form.effect} onChange={(e) => setForm({ ...form, effect: e.target.value as Effect })}>
              <option value="HOURS">تغییر ساعت شروع/پایان</option>
              <option value="SHIFT_OFF">اعلام تعطیلی شیفت</option>
              <option value="OFFICIAL_HOLIDAY">اعلام تعطیلی رسمی</option>
            </select>
          </div>
          {form.effect === "HOURS" && (
            <>
              <div className="form-field">
                <label>ساعت شروع جدید <FieldHint label="شروع جدید" text="شروع اولین بازه‌ی کاریِ آن روز. خالی = بدون تغییر. باید داخل پنجره‌ی حضور همان بازه و قبل از پایانِ آن باشد؛ وگرنه برای آن کارمند/روز اعمال نمی‌شود و علتش کنار «ردیف شیفت» می‌آید." /></label>
                <TimeInput value={form.start} width={90} placeholder="10:00" onChange={(t) => setForm({ ...form, start: t })} />
              </div>
              <div className="form-field">
                <label>ساعت پایان جدید <FieldHint label="پایان جدید" text="پایان آخرین بازه‌ی کاریِ آن روز. خالی = بدون تغییر. اگر از شروع بازه کوچک‌تر یا مساوی باشد روز بعد حساب می‌شود (شیفت شب). استراحت سر جایش می‌ماند و «ساعت مرخصی» اگر دستی تعیین نشده باشد از طول جدید حساب می‌شود." /></label>
                <TimeInput value={form.end} width={90} placeholder="15:00" onChange={(t) => setForm({ ...form, end: t })} />
              </div>
            </>
          )}
          <div className="form-field" style={{ gridColumn: "1 / -1" }}>
            <label>توضیحات</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
      </form>
    </FormPage>
  );
}
