import { useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { RefreshButton } from "../components/RefreshButton";
import { InfoHint } from "../components/InfoHint";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate, localTodayIso } from "../lib/formatDate";
import { minutesToMask } from "../components/TimeInput";
import { api } from "../lib/api";
import { usePersistedState } from "../lib/usePersistedState";
import { EmployeePickerField, addDaysIso, useEmployeeOptions } from "./AttendancePunches";

// مدیریت تردد › گزارش › «کارکرد روزانه»: برای هر کارمند و روز، ردیف‌های شیفتِ منتسب (هر بازه‌ی کاری؛ روز استراحت = یک ردیف) با ترددهای داخل پنجره‌ی حضور، جفت‌سازی ترتیبی و
// متغیرهای حضور/تاخیر/تعجیل/اضافه‌کار. مشتق است و ذخیره نمی‌شود. تب دوم «نیازمند رسیدگی»: ترددِ بی‌پنجره و پنجره‌های با تعداد فرد. قواعد در سرور (services/attendanceWorksheetService.ts).

interface WRow {
  id: string;
  employeeId: number;
  personnelCode: string;
  employeeName: string;
  workDate: string;
  rowNo: number;
  rest: boolean;
  shiftTitle: string;
  segStartClock: number | null;
  segEndClock: number | null;
  segEndsNextDay: boolean;
  windowStart: { date: string; clock: number };
  windowEnd: { date: string; clock: number };
  punches: { id: number; time: string; manual: boolean }[];
  firstIn: string | null;
  lastOut: string | null;
  presenceMinutes: number | null;
  lateMinutes: number | null;
  earlyLeaveMinutes: number | null;
  overtimeBeforeMinutes: number | null;
  overtimeAfterMinutes: number | null;
  status: string;
  statusTitle: string;
}
interface RRow {
  id: string;
  kind: "UNASSIGNED" | "INCOMPLETE";
  employeeId: number;
  personnelCode: string;
  employeeName: string;
  date: string;
  time: string;
  reason: string;
  punchId?: number;
  rowNo?: number;
}
interface Result {
  rows: WRow[];
  review: RRow[];
  summary: { employees: number; rows: number; incomplete: number; noPunch: number; unassigned: number };
}

const dur = (m: number | null) => (m === null ? "" : toFaDigits(minutesToMask(m)));
const hm = (m: number) => toFaDigits(minutesToMask(m));

