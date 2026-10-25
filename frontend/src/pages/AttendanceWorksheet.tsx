import { useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { RefreshButton } from "../components/RefreshButton";
import { InfoHint } from "../components/InfoHint";
import { AttendanceMonthField, AttendanceMonth, EMPTY_MONTH } from "../components/AttendanceMonthField";
import { PunchGrid, WorksheetGrid, WorksheetData } from "../components/AttendanceWorksheetTables";
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { api } from "../lib/api";
import { usePersistedState } from "../lib/usePersistedState";

// مدیریت تردد › گزارش › «کارکرد روزانه»: اطلاعات خودِ کاربرِ واردشده (کارمندِ هم‌شخص با کاربر). سه تب: «کارکرد» (هر روز یک ردیف، همه‌ی روزها)، «ریز ورود و خروج»
// (تک‌تک ترددها با جهتِ مشتق) و «نیازمند رسیدگی» (ترددِ بی‌پنجره و پنجره‌های ناقص). مشتق است و ذخیره نمی‌شود؛ قواعد در سرور
// (services/attendanceWorksheetService.ts و attendanceWorksheetReportService.ts). دو تب اول با «مرور کارکرد» مشترک‌اند (components/AttendanceWorksheetTables.tsx).

interface RRow {
  id: string;
  kind: "UNASSIGNED" | "INCOMPLETE";
  personnelCode: string;
  date: string;
  time: string;
  reason: string;
  punchId?: number;
}

export default function AttendanceWorksheet() {
  const key = "/attendance-worksheet";
  const [month, setMonth] = usePersistedState<AttendanceMonth>(`${key}:month`, EMPTY_MONTH);
  const [tab, setTab] = usePersistedState(`${key}:tab`, "rows");
  const [data, setData] = usePersistedState<WorksheetData | null>(key, null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!month.year) return;
    setLoading(true);
    try {
      setData(await api.get(`/attendance-worksheet?from=${month.from}&to=${month.to}`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  // با عوض‌شدن (یا پیش‌فرض‌شدنِ) ماه، گزارش همان ماه بارگذاری می‌شود
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month.year, month.month]);

  const sum = data?.summary;
  const rr = (f: (r: RRow) => string, extra: object = {}) => ({ render: (r: RRow) => f(r), filterType: "string" as const, filterValue: (r: RRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="کارکرد روزانه" text="کارکرد خودِ شما در ماه انتخابی (بازه‌ی تردد همان ماه در تقویم کاری؛ پیش‌فرض ماه جاری). ترددها بر اساس شیفتِ منتسب و پنجره‌های حضور به ردیف‌های شیفت می‌خورند و داخل هر پنجره به ترتیب جفت می‌شوند (۱ با ۲، ۳ با ۴ …). تعداد فرد = «ناقص» و نیازمند رسیدگی. ستون‌های عوامل، همان عامل‌های تردد هستند که «نمایش در گزارش کارکرد» دارند. این گزارش مشتق است و ذخیره نمی‌شود." />
          <RefreshButton onClick={load} />
        </div>
      </div>
      <ErrorToast message={error} />
      <div className="card ar-filters">
        <AttendanceMonthField value={month} onChange={setMonth} />
      </div>
      {data && data.linked === false && <div className="alert" style={{ marginBottom: 8 }}>کاربر شما به هیچ کارمندی متصل نیست؛ برای دیدن کارکرد، در «کاربر» شخصِ کارمند را انتخاب کنید.</div>}
      {sum && data?.linked !== false && (
        <p style={{ margin: "0 0 8px", fontSize: 13, opacity: 0.85 }}>
          {toFaDigits(String(sum.days))} روز — روز ناقص: <b>{toFaDigits(String(sum.incompleteDays))}</b> — ترددِ بی‌پنجره: <b>{toFaDigits(String(sum.unassigned))}</b>
        </p>
      )}
      <div style={{ display: "flex", gap: 6, margin: "6px 0" }}>
        <button type="button" className={tab === "rows" ? "btn" : "btn secondary"} onClick={() => setTab("rows")}>کارکرد</button>
        <button type="button" className={tab === "punches" ? "btn" : "btn secondary"} onClick={() => setTab("punches")}>ریز ورود و خروج</button>
        <button type="button" className={tab === "review" ? "btn" : "btn secondary"} onClick={() => setTab("review")}>نیازمند رسیدگی{sum ? ` (${toFaDigits(String(sum.incompleteDays + sum.unassigned))})` : ""}</button>
      </div>
      {tab === "rows" ? (
        <WorksheetGrid data={data} />
      ) : tab === "punches" ? (
        <PunchGrid data={data} />
      ) : (
        <DataTable
          columns={[
            { header: "نوع", ...rr((r) => (r.kind === "UNASSIGNED" ? "تردد بی‌پنجره" : "پنجره‌ی ناقص")), width: "120px" },
            { header: "تاریخ", ...rr((r) => formatJalaliDate(r.date)), width: "100px" },
            { header: "ساعت", ...rr((r) => toFaDigits(r.time)), width: "200px" },
            { header: "علت", ...rr((r) => r.reason) },
          ]}
          rows={(data?.review ?? []) as RRow[]}
          edit={{ path: (r: RRow) => (r.kind === "UNASSIGNED" && r.punchId ? `/attendance-punches/${r.punchId}/edit` : "/attendance-punches") }}
        />
      )}
    </div>
  );
}
