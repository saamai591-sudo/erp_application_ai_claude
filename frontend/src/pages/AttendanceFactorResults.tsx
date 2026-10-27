import { useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { Modal } from "../components/Modal";
import { RefreshButton } from "../components/RefreshButton";
import { InfoHint } from "../components/InfoHint";
import { AttendanceMonthField, EMPTY_MONTH } from "../components/AttendanceMonthField";
import { minutesToMask } from "../components/TimeInput";
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { api } from "../lib/api";
import { usePersistedState } from "../lib/usePersistedState";
import { EmployeePickerField } from "./AttendancePunches";

// مدیریت تردد › گزارش › «نتایج عوامل تردد»: محاسبه‌ی عوامل روزانه و ماهانه برای یک ماه تقویم کاری (بازه‌ی تردد همان ماه). مشتق و ذخیره‌نشده؛ هر مقدار ردپای فرمول
// (شاخه‌ی اجراشده و عبارت جایگذاری‌شده) دارد که در «جزئیات» دیده می‌شود. روزِ دارای بازه‌ی ناقص «ناقص» علامت می‌خورد. قواعد در سرور (services/attendanceFactorService.ts).

interface Val {
  value: number | null;
  branch?: number;
  expression?: string;
  error?: string;
}
interface FactorInfo {
  key: string;
  id: number;
  title: string;
  level: "DAY" | "MONTH";
  valueType: "NUMBER" | "TIME" | "DAYS";
  error: string | null;
}
interface EmpRow {
  employeeId: number;
  personnelCode: string;
  employeeName: string;
  days: number;
  incompleteDays: number;
  values: Record<string, Val>;
}
interface DayRow {
  employeeId: number;
  personnelCode: string;
  employeeName: string;
  date: string;
  shiftTitle: string;
  incomplete: boolean;
  vars: Record<string, number>;
  values: Record<string, Val>;
}
interface Result {
  year: number;
  month: number;
  from: string;
  to: string;
  factors: FactorInfo[];
  bands?: { key: string; title: string }[];
  employees: EmpRow[];
  days: DayRow[];
  summary: { employees: number; days: number; incompleteDays: number; factorErrors: number };
}

const fmt = (v: Val | undefined, t: FactorInfo["valueType"]) => {
  if (!v) return "";
  if (v.value === null) return "خطا";
  if (t === "TIME") return toFaDigits(minutesToMask(Math.round(v.value)));
  return toFaDigits(String(Math.round(v.value * 100) / 100));
};

const VAR_FA: Record<string, string> = {
  PLANNED: "ساعت کاری برنامه‌ریزی‌شده (خالص)",
  PLANNED_GROSS: "ساعت کاری برنامه‌ریزی‌شده (قبل از استراحت)",
  PRESENCE: "حضور کل (شامل خارج از بازه)",
  PRESENCE_IN_SHIFT: "حضور داخل بازه‌ی شیفت",
  REST_PRESENCE: "حضور در روز استراحت",
  LATE: "تاخیر ورود",
  EARLY_LEAVE: "تعجیل خروج",
  OT_BEFORE: "اضافه‌کار قبل از بازه",
  OT_AFTER: "اضافه‌کار بعد از بازه",
  BREAK: "استراحت",
  LEAVE_MINUTES: "ساعت مرخصی روز",
  IS_WORK_DAY: "روز کاری",
  IS_REST_DAY: "روز استراحت",
  ABSENT: "غیبت",
  ROWS: "تعداد بازه‌های کاری",
  INCOMPLETE_ROWS: "بازه‌های ناقص",
};
const TIME_VARS = new Set(["PLANNED", "PLANNED_GROSS", "PRESENCE", "PRESENCE_IN_SHIFT", "REST_PRESENCE", "LATE", "EARLY_LEAVE", "OT_BEFORE", "OT_AFTER", "BREAK", "LEAVE_MINUTES"]);

export default function AttendanceFactorResults() {
  const key = "/attendance-factor-results";
  const [filter, setFilter] = usePersistedState(`${key}:filter`, { year: 0, month: 0, to: "", employeeId: "" });
  const monthOf = { ...EMPTY_MONTH, year: filter.year, month: filter.month };
  const [tab, setTab] = usePersistedState(`${key}:tab`, "month");
  const [data, setData] = usePersistedState<Result | null>(key, null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<{ title: string; vars?: Record<string, number>; values: Record<string, Val> } | null>(null);
  // کارمندان قابل انتخاب: انتسابِ شیفت تا پایان بازه‌ی تردد ماه انتخابی
  const [employees, setEmployees] = useState<{ id: number; personnelCode: string; fullName: string }[]>([]);
  useEffect(() => {
    if (!filter.to) return;
    api.get(`/attendance-factors/results/employees?to=${filter.to}`).then((rows: { id: number; code: string; name: string }[]) => setEmployees(rows.map((r) => ({ id: r.id, personnelCode: r.code, fullName: r.name })))).catch(() => {});
  }, [filter.to]);

  async function load() {
    if (!filter.year || !filter.month) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({ year: String(filter.year), month: String(filter.month) });
      if (filter.employeeId) q.set("employeeId", filter.employeeId);
      setData(await api.get(`/attendance-factors/results?${q.toString()}`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  // با عوض‌شدن (یا پیش‌فرض‌شدنِ) ماه، نتایج همان ماه محاسبه می‌شود
  useEffect(() => {
    if (filter.year) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.year, filter.month, filter.employeeId]);

  const monthFactors = data?.factors.filter((f) => f.level === "MONTH") ?? [];
  const dayFactors = data?.factors.filter((f) => f.level === "DAY") ?? [];
  const sum = data?.summary;
  const s = <T,>(f: (r: T) => string, extra: object = {}) => ({ render: (r: T) => f(r), filterType: "string" as const, filterValue: (r: T) => f(r), ...extra });
  const factorCol = <T extends { values: Record<string, Val> }>(f: FactorInfo) => ({
    header: f.title + (f.error ? " ⚠" : ""),
    ...s<T>((r) => fmt(r.values[f.key], f.valueType)),
    width: "130px",
  });
  const titleOf = (k: string) => data?.factors.find((x) => x.key === k);
  const failed = data?.factors.filter((f) => f.error) ?? [];

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="نتایج عوامل تردد" text="عوامل روزانه برای هر روزِ هر کارمند و عوامل ماهانه برای هر ماه، با فرمول‌های تعریف‌شده در «عوامل تردد» محاسبه می‌شوند. بازه‌ی محاسبه همان بازه‌ی تردد ماه در تقویم کاری است. روزِ دارای بازه‌ی ناقص (تعداد فردِ تردد) با علامت «ناقص» مشخص می‌شود و فقط بازه‌های کامل آن در متغیرها می‌آید. این گزارش مشتق است و ذخیره نمی‌شود." />
          <RefreshButton onClick={load} />
        </div>
      </div>
      <ErrorToast message={error} />
      <div className="card ar-filters">
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
        <AttendanceMonthField value={monthOf} onChange={(v) => (v.year !== filter.year || v.month !== filter.month || v.to !== filter.to) && setFilter({ ...filter, year: v.year, month: v.month, to: v.to, employeeId: employees.some((e) => String(e.id) === filter.employeeId) && v.to === filter.to ? filter.employeeId : "" })} />
        <div className="form-field-inline">
          <label>کارمند</label>
          <div style={{ display: "flex", gap: 4 }}>
            <EmployeePickerField employees={employees} value={filter.employeeId} onSelect={(e) => setFilter({ ...filter, employeeId: String(e.id) })} />
            {filter.employeeId && <button type="button" className="btn-link" onClick={() => setFilter({ ...filter, employeeId: "" })}>همه</button>}
          </div>
        </div>
        </div>
      </div>
      {sum && data && (
        <p style={{ margin: "0 0 8px", fontSize: 13, opacity: 0.85 }}>
          بازه‌ی تردد: {formatJalaliDate(data.from)} تا {formatJalaliDate(data.to)} — {toFaDigits(String(sum.employees))} کارمند — {toFaDigits(String(sum.days))} روز — روز ناقص: <b>{toFaDigits(String(sum.incompleteDays))}</b>
          {sum.factorErrors > 0 && <> — عامل دارای خطای تعریف: <b style={{ color: "#c0392b" }}>{toFaDigits(String(sum.factorErrors))}</b></>}
        </p>
      )}
      {failed.length > 0 && (
        <div className="alert" style={{ marginBottom: 8 }}>
          {failed.map((f) => <div key={f.key}>«{f.title}»: {f.error}</div>)}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, margin: "6px 0" }}>
        <button type="button" className={tab === "month" ? "btn" : "btn secondary"} onClick={() => setTab("month")}>ماهانه</button>
        <button type="button" className={tab === "day" ? "btn" : "btn secondary"} onClick={() => setTab("day")}>روزانه</button>
      </div>
      {tab === "month" ? (
        <DataTable<EmpRow & { id: number }>
          columns={[
            { header: "کد پرسنلی", ...s<EmpRow>((r) => toFaDigits(r.personnelCode)), width: "100px" },
            { header: "کارمند", ...s<EmpRow>((r) => r.employeeName) },
            { header: "روزها", ...s<EmpRow>((r) => toFaDigits(String(r.days))), width: "70px" },
            { header: "روز ناقص", ...s<EmpRow>((r) => toFaDigits(String(r.incompleteDays))), width: "80px" },
            ...monthFactors.map((f) => factorCol<EmpRow>(f)),
            { header: "جزئیات", render: (r: EmpRow) => <button type="button" className="link-btn" onClick={() => setDetail({ title: `${r.employeeName} — ماه ${filter.month}`, values: r.values })}>جزئیات</button>, width: "80px" },
          ] as any}
          rows={(data?.employees ?? []).map((e) => ({ ...e, id: e.employeeId }))}
        />
      ) : (
        <DataTable<DayRow & { id: string }>
          columns={[
            { header: "کد پرسنلی", ...s<DayRow>((r) => toFaDigits(r.personnelCode)), width: "100px" },
            { header: "کارمند", ...s<DayRow>((r) => r.employeeName) },
            { header: "تاریخ", ...s<DayRow>((r) => formatJalaliDate(r.date)), width: "100px" },
            { header: "شیفت", ...s<DayRow>((r) => r.shiftTitle), width: "140px" },
            { header: "وضعیت", ...s<DayRow>((r) => (r.incomplete ? "ناقص" : "")), width: "80px" },
            ...dayFactors.map((f) => factorCol<DayRow>(f)),
            { header: "جزئیات", render: (r: DayRow) => <button type="button" className="link-btn" onClick={() => setDetail({ title: `${r.employeeName} — ${formatJalaliDate(r.date)}`, vars: r.vars, values: r.values })}>جزئیات</button>, width: "80px" },
          ] as any}
          rows={(data?.days ?? []).map((d) => ({ ...d, id: `${d.employeeId}|${d.date}` }))}
        />
      )}

      {detail && (
        <Modal title={`جزئیات محاسبه — ${detail.title}`} onClose={() => setDetail(null)} wide>
          {detail.vars && (
            <>
              <h4 style={{ margin: "4px 0" }}>متغیرهای روز</h4>
              <table className="hr-table" style={{ marginBottom: 12 }}>
                <tbody>
                  {Object.entries(detail.vars).map(([k, v]) => (
                    <tr key={k}><td>{VAR_FA[k] ?? data?.bands?.find((b) => b.key === k)?.title ?? k}</td><td dir="ltr" style={{ textAlign: "left" }}>{TIME_VARS.has(k) || /^(TB|LV)\d+$/.test(k) ? toFaDigits(minutesToMask(v)) : toFaDigits(String(v))}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          <h4 style={{ margin: "4px 0" }}>عوامل</h4>
          <table className="hr-table">
            <thead><tr><th>عامل</th><th style={{ width: 110 }}>مقدار</th><th>نحوه‌ی محاسبه</th></tr></thead>
            <tbody>
              {Object.entries(detail.values).map(([k, v]) => {
                const f = titleOf(k);
                return (
                  <tr key={k}>
                    <td>{f?.title ?? k}</td>
                    <td dir="ltr" style={{ textAlign: "left", color: v.value === null ? "#c0392b" : undefined }}>{f ? fmt(v, f.valueType) : v.value}</td>
                    <td style={{ fontSize: 12 }}>{v.error ? <span style={{ color: "#c0392b" }}>{v.error}</span> : <>{v.branch ? `شاخه‌ی ${toFaDigits(String(v.branch))}: ` : ""}<span dir="ltr">{toFaDigits(v.expression ?? "")}</span></>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Modal>
      )}
    </div>
  );
}
