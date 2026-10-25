import { useEffect, useMemo, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { AttendanceMonthField, AttendanceMonth, EMPTY_MONTH } from "../components/AttendanceMonthField";
import { ChainedTabsBar } from "../components/ChainedTabsBar";
import { SelectableBalanceTable, BalanceTableColumn } from "../components/SelectableBalanceTable";
import { RefreshButton } from "../components/RefreshButton";
import { InfoHint } from "../components/InfoHint";
import { PunchGrid, WorksheetGrid, WorksheetData } from "../components/AttendanceWorksheetTables";
import { useChainedMultiSelect, SelectId } from "../lib/useChainedMultiSelect";
import { useReviewTabViewState } from "../lib/useReviewTabLoader";
import { getAttendanceReviewSnapshot, setAttendanceReviewSnapshot } from "../lib/attendanceReviewCache";
import { toFaDigits } from "../lib/formatAmount";
import { api } from "../lib/api";

// گزارش «مرور کارکرد» (مدیریت تردد › گزارش) — هم‌الگوی بقیه‌ی مرورها: تب «کارمندان» (انتخاب یک یا چند ردیف) ← تب «کارکرد» و تب «ریز ورود و خروج» برای
// کارمندانِ انتخاب‌شده (بدون انتخاب = همه‌ی کارمندان). دو تب آخر دقیقاً همان تب‌های گزارش «کارکرد روزانه»‌اند (components/AttendanceWorksheetTables.tsx) با ستون
// «کارمند». داده مشتق است و ذخیره نمی‌شود (services/attendanceWorksheetReportService.ts).

interface EmpRow {
  id: SelectId;
  code: string;
  name: string;
  shiftTitle: string;
}

const EMP_TAB = 0;
const TAB_LABELS = ["کارمندان", "کارکرد", "ریز ورود و خروج"];
const INFO_TEXT =
  "در تب «کارمندان» یک یا چند کارمند را انتخاب کنید و سپس تب «کارکرد» یا «ریز ورود و خروج» را بزنید تا فقط برای همان‌ها نمایش داده شود؛ بدون انتخاب، همه‌ی کارمندان نمایش داده می‌شوند. " +
  "بازه‌ی گزارش = بازه‌ی تردد ماه انتخابی (پیش‌فرض ماه جاری). ستون‌های عوامل، عامل‌های تردد روزانه‌ای هستند که «نمایش در گزارش کارکرد» دارند.";

export default function AttendanceReview() {
  const snapshot = getAttendanceReviewSnapshot();
  const [filters, setFilters] = useState<AttendanceMonth>(snapshot?.filters ?? EMPTY_MONTH);
  const [activeTab, setActiveTab] = useState(snapshot?.activeTab ?? 0);
  const [employees, setEmployees] = useState<EmpRow[] | null>(snapshot?.employees ?? null);
  const [data, setData] = useState<WorksheetData | null>(snapshot?.data ?? null);
  const [loadedKey, setLoadedKey] = useState(snapshot?.loadedKey ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chain = useChainedMultiSelect(snapshot?.chainState);
  const tabView = useReviewTabViewState(activeTab, snapshot?.tabViewState ?? {});

  useEffect(() => {
    setAttendanceReviewSnapshot({ chainState: { selections: chain.selections, order: chain.order }, activeTab, filters, employees, data, loadedKey, tabViewState: tabView.viewState });
  }, [chain.selections, chain.order, activeTab, filters, employees, data, loadedKey, tabView.viewState]);

  async function loadEmployees() {
    setLoading(true);
    try {
      const rows: { id: number; code: string; name: string; shiftTitle: string }[] = await api.get("/attendance-review/employees");
      setEmployees(rows);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (!employees) loadEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedIds = useMemo(() => Array.from(chain.get(EMP_TAB)).map(Number).sort((a, b) => a - b), [chain.selections]);
  const key = `${filters.from}|${filters.to}|${selectedIds.join(",")}`;

  async function loadWorksheet() {
    setLoading(true);
    try {
      const q = new URLSearchParams({ from: filters.from, to: filters.to });
      // بدون انتخاب = همه‌ی کارمندانِ فهرست
      const ids = selectedIds.length ? selectedIds : (employees ?? []).map((e) => Number(e.id));
      q.set("employeeIds", ids.join(","));
      setData(await api.get(`/attendance-review/worksheet?${q.toString()}`));
      setLoadedKey(key);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (activeTab !== EMP_TAB && employees && filters.year && key !== loadedKey) loadWorksheet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, key, employees, filters.year]);

  const empColumns = useMemo(
    (): BalanceTableColumn<EmpRow>[] => [
      { header: "کد پرسنلی", render: (r) => toFaDigits(r.code), sortValue: (r) => r.code, width: "120px", filterType: "string", filterValue: (r) => r.code },
      { header: "کارمند", render: (r) => r.name, sortValue: (r) => r.name, filterType: "string", filterValue: (r) => r.name },
      { header: "شیفت جاری", render: (r) => r.shiftTitle, sortValue: (r) => r.shiftTitle, filterType: "string", filterValue: (r) => r.shiftTitle },
    ],
    []
  );

  function clearFilters() {
    chain.reset();
    tabView.reset();
    setData(null);
    setLoadedKey("");
    setActiveTab(0);
  }

  const tabDefs = TAB_LABELS.map((label, idx) => ({ key: `att-${idx}`, label, count: idx === EMP_TAB ? chain.get(EMP_TAB).size : 0 }));
  const refresh = () => (activeTab === EMP_TAB ? loadEmployees() : loadWorksheet());

  return (
    <div>
      <ErrorToast message={error} />
      <div className="card ar-filters">
        <AttendanceMonthField value={filters} onChange={(v) => (v.year !== filters.year || v.month !== filters.month || v.start !== filters.start) && setFilters(v)} />
      </div>

      <ChainedTabsBar
        tabs={tabDefs}
        activeIndex={activeTab}
        onChange={setActiveTab}
        actions={
          <>
            <InfoHint text={INFO_TEXT} title="مرور کارکرد" />
            <RefreshButton onClick={refresh} title="رفرش تب جاری" />
          </>
        }
        onClearFilters={clearFilters}
      />

      {activeTab === EMP_TAB && (
        <SelectableBalanceTable
          stateKey={EMP_TAB}
          rows={employees ?? []}
          columns={empColumns}
          selected={chain.get(EMP_TAB)}
          onToggle={(id: SelectId) => chain.toggle(EMP_TAB, id)}
          loading={loading}
          restoreFilters={tabView.restoreFilters}
          restoreSort={tabView.restoreSort}
          onFiltersChange={tabView.onFiltersChange}
          onSortChange={tabView.onSortChange}
        />
      )}
      {activeTab === 1 && <WorksheetGrid data={data} showEmployee />}
      {activeTab === 2 && <PunchGrid data={data} showEmployee />}
    </div>
  );
}
