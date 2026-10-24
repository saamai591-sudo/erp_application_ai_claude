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
import { RecordPickerField } from "../components/RecordPicker";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { TimeInput, maskToMinutes, minutesToMask } from "../components/TimeInput";
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate, localTodayIso } from "../lib/formatDate";
import { api, ApiError } from "../lib/api";
import { showError } from "../lib/toast";
import { useSavedFlash } from "../lib/useSavedFlash";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";
import { useTabs } from "../lib/TabsContext";

// مدیریت تردد › عملیات › «ورود و خروج»: ترددهای خام = کارمند + تاریخ + ساعت (جهت ورود/خروج ذخیره نمی‌شود؛ بعداً با جفت‌سازی ترددهای هر روز تشخیص داده می‌شود).
// فرم، یک «فرم داده‌ی ساده» است (بدون هدر/ردیف). دو منبع در یک فهرست و قابل تفکیک‌اند: ثبت مستقیم (ورود دستی/فایل/دستگاه) و ترددی که با تایید
// «درخواست اصلاح تردد» ساخته شده (ستون «منبع» و شماره‌ی درخواست؛ ویرایش/حذف مستقیم ندارد). قواعد در سرور (services/attendancePunchService.ts).

export interface PunchRow {
  id: number;
  employeeId: number;
  personnelCode: string;
  employeeName: string;
  date: string;
  workDate: string | null;
  workRowNo: number | null;
  minute: number;
  time: string;
  source: string;
  sourceTitle: string;
  correctionRequestId: number | null;
  correctionNumber: number | null;
  description: string;
  canEdit: boolean;
  updatedAt?: string;
}
export interface EmpOpt {
  id: number;
  personnelCode: string;
  fullName: string;
}

const SOURCE_FILTER: { key: string; label: string }[] = [
  { key: "", label: "همه" },
  { key: "MANUAL", label: "ورود دستی" },
  { key: "CORRECTION", label: "درخواست اصلاح" },
  { key: "IMPORT", label: "ورود از فایل" },
  { key: "DEVICE", label: "دستگاه" },
];

export const addDaysIso = (iso: string, n: number) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);

export function useEmployeeOptions() {
  const [employees, setEmployees] = useState<EmpOpt[]>([]);
  useEffect(() => {
    api.get("/employees").then((rows: any[]) => setEmployees(rows.map((r) => ({ id: r.id, personnelCode: r.personnelCode, fullName: r.fullName })))).catch(() => {});
  }, []);
  return employees;
}

export function EmployeePickerField({ employees, value, onSelect, disabled }: { employees: EmpOpt[]; value: string; onSelect: (e: EmpOpt) => void; disabled?: boolean }) {
  const emp = employees.find((x) => String(x.id) === String(value));
  return (
    <RecordPickerField<EmpOpt>
      title="انتخاب کارمند"
      disabled={disabled}
      displayValue={emp ? `${toFaDigits(emp.personnelCode)} — ${emp.fullName}` : ""}
      rows={employees}
      columns={[
        { header: "کد پرسنلی", render: (x) => toFaDigits(x.personnelCode), filterValue: (x) => x.personnelCode, width: "110px" },
        { header: "نام و نام خانوادگی", render: (x) => x.fullName, filterValue: (x) => x.fullName },
      ]}
      onSelect={onSelect}
    />
  );
}

export default function AttendancePunches() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/new")) return <PunchForm />;
  if (location.pathname.endsWith("/edit")) return <PunchForm editId={Number(id)} />;
  return <PunchList />;
}