export default function AttendanceWorksheet() {
  const key = "/attendance-worksheet";
  const [filter, setFilter] = usePersistedState(`${key}:filter`, { from: addDaysIso(localTodayIso(), -6), to: localTodayIso(), employeeId: "", includeRest: false });
  const [tab, setTab] = usePersistedState(`${key}:tab`, "rows");
  const [data, setData] = usePersistedState<Result | null>(key, null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const employees = useEmployeeOptions();

  async function load() {
    setLoading(true);
    try {
      const q = new URLSearchParams({ from: filter.from, to: filter.to });
      if (filter.employeeId) q.set("employeeId", filter.employeeId);
      if (filter.includeRest) q.set("includeRest", "true");
      setData(await api.get(`/attendance-worksheet?${q.toString()}`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (!data) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const s = (f: (r: WRow) => string, extra: object = {}) => ({ render: (r: WRow) => f(r), filterType: "string" as const, filterValue: (r: WRow) => f(r), ...extra });
  const rr = (f: (r: RRow) => string, extra: object = {}) => ({ render: (r: RRow) => f(r), filterType: "string" as const, filterValue: (r: RRow) => f(r), ...extra });
  const sum = data?.summary;
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="کارکرد روزانه" text="ترددهای هر کارمند بر اساس شیفتِ منتسب و پنجره‌های حضور به ردیف‌های شیفت می‌خورند و داخل هر پنجره به ترتیب جفت می‌شوند (۱ با ۲، ۳ با ۴ …). تعداد فرد = «ناقص» و نیازمند رسیدگی؛ بدون تردد = «بدون تردد» (غیبت یا مرخصی/ماموریت بعداً با درخواست‌ها تعیین می‌شود). این گزارش مشتق است و ذخیره نمی‌شود." />
          <RefreshButton onClick={load} />
        </div>
      </div>
      <ErrorToast message={error} />
      <div className="form-grid" style={{ marginBottom: 8, alignItems: "end" }}>
        <div className="form-field"><label>از تاریخ</label><JalaliDatePicker value={filter.from} onChange={(v) => setFilter({ ...filter, from: v })} /></div>
        <div className="form-field"><label>تا تاریخ</label><JalaliDatePicker value={filter.to} onChange={(v) => setFilter({ ...filter, to: v })} /></div>
        <div className="form-field">
          <label>کارمند</label>
          <div style={{ display: "flex", gap: 4 }}>
            <EmployeePickerField employees={employees} value={filter.employeeId} onSelect={(e) => setFilter({ ...filter, employeeId: String(e.id) })} />
            {filter.employeeId && <button type="button" className="btn-link" onClick={() => setFilter({ ...filter, employeeId: "" })}>همه</button>}
          </div>
        </div>
        <div className="form-field"><label className="checkbox-row"><input type="checkbox" checked={filter.includeRest} onChange={(e) => setFilter({ ...filter, includeRest: e.target.checked })} /> نمایش روزهای استراحت بدون تردد</label></div>
        <div className="form-field"><button type="button" className="btn" disabled={loading} onClick={load}>نمایش</button></div>
      </div>
      {sum && (
        <p style={{ margin: "0 0 8px", fontSize: 13, opacity: 0.85 }}>
          {toFaDigits(String(sum.employees))} کارمند — {toFaDigits(String(sum.rows))} ردیف — ناقص: <b>{toFaDigits(String(sum.incomplete))}</b> — بدون تردد: {toFaDigits(String(sum.noPunch))} — ترددِ بی‌پنجره: <b>{toFaDigits(String(sum.unassigned))}</b>
        </p>
      )}
      <div style={{ display: "flex", gap: 6, margin: "6px 0" }}>
        <button type="button" className={tab === "rows" ? "btn" : "btn secondary"} onClick={() => setTab("rows")}>کارکرد روزانه</button>
        <button type="button" className={tab === "review" ? "btn" : "btn secondary"} onClick={() => setTab("review")}>نیازمند رسیدگی{sum ? ` (${toFaDigits(String(sum.incomplete + sum.unassigned))})` : ""}</button>
      </div>
      {tab === "rows" ? (
        <DataTable
          columns={[
            { header: "کد پرسنلی", ...s((r) => toFaDigits(r.personnelCode)), width: "100px" },
            { header: "کارمند", ...s((r) => r.employeeName) },
            { header: "تاریخ", ...s((r) => formatJalaliDate(r.workDate)), width: "100px" },
            { header: "ردیف شیفت", ...s((r) => (r.rest ? "روز استراحت" : `${hm(r.segStartClock as number)} تا ${hm(r.segEndClock as number)}${r.segEndsNextDay ? " (روز بعد)" : ""}`)), width: "170px" },
            { header: "پنجره‌ی حضور", ...s((r) => `${hm(r.windowStart.clock)}${r.windowStart.date < r.workDate ? " (روز قبل)" : ""} تا ${hm(r.windowEnd.clock)}${r.windowEnd.date > r.workDate ? " (روز بعد)" : ""}`), width: "190px" },
            { header: "ترددها", ...s((r) => r.punches.map((p) => toFaDigits(p.time) + (p.manual ? "*" : "")).join("  ")), width: "220px" },
            { header: "اولین ورود", ...s((r) => (r.firstIn ? toFaDigits(r.firstIn) : "")), width: "100px" },
            { header: "آخرین خروج", ...s((r) => (r.lastOut ? toFaDigits(r.lastOut) : "")), width: "100px" },
            { header: "حضور", ...s((r) => dur(r.presenceMinutes)), width: "80px" },
            { header: "تاخیر", ...s((r) => dur(r.lateMinutes)), width: "80px" },
            { header: "تعجیل", ...s((r) => dur(r.earlyLeaveMinutes)), width: "80px" },
            { header: "اضافه‌کار قبل", ...s((r) => dur(r.overtimeBeforeMinutes)), width: "100px" },
            { header: "اضافه‌کار بعد", ...s((r) => dur(r.overtimeAfterMinutes)), width: "100px" },
            { header: "وضعیت", ...s((r) => r.statusTitle), width: "150px" },
          ]}
          rows={data?.rows ?? []}
        />
      ) : (
        <DataTable
          columns={[
            { header: "نوع", ...rr((r) => (r.kind === "UNASSIGNED" ? "تردد بی‌پنجره" : "پنجره‌ی ناقص")), width: "120px" },
            { header: "کد پرسنلی", ...rr((r) => toFaDigits(r.personnelCode)), width: "100px" },
            { header: "کارمند", ...rr((r) => r.employeeName) },
            { header: "تاریخ", ...rr((r) => formatJalaliDate(r.date)), width: "100px" },
            { header: "ساعت", ...rr((r) => toFaDigits(r.time)), width: "200px" },
            { header: "علت", ...rr((r) => r.reason) },
          ]}
          rows={data?.review ?? []}
          edit={{ path: (r: RRow) => (r.kind === "UNASSIGNED" && r.punchId ? `/attendance-punches/${r.punchId}/edit` : "/attendance-punches") }}
        />
      )}
    </div>
  );
}
