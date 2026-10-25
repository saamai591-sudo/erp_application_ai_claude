import { useEffect, useMemo, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { SelectableBalanceTable, BalanceTableColumn } from "../components/SelectableBalanceTable";
import { AttendanceMonthField, AttendanceMonth, EMPTY_MONTH } from "../components/AttendanceMonthField";
import { RefreshButton } from "../components/RefreshButton";
import { InfoHint } from "../components/InfoHint";
import { toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { api } from "../lib/api";
import { usePersistedState } from "../lib/usePersistedState";

// مدیریت تردد › گزارش › «مانده‌ی مرخصی کارمندان» (هم‌الگوی مرورها: کارت فیلتر بالا + گرید): به‌ازای هر کارمندِ در دوره‌ی همکاری در پایان ماه انتخابی و هر نوع مرخصیِ دارای مانده،
// مانده‌ی دستی، استحقاق، مصرف و مانده تا پایان همان ماه. مشتق و ذخیره‌نشده؛ همان محاسبه‌ی «گردش مانده» (services/attendanceLeaveBalanceService.ts). مصرف شامل درخواست‌های ثبت‌شده و تاییدشده است.

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

const INFO_TEXT =
  "برای هر کارمندِ در دوره‌ی همکاری در پایان ماه انتخابی و هر نوع مرخصیِ دارای مانده، مانده‌ی دستی + استحقاق − مصرف (درخواست‌های ثبت‌شده و تاییدشده) تا پایان همان ماه نشان داده می‌شود. " +
  "فقط کارمندانی می‌آیند که برای آن نوع مانده‌ی دستی، درخواست یا شیفتِ دارای قاعده‌ی استحقاق دارند. نوع «روزانه» به روز و نوع «روزانه و ساعتی» به ساعت:دقیقه است. " +
  "استحقاقِ وابسته به کارکردِ واقعی تا پایان ماه کامل می‌شود؛ برای ماه جاری بر پایه‌ی داده‌ی تا امروز است.";

export default function AttendanceLeaveBalanceReport() {
  const key = "/attendance-leave-balance-report";
  const [month, setMonth] = usePersistedState<AttendanceMonth>(`${key}:month`, EMPTY_MONTH);
  const [leaveTypeId, setLeaveTypeId] = usePersistedState(`${key}:type`, "");
  const [onlyNegative, setOnlyNegative] = usePersistedState(`${key}:neg`, false);
  const [rows, setRows] = usePersistedState<Row[]>(key, []);
  const [asOf, setAsOf] = usePersistedState<string>(`${key}:asof`, "");
  const [types, setTypes] = useState<TypeOpt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/attendance-leave-types").then((r: TypeOpt[]) => setTypes(r.filter((t) => t.deductsBalance))).catch(() => {});
  }, []);

  async function load() {
    if (!month.year) return;
    setLoading(true);
    try {
      const r = await api.get(`/attendance-leave-balance-report?date=${month.endDate}${leaveTypeId ? `&leaveTypeId=${leaveTypeId}` : ""}`);
      setRows(r.rows);
      setAsOf(r.asOf);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  // با عوض‌شدن (یا پیش‌فرض‌شدنِ) ماه یا نوع، گزارش دوباره محاسبه می‌شود
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month.year, month.month, leaveTypeId]);

  const shown = useMemo(() => (onlyNegative ? rows.filter((r) => r.balance < 0) : rows), [rows, onlyNegative]);
  const num = (f: (r: Row) => string, v: (r: Row) => number, header: string, width: string): BalanceTableColumn<Row> => ({
    header,
    width,
    render: (r) => <span dir="ltr" style={{ color: v(r) < 0 ? "var(--danger, #c0392b)" : undefined }}>{toFaDigits(f(r))}</span>,
    sortValue: v,
    filterType: "number",
    filterValue: v,
    exportValue: v,
  });
  const columns = useMemo(
    (): BalanceTableColumn<Row>[] => [
      { header: "کد پرسنلی", width: "110px", render: (r) => toFaDigits(r.personnelCode), sortValue: (r) => r.personnelCode, filterType: "string", filterValue: (r) => r.personnelCode },
      { header: "کارمند", render: (r) => r.employeeName, sortValue: (r) => r.employeeName, filterType: "string", filterValue: (r) => r.employeeName },
      { header: "نوع مرخصی", width: "150px", render: (r) => r.leaveTypeTitle, sortValue: (r) => r.leaveTypeTitle, filterType: "string", filterValue: (r) => r.leaveTypeTitle },
      num((r) => r.manualText, (r) => r.manual, "مانده‌ی دستی", "120px"),
      num((r) => r.accrualText, (r) => r.accrual, "استحقاق", "120px"),
      num((r) => r.consumedText, (r) => r.consumed, "مصرف", "120px"),
      num((r) => r.balanceText, (r) => r.balance, "مانده", "130px"),
    ],
    []
  );

  return (
    <div>
      <ErrorToast message={error} />
      <div className="card ar-filters">
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
          <AttendanceMonthField value={month} onChange={(v) => (v.year !== month.year || v.month !== month.month) && setMonth(v)} />
          <div className="form-field-inline">
            <label>نوع مرخصی</label>
            <select value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)}>
              <option value="">همه</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
          <div className="form-field-inline">
            <label className="checkbox-row"><input type="checkbox" checked={onlyNegative} onChange={(e) => setOnlyNegative(e.target.checked)} /> فقط مانده‌ی منفی</label>
          </div>
          <div className="form-field-inline">
            <InfoHint text={INFO_TEXT} title="مانده‌ی مرخصی کارمندان" />
            <RefreshButton onClick={load} title="رفرش" />
            {asOf && <span style={{ opacity: 0.7, fontSize: 12 }}>مانده تا پایان {formatJalaliDate(asOf)}</span>}
          </div>
        </div>
      </div>
      <SelectableBalanceTable<Row> rows={shown} columns={columns} selectable={false} loading={loading} emptyText="ردیفی یافت نشد" />
    </div>
  );
}
