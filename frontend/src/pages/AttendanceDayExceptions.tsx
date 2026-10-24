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

// مدیریت تردد › عملیات › «استثنای روز»: برای فقط «یک تاریخ» (مثلاً چهارشنبه‌سوری) و دامنه‌ی «همه‌ی شیفت‌ها» یا شیفت‌های انتخابی، یکی از پنج اثر: تغییر ساعت شروع / تغییر ساعت پایان /
// تغییر شروع و پایان (شروع اولین بازه‌ی کاری و پایان آخرین بازه‌ی کاری) یا اعلام تعطیلی شیفت / تعطیلی رسمی. خودِ شیفت دست نمی‌خورد. قواعد در سرور (services/attendanceDayExceptionService.ts).

type Effect = "START" | "END" | "START_END" | "SHIFT_OFF" | "OFFICIAL_HOLIDAY";
const EFFECT_FA: Record<Effect, string> = { START: "تغییر ساعت شروع", END: "تغییر ساعت پایان", START_END: "تغییر ساعت شروع/پایان", SHIFT_OFF: "اعلام تعطیلی شیفت", OFFICIAL_HOLIDAY: "اعلام تعطیلی رسمی" };

interface ExcRow {
  id: number;
  title: string;
  date: string;
  allShifts: boolean;
  shiftIds: number[];
  shiftTitles: string[];
  newStartMinute: number | null;
  newEndMinute: number | null;
  effect: Effect;
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

const scopeText = (r: ExcRow) => (r.allShifts ? "همه‌ی شیفت‌ها" : r.shiftTitles.join("، "));

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
          <InfoHint title="استثنای روز" text="برای یک تاریخ، ساعت شروع اولین بازه و/یا ساعت پایان آخرین بازه‌ی کاری را (برای همه‌ی شیفت‌ها یا شیفت‌های انتخابی) عوض کنید، یا روز را تعطیلی شیفت/رسمی اعلام کنید. خودِ شیفت تغییر نمی‌کند؛ کارکرد روزانه و فرمول‌ها برای آن روز بر اساس ساعت‌های اصلاح‌شده حساب می‌شوند." />
          <NewRecordButton path="/attendance-day-exceptions/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "عنوان", ...s((r) => r.title) },
          { header: "تاریخ", ...s((r) => formatJalaliDate(r.date)), width: "120px" },
          { header: "دامنه", ...s((r) => scopeText(r)) },
          { header: "اثر", ...s((r) => toFaDigits(r.effectText)), width: "230px" },
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
  const [form, setForm] = usePersistedState(cacheKey, { title: "", date: localTodayIso(), allShifts: true, shiftIds: [] as number[], effect: "START_END" as Effect, start: "", end: "", description: "" });
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
          date: r.date,
          allShifts: r.allShifts,
          shiftIds: r.shiftIds,
          effect: r.effect,
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
  const needStart = form.effect === "START" || form.effect === "START_END";
  const needEnd = form.effect === "END" || form.effect === "START_END";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) return setError("عنوان استثنا الزامی است");
    if (!form.date) return setError("تاریخ الزامی است");
    if (!form.allShifts && form.shiftIds.length === 0) return setError("«همه‌ی شیفت‌ها» را بزنید یا دست‌کم یک شیفت انتخاب کنید");
    const newStartMinute = needStart ? maskToMinutes(form.start) : null;
    const newEndMinute = needEnd ? maskToMinutes(form.end) : null;
    if (needStart && newStartMinute === null) return setError("ساعت شروع جدید را کامل و معتبر وارد کنید (مثلاً 10:00)");
    if (needEnd && newEndMinute === null) return setError("ساعت پایان جدید را کامل و معتبر وارد کنید (مثلاً 15:00)");
    const body = { title: form.title, date: form.date, allShifts: form.allShifts, shiftIds: form.allShifts ? [] : form.shiftIds, effect: form.effect, newStartMinute, newEndMinute, description: form.description, updatedAt };
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
            <label>تاریخ<RequiredMark /></label>
            <JalaliDatePicker value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
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
              {(Object.keys(EFFECT_FA) as Effect[]).map((k) => <option key={k} value={k}>{EFFECT_FA[k]}</option>)}
            </select>
          </div>
          {needStart && (
            <div className="form-field">
              <label>ساعت شروع جدید<RequiredMark /> <FieldHint label="شروع جدید" text="شروع اولین بازه‌ی کاریِ آن روز. باید داخل پنجره‌ی حضور همان بازه و قبل از پایانِ آن باشد؛ وگرنه برای آن کارمند/روز اعمال نمی‌شود و علتش کنار «ردیف شیفت» می‌آید." /></label>
              <TimeInput value={form.start} width={90} placeholder="10:00" onChange={(t) => setForm({ ...form, start: t })} />
            </div>
          )}
          {needEnd && (
            <div className="form-field">
              <label>ساعت پایان جدید<RequiredMark /> <FieldHint label="پایان جدید" text="پایان آخرین بازه‌ی کاریِ آن روز. اگر از شروع بازه کوچک‌تر یا مساوی باشد روز بعد حساب می‌شود (شیفت شب). استراحت سر جایش می‌ماند و «ساعت مرخصی» اگر دستی تعیین نشده باشد از طول جدید حساب می‌شود." /></label>
              <TimeInput value={form.end} width={90} placeholder="15:00" onChange={(t) => setForm({ ...form, end: t })} />
            </div>
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
