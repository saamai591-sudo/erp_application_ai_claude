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

// مدیریت تردد › عملیات › «ورود و خروج»: ترددهای خام (کارمند + روز + ساعت + جهت). دو منبع در یک فهرست و قابل تفکیک‌اند: ثبت مستقیم (ورود دستی/فایل/دستگاه)
// و ترددی که با تایید «درخواست اصلاح تردد» ساخته شده (ستون «منبع» و شماره‌ی درخواست؛ ویرایش/حذف مستقیم ندارد). قواعد در سرور (services/attendancePunchService.ts).

export interface PunchRow {
  id: number;
  employeeId: number;
  personnelCode: string;
  employeeName: string;
  date: string;
  minute: number;
  time: string;
  direction: "IN" | "OUT" | null;
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

export const DIRECTION_FA: Record<string, string> = { IN: "ورود", OUT: "خروج" };
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
          <InfoHint title="ورود و خروج" text="ترددهای خام کارمندان. ترددی که با تایید «درخواست اصلاح تردد» ثبت می‌شود در همین فهرست با منبع «درخواست اصلاح» و شماره‌ی درخواست دیده می‌شود و فقط با برگشت از تایید همان درخواست تغییر می‌کند." />
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
          { header: "جهت", ...s((r) => (r.direction ? DIRECTION_FA[r.direction] : "—")), width: "80px" },
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

interface PunchLine {
  time: string;
  direction: string;
  description: string;
}

const emptyLine = (direction = ""): PunchLine => ({ time: "", direction, description: "" });

function PunchForm({ editId }: { editId?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { openTab } = useTabs();
  const cacheKey = `form:${location.pathname}:form`;
  const [form, setForm] = usePersistedState(cacheKey, { employeeId: "", date: localTodayIso(), lines: [emptyLine("IN"), emptyLine("OUT")] as PunchLine[] });
  const [meta, setMeta] = useState<{ canEdit: boolean; sourceTitle: string; correctionRequestId: number | null; correctionNumber: number | null; updatedAt?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!editId || hasPersistedState(cacheKey));
  const employees = useEmployeeOptions();
  const { flash } = useSavedFlash();

  useEffect(() => {
    if (!editId) return;
    api.get(`/attendance-punches/${editId}`).then((r: PunchRow) => {
      setMeta({ canEdit: r.canEdit, sourceTitle: r.sourceTitle, correctionRequestId: r.correctionRequestId, correctionNumber: r.correctionNumber, updatedAt: r.updatedAt });
      if (!hasPersistedState(cacheKey)) setForm({ employeeId: String(r.employeeId), date: r.date, lines: [{ time: minutesToMask(r.minute), direction: r.direction ?? "", description: r.description }] });
      setLoaded(true);
    }).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const setLine = (i: number, patch: Partial<PunchLine>) => setForm({ ...form, lines: form.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });

  function minuteOf(text: string): number | null {
    const m = maskToMinutes(text);
    return m !== null && m < 1440 ? m : null;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.employeeId) return setError("کارمند را انتخاب کنید");
    if (!form.date) return setError("تاریخ الزامی است");
    const filled = form.lines.filter((l) => l.time.trim());
    if (filled.length === 0) return setError("دست‌کم یک ساعت وارد کنید");
    const punches = [];
    for (const [i, l] of filled.entries()) {
      const m = minuteOf(l.time);
      if (m === null) return setError(`ساعت ردیف ${toFaDigits(String(i + 1))} نامعتبر است (۰۰:۰۰ تا ۲۳:۵۹)`);
      punches.push({ minute: m, direction: l.direction || null, description: l.description });
    }
    try {
      if (editId) {
        await api.put(`/attendance-punches/${editId}`, { date: form.date, ...punches[0], updatedAt: meta?.updatedAt });
        flash();
        const r: PunchRow = await api.get(`/attendance-punches/${editId}`);
        setMeta((m) => (m ? { ...m, updatedAt: r.updatedAt } : m));
      } else {
        await api.post("/attendance-punches", { employeeId: Number(form.employeeId), date: form.date, punches });
        flash();
        navigate("/attendance-punches");
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
              <label>کارمند<RequiredMark /></label>
              <EmployeePickerField employees={employees} value={form.employeeId} disabled={!!editId} onSelect={(x) => setForm({ ...form, employeeId: String(x.id) })} />
            </div>
            <div className="form-field">
              <label>تاریخ<RequiredMark /></label>
              <JalaliDatePicker value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
            </div>
          </div>
          <h4 style={{ margin: "14px 0 6px" }}>
            ترددها <FieldHint label="ترددها" text="ساعت هر ورود یا خروج (۰۰:۰۰ تا ۲۳:۵۹). جهت اختیاری است؛ اگر خالی بماند، ترددها بعداً به ترتیب زمان جفت‌سازی می‌شوند. برای شیفت شب، تردد بعد از نیمه‌شب با تاریخ همان روز تقویمی ثبت می‌شود." />
          </h4>
          <table className="je-lines-table" style={{ maxWidth: 760 }}>
            <thead>
              <tr><th style={{ width: 50 }}>ردیف</th><th style={{ width: 120 }}>ساعت</th><th style={{ width: 130 }}>جهت</th><th>توضیحات</th><th style={{ width: 40 }}></th></tr>
            </thead>
            <tbody>
              {form.lines.map((l, i) => (
                <tr key={i}>
                  <td>{toFaDigits(String(i + 1))}</td>
                  <td><TimeInput value={l.time} width={90} onChange={(t) => setLine(i, { time: t })} /></td>
                  <td>
                    <select value={l.direction} onChange={(e) => setLine(i, { direction: e.target.value })}>
                      <option value="">نامشخص</option>
                      <option value="IN">ورود</option>
                      <option value="OUT">خروج</option>
                    </select>
                  </td>
                  <td><input value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} /></td>
                  <td>{!editId && form.lines.length > 1 && <button type="button" className="btn-link" onClick={() => setForm({ ...form, lines: form.lines.filter((_, j) => j !== i) })}>×</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!editId && <button type="button" className="btn secondary" style={{ marginTop: 6 }} onClick={() => setForm({ ...form, lines: [...form.lines, emptyLine()] })}>+ ردیف</button>}
        </fieldset>
      </form>
    </FormPage>
  );
}