function PunchList() {
  const { openTab } = useTabs();
  const cacheKey = "/attendance-punches";
  const [filter, setFilter] = usePersistedState(`${cacheKey}:filter`, { from: addDaysIso(localTodayIso(), -30), to: localTodayIso(), source: "", employeeId: "" });
  const [items, setItems] = usePersistedState<PunchRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  const employees = useEmployeeOptions();

  async function reload() {
    const q = new URLSearchParams();
    if (filter.from) q.set("from", filter.from);
    if (filter.to) q.set("to", filter.to);
    if (filter.source) q.set("source", filter.source);
    if (filter.employeeId) q.set("employeeId", filter.employeeId);
    api.get(`/attendance-punches?${q.toString()}`).then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDelete(row: PunchRow) {
    try {
      await api.del(`/attendance-punches/${row.id}`);
      await reload();
    } catch (e) {
      showError((e as ApiError).message);
    }
  }
  const s = (f: (r: PunchRow) => string, extra: object = {}) => ({ render: (r: PunchRow) => f(r), filterType: "string" as const, filterValue: (r: PunchRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="ورود و خروج" text="ترددهای خام کارمندان (کارمند، تاریخ، ساعت؛ جهت ورود/خروج را سیستم بعداً با جفت‌سازی تشخیص می‌دهد). ترددی که با تایید «درخواست اصلاح تردد» ثبت می‌شود در همین فهرست با منبع «درخواست اصلاح» و شماره‌ی درخواست دیده می‌شود و فقط با برگشت از تایید همان درخواست تغییر می‌کند." />
          <NewRecordButton path="/attendance-punches/new" />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <div className="form-grid" style={{ marginBottom: 8, alignItems: "end" }}>
        <div className="form-field"><label>از تاریخ</label><JalaliDatePicker value={filter.from} onChange={(v) => setFilter({ ...filter, from: v })} /></div>
        <div className="form-field"><label>تا تاریخ</label><JalaliDatePicker value={filter.to} onChange={(v) => setFilter({ ...filter, to: v })} /></div>
        <div className="form-field">
          <label>منبع</label>
          <select value={filter.source} onChange={(e) => setFilter({ ...filter, source: e.target.value })}>
            {SOURCE_FILTER.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label>کارمند</label>
          <div style={{ display: "flex", gap: 4 }}>
            <EmployeePickerField employees={employees} value={filter.employeeId} onSelect={(e) => setFilter({ ...filter, employeeId: String(e.id) })} />
            {filter.employeeId && <button type="button" className="btn-link" onClick={() => setFilter({ ...filter, employeeId: "" })}>همه</button>}
          </div>
        </div>
        <div className="form-field"><button type="button" className="btn" onClick={reload}>نمایش</button></div>
      </div>
      <DataTable
        columns={[
          { header: "کد پرسنلی", ...s((r) => toFaDigits(r.personnelCode)), width: "110px" },
          { header: "کارمند", ...s((r) => r.employeeName) },
          { header: "تاریخ", ...s((r) => formatJalaliDate(r.date)), width: "110px" },
          { header: "ساعت", ...s((r) => toFaDigits(r.time)), width: "80px" },
          { header: "اختصاص دستی (روز کاری / ردیف)", ...s((r) => (r.workDate ? `${formatJalaliDate(r.workDate)} / ${toFaDigits(String(r.workRowNo ?? 1))}` : "")), width: "200px" },
          { header: "منبع", ...s((r) => r.sourceTitle), width: "130px" },
          {
            header: "درخواست اصلاح",
            render: (r: PunchRow) => (r.correctionRequestId ? <button type="button" className="link-btn" onClick={(e) => { e.stopPropagation(); openTab(`/attendance-correction-requests/${r.correctionRequestId}/edit`); }}>{toFaDigits(String(r.correctionNumber))}</button> : ""),
            filterType: "string" as const,
            filterValue: (r: PunchRow) => (r.correctionNumber ? String(r.correctionNumber) : ""),
            width: "120px",
          },
          { header: "توضیحات", ...s((r) => r.description) },
        ]}
        rows={items}
        edit={{ path: (r: PunchRow) => `/attendance-punches/${r.id}/edit` }}
        onDelete={onDelete}
      />
    </div>
  );
}

interface WindowOpt {
  workDate: string;
  rowNo: number;
  rest: boolean;
  segStartClock: number | null;
  segEndClock: number | null;
  segEndsNextDay: boolean;
  windowStart: { date: string; clock: number };
  windowEnd: { date: string; clock: number };
}
const hm = (m: number) => toFaDigits(minutesToMask(m));
/** برچسب یک پنجره در انتخابگر: «تاریخ روز کاری از ساعت … تا ساعت …» (بازه‌ی شیفت) + محدوده‌ی پنجره‌ی حضور */
function windowLabel(o: WindowOpt): string {
  const head = formatJalaliDate(o.workDate);
  const seg = o.rest ? "روز استراحت" : `از ساعت ${hm(o.segStartClock as number)} تا ساعت ${hm(o.segEndClock as number)}${o.segEndsNextDay ? " (روز بعد)" : ""}`;
  const ws = `${hm(o.windowStart.clock)}${o.windowStart.date < o.workDate ? " روز قبل" : o.windowStart.date > o.workDate ? " روز بعد" : ""}`;
  const we = `${hm(o.windowEnd.clock)}${o.windowEnd.date > o.workDate ? " روز بعد" : ""}`;
  return `${toFaDigits(head)} ${seg} — پنجره: ${ws} تا ${we}`;
}

function PunchForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { openTab } = useTabs();
  const cacheKey = `form:${location.pathname}:form`;
  // فرم داده‌ی ساده: تاریخ + کارمند + ساعت. بعد از ثبتِ تردد جدید، تاریخ و کارمند می‌مانند و فقط ساعت پاک می‌شود تا ترددهای بعدی سریع وارد شوند
  const [form, setForm] = usePersistedState(cacheKey, { employeeId: "", date: localTodayIso(), time: "", workDate: "", workRowNo: "1" });
  const [meta, setMeta] = useState<{ canEdit: boolean; sourceTitle: string; correctionRequestId: number | null; correctionNumber: number | null; updatedAt?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const employees = useEmployeeOptions();
  const { flash } = useSavedFlash();
  const [windowOpts, setWindowOpts] = useState<WindowOpt[]>([]);
  const [windowNote, setWindowNote] = useState<string | null>(null);

  // گزینه‌های «اختصاص دستی به پنجره»: پنجره‌های روز قبل/همان روز/روز بعد از تاریخ تردد از روی شیفتِ منتسب به کارمند
  useEffect(() => {
    setWindowOpts([]);
    setWindowNote(null);
    if (!form.employeeId || !form.date) return;
    let alive = true;
    api.get(`/attendance-punches/window-options?employeeId=${form.employeeId}&date=${form.date}`)
      .then((r: WindowOpt[]) => { if (alive) { setWindowOpts(r); if (r.length === 0) setWindowNote("برای این کارمند در این روزها شیفتی منتسب نیست (فرم «انتساب شیفت»)"); } })
      .catch(() => {});
    return () => { alive = false; };
  }, [form.employeeId, form.date]);

  useEffect(() => {
    if (!editId) return;
    api.get(`/attendance-punches/${editId}`).then((r: PunchRow) => {
      setMeta({ canEdit: r.canEdit, sourceTitle: r.sourceTitle, correctionRequestId: r.correctionRequestId, correctionNumber: r.correctionNumber, updatedAt: r.updatedAt });
      if (!hasPersistedState(cacheKey)) setForm({ employeeId: String(r.employeeId), date: r.date, time: minutesToMask(r.minute), workDate: r.workDate ?? "", workRowNo: String(r.workRowNo ?? 1) });
      setLoaded(true);
    }).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.employeeId) return setError("کارمند را انتخاب کنید");
    if (!form.date) return setError("تاریخ الزامی است");
    const minute = maskToMinutes(form.time);
    if (minute === null || minute >= 1440) return setError("ساعت را کامل وارد کنید (۰۰:۰۰ تا ۲۳:۵۹)");
    try {
      if (editId) {
        await api.put(`/attendance-punches/${editId}`, { date: form.date, minute, workDate: form.workDate || null, workRowNo: form.workDate ? Number(form.workRowNo) : null, updatedAt: meta?.updatedAt });
        flash();
        const r: PunchRow = await api.get(`/attendance-punches/${editId}`);
        setMeta((m) => (m ? { ...m, updatedAt: r.updatedAt } : m));
      } else {
        await api.post("/attendance-punches", { employeeId: Number(form.employeeId), date: form.date, minute, workDate: form.workDate || null, workRowNo: form.workDate ? Number(form.workRowNo) : null });
        flash();
        setForm({ ...form, time: "", workDate: "", workRowNo: "1" });
      }
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  async function handleDelete() {
    if (!editId) return;
    try {
      await api.del(`/attendance-punches/${editId}`);
      navigate("/attendance-punches");
    } catch (e) {
      showError((e as ApiError).message);
    }
  }

  if (!loaded) return null;
  const readOnly = !!editId && meta !== null && !meta.canEdit;
  return (
    <FormPage title={editId ? "ویرایش تردد" : "ثبت ورود و خروج"} formId="attendance-punch-form" closePath="/attendance-punches" newPath="/attendance-punches/new" onDelete={editId && !readOnly ? handleDelete : undefined}>
      <form id="attendance-punch-form" onSubmit={onSubmit}>
        <ErrorToast message={error} />
        {readOnly && (
          <div className="alert warn" style={{ marginBottom: 12, maxWidth: 900 }}>
            این تردد با تایید «درخواست اصلاح تردد»{meta?.correctionNumber ? ` شماره ${toFaDigits(String(meta.correctionNumber))}` : ""} ثبت شده و مستقیم تغییر نمی‌کند؛ برای تغییر، درخواست را برگشت از تایید کنید.{" "}
            {meta?.correctionRequestId && <button type="button" className="link-btn" onClick={() => openTab(`/attendance-correction-requests/${meta.correctionRequestId}/edit`)}>باز کردن درخواست</button>}
          </div>
        )}
        {editId && meta && !readOnly && <p style={{ margin: "0 0 8px", fontSize: 13, opacity: 0.8 }}>منبع: {meta.sourceTitle}</p>}
        <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0 }}>
          <div className="form-grid">
            <div className="form-field">
              <label>تاریخ<RequiredMark /></label>
              <JalaliDatePicker value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
            </div>
            <div className="form-field">
              <label>کارمند<RequiredMark /></label>
              <EmployeePickerField employees={employees} value={form.employeeId} disabled={!!editId} onSelect={(x) => setForm({ ...form, employeeId: String(x.id) })} />
            </div>
            <div className="form-field">
              <label>ساعت<RequiredMark /> <FieldHint label="ساعت" text="ساعت تردد (۰۰:۰۰ تا ۲۳:۵۹). جهت ورود یا خروج وارد نمی‌شود؛ سیستم بعداً با جفت‌کردن ترددهای هر روز آن را تشخیص می‌دهد. تردد بعد از نیمه‌شب با تاریخ همان روز تقویمی ثبت می‌شود." /></label>
              <TimeInput value={form.time} width={100} autoFocus={!editId} onChange={(t) => setForm({ ...form, time: t })} />
            </div>
            <div className="form-field">
              <label>اختصاص دستی به پنجره <FieldHint label="اختصاص دستی" text="فقط برای استثنا: هر تردد به‌طور خودکار با ساعتش در پنجره‌ی حضورِ یک ردیف شیفت می‌افتد. اگر باید به پنجره‌ی دیگری تعلق داشته باشد، آن را از فهرست انتخاب کنید؛ فهرست از روی شیفتِ منتسب به کارمند، تاریخ روز کاری و ساعت شروع و پایان بازه (و محدوده‌ی پنجره) را نشان می‌دهد. فقط پنجره‌های روز قبل، همان روز و روز بعد از تاریخ تردد نمایش داده می‌شود." /></label>
              {(() => {
                const cur = form.workDate ? `${form.workDate}|${form.workRowNo}` : "";
                const known = windowOpts.some((o) => `${o.workDate}|${o.rowNo}` === cur);
                return (
                  <select value={cur} onChange={(e) => { const [d, r] = e.target.value ? e.target.value.split("|") : ["", "1"]; setForm({ ...form, workDate: d, workRowNo: r }); }} style={{ maxWidth: 560 }}>
                    <option value="">خودکار (بر اساس ساعت تردد)</option>
                    {cur && !known && <option value={cur}>{formatJalaliDate(form.workDate)} — ردیف {toFaDigits(form.workRowNo)} (فعلی)</option>}
                    {windowOpts.map((o) => <option key={`${o.workDate}|${o.rowNo}`} value={`${o.workDate}|${o.rowNo}`}>{windowLabel(o)}</option>)}
                  </select>
                );
              })()}
              {windowNote && <small style={{ opacity: 0.7 }}>{windowNote}</small>}
            </div>
          </div>
        </fieldset>
      </form>
    </FormPage>
  );
}
