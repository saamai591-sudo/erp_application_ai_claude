import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { RefreshButton } from "../components/RefreshButton";
import { InfoHint } from "../components/InfoHint";
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { api, ApiError } from "../lib/api";
import { usePermissions } from "../lib/usePermissions";
import { useTabs } from "../lib/TabsContext";
import { usePersistedState, hasPersistedState } from "../lib/usePersistedState";

// مدیریت تردد › عملیات › «کارکنان»: فهرست کارمندان با شیفتِ فعلی؛ با باز کردن هر کارمند «پرونده‌ی تردد» او می‌آید با بخش‌های «شیفت»، «مجوزها» و «محاسبات تردد».
// پرونده فقط خلاصه‌ی خواندنی است و لینک می‌دهد: ثبت/ویرایش در فرم‌های مستقلِ خودشان (انتساب شیفت، مجوزها، محاسبه تردد) با کارمندِ از‌پیش‌انتخاب‌شده انجام می‌شود.

interface ListRow {
  id: number;
  employeeId: number;
  personnelCode: string;
  fullName: string;
  statusTitle: string;
  currentShift: string;
  shiftFrom: string | null;
}
interface Asg {
  id: number;
  shiftTitle: string;
  cycleType: string;
  fromDate: string;
  note: string;
}
interface File {
  employeeId: number;
  personnelCode: string;
  fullName: string;
  shift: { current: Asg | null; upcoming: Asg[]; history: Asg[] };
  permits: {
    currentMonth: string;
    monthly: { factorId: number; title: string; valueText: string; sinceText: string; value: number | null }[];
    daily: { factorId: number; title: string; rows: { id: number; date: string; valueText: string }[] }[];
  };
  calculations: { id: number; monthText: string; calculatedAt: string; days: number; incompleteDays: number; hasErrors: boolean }[];
}

export default function AttendanceEmployees() {
  const location = useLocation();
  const { id } = useParams();
  if (location.pathname.endsWith("/edit")) return <EmployeeFile employeeId={Number(id)} />;
  return <EmployeeList />;
}

