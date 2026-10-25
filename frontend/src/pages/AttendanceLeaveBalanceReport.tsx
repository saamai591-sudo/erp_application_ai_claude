import { useEffect, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { DataTable } from "../components/DataTable";
import { RefreshButton } from "../components/RefreshButton";
import { InfoHint } from "../components/InfoHint";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate, localTodayIso } from "../lib/formatDate";
import { api } from "../lib/api";
import { usePersistedState } from "../lib/usePersistedState";

// مدیریت تردد › گزارش › «مانده‌ی مرخصی کارمندان»: به‌ازای هر کارمندِ در دوره‌ی همکاری در «تاریخ گزارش» و هر نوع مرخصیِ دارای مانده، مانده‌ی دستی، استحقاق، مصرف و مانده تا پایان همان روز.
// مشتق و ذخیره‌نشده؛ همان محاسبه‌ی «گردش مانده» (services/attendanceLeaveBalanceService.ts). مصرف شامل درخواست‌های ثبت‌شده و تاییدشده است.

interface Row {
  id: string;
  employeeId: number;
  personnelCode: string;
  employeeName: string;
  leaveTypeId: number;
  leaveTypeTitle: string;
  unit: "DAY" | "BOTH";
  manual: number;
  accrual: number;
  consumed: number;
  balance: number;
  manualText: string;
  accrualText: string;
  consumedText: string;
  balanceText: string;
}
interface TypeOpt {
  id: number;
  title: string;
  deductsBalance: boolean;
}

export default function AttendanceLeaveBalanceReport() {
  const [filter, setFilter] = usePersistedState("form:/attendance-leave-balance-report:filter", { date: localTodayIso(), leaveTypeId: "", onlyNegative: false });
  const [rows, setRows] = usePersistedState<Row[]>("form:/attendance-leave-balance-report:rows", []);
  const [asOf, setAsOf] = usePersistedState<string>("form:/attendance-leave-balance-report:asof", "");
  const [types, setTypes] = useState<TypeOpt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/attendance-leave-types").then((r: TypeOpt[]) => setTypes(r.filter((t) => t.deductsBalance))).catch(() => {});
  }, []);

  async function load() {
    if (!filter.date) return setError("تاریخ گزارش را وارد کنید");
    setLoading(true);
    setError(null);
    try {
      const r = await api.get(`/attendance-leave-balance-report?date=${filter.date}${filter.leaveTypeId ? `&leaveTypeId=${filter.leaveTypeId}` : ""}`);
      setRows(r.rows);
      setAsOf(r.asOf);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const shown = filter.onlyNegative ? rows.filter((r) => r.balance < 0) : rows;
  const s = (f: (r: Row) => string, extra: object = {}) => ({ render: (r: Row) => f(r), filterType: "string" as const, filterValue: (r: Row) => f(r), ...extra });
  const n = (f: (r: Row) => string, v: (r: Row) => number, extra: object = {}) => ({ render: (r: Row) => <span dir="ltr" style={{ color: v(r) < 0 ? "var(--danger, #c0392b)" : undefined }}>{toFaDigits(f(r))}</span>, filterType: "number" as const, filterValue: (r: Row) => String(v(r)), exportValue: (r: Row) => v(r), ...extra });

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 8, flexWrap: "wrap" }}>
          <InfoHint title="مانده‌ی مرخصی کارمندان" text="برای هر کارمندِ در دوره‌ی همکاری در تاریخ گزارش و هر نوع مرخصیِ دارای مانده، مانده‌ی دستی + استحقاق − مصرف (درخواست‌های ثبت‌شده و تاییدشده) تا پایان همان روز نشان داده می‌شود. فقط کارمندانی که برای آن نوع مانده‌ی دستی، درخواست یا شیفتِ دارای قاعده‌ی استحقاق دارند می‌آیند. نوع «روزانه» به روز و نوع «روزانه و ساعتی» به ساعت:دقیقه است. استحقاقِ وابسته به کارکردِ واقعی تا پایان ماه کامل می‌شود." />
          <label>تاریخ گزارش</label>
          <JalaliDatePicker value={filter.date} onChange={(v) => setFilter({ ...filter, date: v })} />
          <label>نوع مرخصی</label>
          <select value={filter.leaveTypeId} onChange={(e) => setFilter({ ...filter, leaveTypeId: e.target.value })}>
            <option value="">همه</option>
            {types.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
          <label className="checkbox-row"><input type="checkbox" checked={filter.onlyNegative} onChange={(e) => setFilter({ ...filter, onlyNegative: e.target.checked })} /> فقط مانده‌ی منفی</label>
          <button type="button" className="btn" onClick={load} disabled={loading}>{loading ? "در حال محاسبه…" : "نمایش"}</button>
          <RefreshButton onClick={load} />
          {asOf && <span style={{ opacity: 0.7, fontSize: 12 }}>مانده تا پایان {formatJalaliDate(asOf)}</span>}
        </div>
      </div>
      <ErrorToast message={error} />
      <DataTable<Row>
        columns={[
          { header: "کد پرسنلی", ...s((r) => toFaDigits(r.personnelCode)), width: "110px" },
          { header: "کارمند", ...s((r) => r.employeeName) },
          { header: "نوع مرخصی", ...s((r) => r.leaveTypeTitle), width: "150px" },
          { header: "مانده‌ی دستی", ...n((r) => r.manualText, (r) => r.manual), width: "120px" },
          { header: "استحقاق", ...n((r) => r.accrualText, (r) => r.accrual), width: "120px" },
          { header: "مصرف", ...n((r) => r.consumedText, (r) => r.consumed), width: "120px" },
          { header: "مانده", ...n((r) => r.balanceText, (r) => r.balance), width: "130px" },
        ]}
        rows={shown}
        emptyText={asOf ? "ردیفی یافت نشد" : "تاریخ گزارش را انتخاب و «نمایش» را بزنید"}
      />
    </div>
  );
}
