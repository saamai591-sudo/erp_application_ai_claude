import { useEffect, useMemo, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { ChainedTabsBar } from "../components/ChainedTabsBar";
import { SelectableBalanceTable, BalanceTableColumn } from "../components/SelectableBalanceTable";
import { RefreshButton } from "../components/RefreshButton";
import { InfoHint } from "../components/InfoHint";
import { useChainedMultiSelect, SelectId } from "../lib/useChainedMultiSelect";
import { getCashReviewSnapshot, setCashReviewSnapshot } from "../lib/cashReviewCache";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { resolveReviewDateRange, FiscalPeriodRange } from "../lib/fiscalYearDefaultDate";
import { useReviewTabLoader, useReviewTabActivation, useReviewTabViewState, serializeForDepsKey } from "../lib/useReviewTabLoader";
import { useTabs } from "../lib/TabsContext";
import { api } from "../lib/api";
import { ColumnFilterType, ActiveFilter } from "../components/DataTable";

// گزارش «مرور صندوق» (خزانه‌داری > گزارش) — هم‌الگوی «مرور حساب بانکی» با دو تب: «صندوق» (مانده ابتدا/دریافت/
// پرداخت/مانده به‌ازای هر صندوق) و «گردش» (فهرست تخت گردش‌ها با مانده‌ی جاری، صفحه‌بندی و فیلتر سمت سرور).
// انتخاب چند صندوق در تب «صندوق» تب «گردش» را فیلتر می‌کند. تعریف «گردش صندوق»: backend/src/services/cashReviewService.ts.

interface CashRow {
  id: SelectId;
  cashBoxId: number;
  code: string;
  title: string;
  openingBalance: number;
  inflow: number;
  outflow: number;
  closingBalance: number;
}

interface LedgerRow {
  id: number;
  type: string;
  docTypeCode: string;
  documentId: number;
  number: number;
  date: string;
  cashBoxCode: string;
  cashBoxTitle: string;
  partyDisplay: string;
  description: string;
  inflow: number;
  outflow: number;
  balance: number;
}

const CASH_TAB = 0;
const LEDGER_TAB = 1;
const TAB_LABELS = ["صندوق", "گردش"];

const INFO_TEXT =
  "گردش صندوق‌ها — در تب «صندوق» می‌توانید یک یا چند صندوق را انتخاب کنید تا تب «گردش» فقط برای همان‌ها نمایش داده شود. " +
  "«دریافت» شامل ردیف‌های نقدِ سند دریافت و «پرداخت» شامل ردیف‌های نقدِ سند پرداخت است. مانده‌ی ابتدا تجمعی از اولین سند " +
  "تا روز قبل از «از تاریخ» است. همه‌ی مبالغ به ارز پایه و فقط از اسناد تاییدشده محاسبه می‌شوند.";

const DOC_ROUTE: Record<string, string> = { RECEIPT: "/receipts", PAYMENT: "/payments" };

/** اعداد منفی به‌شکل متعارف حسابداری (داخل پرانتز و قرمز) — کلاس olap-amount-negative از قبل در styles.css هست. */
function SignedCell({ value }: { value: number }) {
  const negative = value < 0;
  const text = negative ? `(${formatAmountFa(Math.abs(value))})` : formatAmountFa(value);
  return <span className={negative ? "olap-amount-negative" : undefined}>{text}</span>;
}

function numCol(header: string, field: keyof CashRow, signed = false): BalanceTableColumn<CashRow> {
  return {
    header,
    render: (r) => (signed ? <SignedCell value={(r[field] as number) || 0} /> : formatAmountFa((r[field] as number) || 0)),
    sortValue: (r) => (r[field] as number) || 0,
    filterType: "number",
    filterValue: (r) => (r[field] as number) || 0,
    decimal: true,
  };
}

// کلیدها باید دقیقاً با LEDGER_COLUMN_DEFS در backend/src/routes/cashReview.ts یکی باشند
const LEDGER_COLUMNS: (BalanceTableColumn<LedgerRow> & { field: string })[] = [
  { header: "نوع", field: "type", render: (r) => <span className="badge">{r.type}</span>, sortValue: (r) => r.type, filterType: "string", filterValue: (r) => r.type },
  { header: "شماره", field: "number", render: (r) => toFaDigits(String(r.number)), sortValue: (r) => r.number, filterType: "number", filterValue: (r) => r.number },
  { header: "تاریخ", field: "date", render: (r) => formatJalaliDate(r.date), sortValue: (r) => r.date, filterType: "date", filterValue: (r) => r.date?.slice(0, 10) },
  { header: "کد صندوق", field: "cashBoxCode", render: (r) => toFaDigits(r.cashBoxCode), sortValue: (r) => r.cashBoxCode, filterType: "string", filterValue: (r) => r.cashBoxCode },
  { header: "صندوق", field: "cashBoxTitle", render: (r) => r.cashBoxTitle, sortValue: (r) => r.cashBoxTitle, filterType: "string", filterValue: (r) => r.cashBoxTitle },
  { header: "طرف حساب", field: "partyDisplay", render: (r) => r.partyDisplay, sortValue: (r) => r.partyDisplay, filterType: "string", filterValue: (r) => r.partyDisplay },
  { header: "شرح", field: "description", render: (r) => toFaDigits(r.description), sortValue: (r) => r.description, filterType: "string", filterValue: (r) => r.description },
  { header: "دریافت", field: "inflow", render: (r) => formatAmountFa(r.inflow), sortValue: (r) => r.inflow, filterType: "number", filterValue: (r) => r.inflow, decimal: true },
  { header: "پرداخت", field: "outflow", render: (r) => formatAmountFa(r.outflow), sortValue: (r) => r.outflow, filterType: "number", filterValue: (r) => r.outflow, decimal: true },
  { header: "مانده", field: "balance", render: (r) => <SignedCell value={r.balance} />, sortValue: (r) => r.balance, filterType: "number", filterValue: (r) => r.balance, decimal: true },
];
const LEDGER_SORT_FIELD_MAP: Record<string, string> = Object.fromEntries(LEDGER_COLUMNS.map((c) => [c.header, c.field]));

export default function CashReview() {
  const { openTab } = useTabs();
  const snapshot = getCashReviewSnapshot();
  const [periodsLoaded, setPeriodsLoaded] = useState(false);
  const [filters, setFilters] = useState(snapshot?.filters ?? { fromDate: "", toDate: "" });
  const [activeTab, setActiveTab] = useState(snapshot?.activeTab ?? 0);
  const [tabData, setTabData] = useState<Record<number, CashRow[]>>(snapshot?.tabData ?? {});
  const tabLoader = useReviewTabLoader(snapshot?.loadedTabs ?? []);
  const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>(snapshot?.ledgerRows ?? []);
  const [ledgerPage, setLedgerPage] = useState(snapshot?.ledgerPage ?? 1);
  const [ledgerPageSize, setLedgerPageSize] = useState(snapshot?.ledgerPageSize ?? 25);
  const [ledgerTotal, setLedgerTotal] = useState(snapshot?.ledgerTotal ?? 0);
  const [ledgerTotalPages, setLedgerTotalPages] = useState(snapshot?.ledgerTotalPages ?? 1);
  const [ledgerSort, setLedgerSort] = useState<{ header: string; dir: "asc" | "desc" } | null>(snapshot?.ledgerSort ?? null);
  const [ledgerFilters, setLedgerFilters] = useState<Record<string, ActiveFilter>>(snapshot?.ledgerFilters ?? {});
  const [error, setError] = useState<string | null>(null);

  const chain = useChainedMultiSelect(snapshot?.chainState);
  const tabView = useReviewTabViewState(activeTab, snapshot?.tabViewState ?? {});

  useEffect(() => {
    setCashReviewSnapshot({
      chainState: { selections: chain.selections, order: chain.order },
      activeTab,
      filters,
      tabData,
      tabViewState: tabView.viewState,
      loadedTabs: Array.from(tabLoader.loadedTabs),
      ledgerRows,
      ledgerPage,
      ledgerPageSize,
      ledgerTotal,
      ledgerTotalPages,
      ledgerSort,
      ledgerFilters,
    });
  }, [chain.selections, chain.order, activeTab, filters, tabData, tabView.viewState, tabLoader.loadedTabs, ledgerRows, ledgerPage, ledgerPageSize, ledgerTotal, ledgerTotalPages, ledgerSort, ledgerFilters]);

  useEffect(() => {
    async function init() {
      const per: FiscalPeriodRange[] = await api.get("/fiscal-periods");
      setPeriodsLoaded(true);
      setFilters((prev) => (prev.fromDate ? prev : resolveReviewDateRange(per)));
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buildParams(tabIndex: number) {
    const p = new URLSearchParams();
    p.set("fromDate", filters.fromDate);
    p.set("toDate", filters.toDate);
    const ids = new Set<string>();
    for (const t of chain.tabsBefore(tabIndex)) {
      if (t !== CASH_TAB) continue;
      const rows = tabData[t] || [];
      for (const id of chain.get(t)) {
        const row = rows.find((r) => String(r.id) === String(id));
        if (row) ids.add(String(row.cashBoxId));
      }
    }
    if (ids.size) p.set("cashBoxIds", Array.from(ids).join(","));
    return p;
  }

  async function loadCashTab() {
    await tabLoader.run(
      CASH_TAB,
      async (isStale) => {
        const data = await api.get(`/cash-review/cash-boxes?${buildParams(CASH_TAB).toString()}`);
        if (isStale()) return;
        setTabData((prev) => ({ ...prev, [CASH_TAB]: data }));
      },
      setError
    );
  }

  async function loadLedger(page = 1, pageSize = ledgerPageSize, sort = ledgerSort, colFilters = ledgerFilters) {
    await tabLoader.run(
      LEDGER_TAB,
      async (isStale) => {
        const p = buildParams(LEDGER_TAB);
        p.set("page", String(page));
        p.set("pageSize", String(pageSize));
        if (sort) {
          const field = LEDGER_SORT_FIELD_MAP[sort.header];
          if (field) {
            p.set("sortField", field);
            p.set("sortDir", sort.dir);
          }
        }
        if (Object.keys(colFilters).length) {
          const serverFilters: Record<string, ActiveFilter> = {};
          for (const [header, f] of Object.entries(colFilters)) {
            const field = LEDGER_SORT_FIELD_MAP[header];
            if (field) serverFilters[field] = f;
          }
          if (Object.keys(serverFilters).length) p.set("filters", JSON.stringify(serverFilters));
        }
        const data = await api.get(`/cash-review/ledger?${p.toString()}`);
        if (isStale()) return;
        setLedgerRows(data.rows);
        setLedgerPage(data.page);
        setLedgerPageSize(data.pageSize);
        setLedgerTotal(data.total);
        setLedgerTotalPages(data.totalPages);
      },
      setError
    );
  }

  function onLedgerSortChange(sort: { header: string; dir: "asc" | "desc" } | null) {
    setLedgerSort(sort);
    loadLedger(1, ledgerPageSize, sort, ledgerFilters);
  }

  function onLedgerFiltersChange(f: Record<string, ActiveFilter>) {
    setLedgerFilters(f);
    loadLedger(1, ledgerPageSize, ledgerSort, f);
  }

  const activationDepsKey = useMemo(() => serializeForDepsKey({ selections: chain.selections, order: chain.order, filters }), [chain.selections, chain.order, filters]);
  useReviewTabActivation(
    periodsLoaded && !!filters.fromDate,
    activeTab,
    tabLoader.loadedTabs,
    (tab) => {
      if (tab === LEDGER_TAB) loadLedger();
      else loadCashTab();
    },
    activationDepsKey
  );

  function refreshCurrentTab() {
    if (activeTab === LEDGER_TAB) loadLedger();
    else loadCashTab();
  }

  // «حذف همه فیلترها»: انتخاب‌های زنجیره‌ای هم یک فیلتر محسوب می‌شوند؛ فقط بازه‌ی تاریخ بالای گزارش می‌ماند
  function clearFilters() {
    chain.reset();
    setTabData({});
    tabView.reset();
    setLedgerRows([]);
    setLedgerPage(1);
    setLedgerSort(null);
    setLedgerFilters({});
    tabLoader.resetLoaded();
    setActiveTab(0);
  }

  const tabDefs = TAB_LABELS.map((label, idx) => ({ key: `cr-${idx}`, label, count: idx === LEDGER_TAB ? 0 : chain.get(idx).size }));

  const columns = useMemo((): BalanceTableColumn<CashRow>[] => {
    const strFilter: ColumnFilterType = "string";
    return [
      { header: "کد", render: (r) => toFaDigits(r.code), sortValue: (r) => r.code, width: "100px", filterType: strFilter, filterValue: (r) => r.code },
      { header: "عنوان", render: (r) => r.title, sortValue: (r) => r.title, filterType: strFilter, filterValue: (r) => r.title },
      numCol("مانده ابتدا", "openingBalance", true),
      numCol("دریافت", "inflow"),
      numCol("پرداخت", "outflow"),
      numCol("مانده", "closingBalance", true),
    ];
  }, []);

  return (
    <div>
      <ErrorToast message={error} />

      <div className="card ar-filters">
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
          <div className="form-field-inline">
            <label>از تاریخ</label>
            <JalaliDatePicker value={filters.fromDate} onChange={(v) => { setFilters((p) => ({ ...p, fromDate: v })); clearFilters(); }} />
          </div>
          <div className="form-field-inline">
            <label>تا تاریخ</label>
            <JalaliDatePicker value={filters.toDate} onChange={(v) => { setFilters((p) => ({ ...p, toDate: v })); clearFilters(); }} />
          </div>
        </div>
      </div>

      <ChainedTabsBar
        tabs={tabDefs}
        activeIndex={activeTab}
        onChange={setActiveTab}
        actions={
          <>
            <InfoHint text={INFO_TEXT} title="مرور صندوق" />
            <RefreshButton onClick={refreshCurrentTab} title="رفرش تب جاری" />
          </>
        }
        onClearFilters={clearFilters}
      />

      {activeTab === CASH_TAB && (
        <SelectableBalanceTable
          stateKey={CASH_TAB}
          rows={tabData[CASH_TAB] || []}
          columns={columns}
          selected={chain.get(CASH_TAB)}
          onToggle={(id: SelectId) => chain.toggle(CASH_TAB, id)}
          loading={tabLoader.loading}
          restoreFilters={tabView.restoreFilters}
          restoreSort={tabView.restoreSort}
          onFiltersChange={tabView.onFiltersChange}
          onSortChange={tabView.onSortChange}
        />
      )}

      {activeTab === LEDGER_TAB && (
        <SelectableBalanceTable
          stateKey={LEDGER_TAB}
          rows={ledgerRows}
          columns={LEDGER_COLUMNS}
          selectable={false}
          onRowDoubleClick={(r) => openTab(`${DOC_ROUTE[r.docTypeCode]}/${r.documentId}/edit`)}
          loading={tabLoader.loading}
          emptyText="گردشی یافت نشد"
          restoreFilters={ledgerFilters}
          restoreSort={ledgerSort}
          serverPaging={{
            page: ledgerPage,
            pageSize: ledgerPageSize,
            total: ledgerTotal,
            loading: tabLoader.loading,
            onPageChange: (page) => loadLedger(page),
            onPageSizeChange: (size) => loadLedger(1, size, ledgerSort, ledgerFilters),
            onSortChange: onLedgerSortChange,
            onFiltersChange: onLedgerFiltersChange,
          }}
        />
      )}
    </div>
  );
}