function EmployeeList() {
  const cacheKey = "/attendance-employees";
  const [items, setItems] = usePersistedState<ListRow[]>(cacheKey, []);
  const [error, setError] = useState<string | null>(null);
  async function reload() {
    api.get("/attendance-employees").then((r) => { setItems(r); setError(null); }).catch((e) => setError(e.message));
  }
  useEffect(() => {
    if (!hasPersistedState(cacheKey)) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const s = (f: (r: ListRow) => string, extra: object = {}) => ({ render: (r: ListRow) => f(r), filterType: "string" as const, filterValue: (r: ListRow) => f(r), ...extra });
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint title="کارکنان" text="فهرست کارمندان با وضعیت همکاری و شیفتِ فعلی. با باز کردن هر کارمند، پرونده‌ی تردد او (شیفت، مجوزها، محاسبات تردد) نمایش داده می‌شود؛ ثبت و ویرایش در فرم‌های «انتساب شیفت»، «مجوزها» و «محاسبه تردد» انجام می‌شود." />
          <RefreshButton onClick={reload} />
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable
        columns={[
          { header: "کد پرسنلی", ...s((r) => toFaDigits(r.personnelCode)), width: "120px" },
          { header: "کارمند", ...s((r) => r.fullName) },
          { header: "وضعیت همکاری", ...s((r) => r.statusTitle), width: "150px" },
          { header: "شیفت فعلی", ...s((r) => r.currentShift || "—"), width: "180px" },
          { header: "از تاریخ", ...s((r) => (r.shiftFrom ? toFaDigits(formatJalaliDate(r.shiftFrom)) : "")), width: "120px" },
        ]}
        rows={items}
        edit={{ path: (r: ListRow) => `/attendance-employees/${r.employeeId}/edit` }}
      />
    </div>
  );
}

function Section({ title, hint, actions, children }: { title: string; hint?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: 12, marginBottom: 12, maxWidth: 900 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <h3 style={{ margin: 0, flex: 1 }}>{title}</h3>
        {hint && <InfoHint text={hint} title={title} />}
        {actions}
      </div>
      {children}
    </div>
  );
}

function EmployeeFile({ employeeId }: { employeeId: number }) {
  const { openTab } = useTabs();
  const { hasPermission } = usePermissions();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function load() {
    try {
      setFile(await api.get(`/attendance-employees/${employeeId}`));
      setError(null);
    } catch (e) {
      setError((e as ApiError).message);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const A = "attendance.operations.attendance-shift-assignments";
  const P = "attendance.operations.attendance-permits";
  const link = (label: string, path: string, key: string) => hasPermission(key) && <button type="button" className="btn secondary" onClick={() => openTab(path)}>{label}</button>;

  if (!file) return <div><ErrorToast message={error} /></div>;
  const asg = (a: Asg) => `${a.shiftTitle} (${a.cycleType}) — از ${toFaDigits(formatJalaliDate(a.fromDate))}${a.note ? ` — ${a.note}` : ""}`;
  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 8 }}>
          <h2 style={{ margin: 0 }}>پرونده‌ی تردد — {toFaDigits(file.personnelCode)} {file.fullName}</h2>
          <RefreshButton onClick={load} />
        </div>
      </div>
      <ErrorToast message={error} />

      <Section
        title="شیفت"
        hint="شیفتِ مؤثر هر کارمند آخرین انتسابی است که تاریخ شروعش گذشته باشد؛ هر انتساب تا شروع انتساب بعدی ادامه دارد. ثبت و ویرایش در فرم «انتساب شیفت»."
        actions={<>{link("سوابق انتساب", `/attendance-shift-assignments?employeeId=${file.employeeId}`, `${A}.view`)}{link("انتساب جدید", `/attendance-shift-assignments/new?employeeId=${file.employeeId}`, `${A}.create`)}</>}
      >
        {file.shift.current ? <p style={{ margin: "0 0 6px" }}>شیفت فعلی: <b>{asg(file.shift.current)}</b></p> : <p style={{ margin: "0 0 6px", color: "#b45309" }}>شیفتی برای این کارمند تخصیص نیافته است.</p>}
        {file.shift.upcoming.length > 0 && <p style={{ margin: "0 0 6px" }}>انتساب‌های آینده: {file.shift.upcoming.map(asg).join("، ")}</p>}
        {file.shift.history.length > 0 && (
          <table className="hr-table" style={{ maxWidth: 700 }}>
            <thead><tr><th>شیفت‌های قبلی</th><th style={{ width: 130 }}>از تاریخ</th></tr></thead>
            <tbody>{file.shift.history.map((a) => <tr key={a.id}><td>{a.shiftTitle} ({a.cycleType})</td><td>{toFaDigits(formatJalaliDate(a.fromDate))}</td></tr>)}</tbody>
          </table>
        )}
      </Section>

      <Section
        title="مجوزها"
        hint="مقدار عامل‌های مجوز: عامل ماهانه از یک ماه تا مقدار بعدی ادامه دارد (اینجا مقدارِ مؤثر ماه جاری نمایش داده می‌شود) و عامل روزانه برای یک تاریخ است. ثبت‌نشده = ۰. ثبت و ویرایش در فرم «مجوزها»."
        actions={<>{link("مشاهده سوابق", `/attendance-permits?employeeId=${file.employeeId}`, `${P}.view`)}{link("مجوز جدید", `/attendance-permits/new?employeeId=${file.employeeId}`, `${P}.create`)}</>}
      >
        {file.permits.monthly.length === 0 && file.permits.daily.length === 0 && <p style={{ margin: 0, opacity: 0.7 }}>هنوز عامل مجوزی تعریف نشده است (در «عوامل تردد» با منبع «مجوز»).</p>}
        {file.permits.monthly.length > 0 && (
          <table className="hr-table" style={{ maxWidth: 700, marginBottom: 8 }}>
            <thead><tr><th>عامل مجوز ماهانه</th><th style={{ width: 150 }}>مقدارِ {toFaDigits(file.permits.currentMonth)}</th><th style={{ width: 150 }}>از ماه</th></tr></thead>
            <tbody>{file.permits.monthly.map((m) => <tr key={m.factorId}><td>{m.title}</td><td style={m.value === null ? { opacity: 0.6 } : undefined}>{toFaDigits(m.valueText)}</td><td>{m.sinceText ? toFaDigits(m.sinceText) : "—"}</td></tr>)}</tbody>
          </table>
        )}
        {file.permits.daily.map((d) => (
          <table key={d.factorId} className="hr-table" style={{ maxWidth: 700, marginBottom: 8 }}>
            <thead><tr><th>{d.title} (روزانه — آخرین مقدارها)</th><th style={{ width: 150 }}>تاریخ</th></tr></thead>
            <tbody>
              {d.rows.length === 0 && <tr><td colSpan={2} style={{ opacity: 0.6 }}>مقداری ثبت نشده است</td></tr>}
              {d.rows.map((r) => <tr key={r.id}><td>{toFaDigits(r.valueText)}</td><td>{toFaDigits(formatJalaliDate(r.date))}</td></tr>)}
            </tbody>
          </table>
        ))}
      </Section>

      <Section
        title="محاسبات تردد"
        hint="ماه‌هایی که برای این کارمند «محاسبه تردد» شده است؛ اطلاعات تردد او در بازه‌ی تردد این ماه‌ها قفل است. برای محاسبه یا حذف محاسبه به فرم «محاسبه تردد» بروید."
        actions={link("محاسبه تردد", "/attendance-calculation", "attendance.operations.attendance-calculation.view")}
      >
        {file.calculations.length === 0 ? (
          <p style={{ margin: 0, opacity: 0.7 }}>هنوز ماهی برای این کارمند محاسبه نشده است.</p>
        ) : (
          <table className="hr-table" style={{ maxWidth: 700 }}>
            <thead><tr><th>ماه</th><th style={{ width: 110 }}>روز محاسبه‌شده</th><th style={{ width: 90 }}>روز ناقص</th><th style={{ width: 90 }}>وضعیت</th></tr></thead>
            <tbody>{file.calculations.map((c) => <tr key={c.id}><td>{toFaDigits(c.monthText)}</td><td>{toFaDigits(String(c.days))}</td><td>{toFaDigits(String(c.incompleteDays))}</td><td>{c.hasErrors ? <span style={{ color: "#b45309" }}>با خطا</span> : "سالم"}</td></tr>)}</tbody>
          </table>
        )}
      </Section>
    </div>
  );
}
