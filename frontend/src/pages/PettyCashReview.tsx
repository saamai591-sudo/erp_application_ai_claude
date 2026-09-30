import { useEffect, useMemo, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { ChainedTabsBar } from "../components/ChainedTabsBar";
import { SelectableBalanceTable, BalanceTableColumn } from "../components/SelectableBalanceTable";
import { RefreshButton } from "../components/RefreshButton";
import { InfoHint } from "../components/InfoHint";
import { useChainedMultiSelect, SelectId } from "../lib/useChainedMultiSelect";
import { getPettyCashReviewSnapshot, setPettyCashReviewSnapshot } from "../lib/pettyCashReviewCache";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { resolveReviewDateRange, FiscalPeriodRange } from "../lib/fiscalYearDefaultDate";
import { useReviewTabLoader, useReviewTabActivation, useReviewTabViewState, serializeForDepsKey } from "../lib/useReviewTabLoader";
import { useTabs } from "../lib/TabsContext";
import { api } from "../lib/api";
import { appendSortParams } from "../lib/gridSort";
import { ColumnFilterType, ActiveFilter } from "../components/DataTable";

// گزارش «مرور تنخواه» (خزانه‌داری > گزارش) — هم‌الگوی «مرور صندوق» با سه تب: «تنخواه» (مانده ابتدا/شارژ/پرداخت/مانده به‌ازای هر
// تنخواه)، «تنخواه‌دار» (همان ستون‌ها به‌ازای هر تنخواه‌دار) و «گردش» (فهرست تخت گردش‌ها با مانده‌ی جاری، صفحه‌بندی و فیلتر سمت سرور).
// انتخاب تنخواه‌ها تب‌های بعدی و انتخاب تنخواه‌دارها تب «گردش» را فیلتر می‌کند. تعریف «گردش تنخواه»: backend/src/services/pettyCashReviewService.ts.

interface PettyCashRow {
  id: SelectId;
  pettyCashId: number;
  code: string;
  title: string;
  currencyTitle: string;
  openingBalance: number;
  inflow: number;
  outflow: number;
  closingBalance: number;
}

interface CustodianRow {
  id: SelectId;
  custodianId: number;
  code: string;
  title: string;
  pettyCashTitle: string;
  currencyTitle: string;
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
  pettyCashCode: string;
  pettyCashTitle: string;
  custodianCode: string;
  custodianTitle: string;
  partyDisplay: string;
  description: string;
  inflow: number;
  outflow: number;
  balance: number;
}

const PETTY_CASH_TAB = 0;
const CUSTODIAN_TAB = 1;
const LEDGER_TAB = 2;
const TAB_LABELS = ["تنخواه", "تنخواه‌دار", "گردش"];

const INFO_TEXT =
  "گردش تنخواه‌ها — در تب «تنخواه» می‌توانید یک یا چند تنخواه را انتخاب کنید تا تب «تنخواه‌دار» فقط تنخواه‌دارهای همان‌ها را نشان دهد، و " +
  "با انتخاب تنخواه‌دارها تب «گردش» فقط برای همان‌ها نمایش داده شود. «شارژ» شامل ردیف‌های «به تنخواه» در اسناد پرداختِ تاییدشده و «پرداخت» شامل " +
  "پرداخت‌های تنخواه است. مانده‌ی ابتدا مجموع همه‌ی گردش‌ها تا روز قبل از «از تاریخ» است (تنخواه افتتاحیه و انتقال پایان سال ندارد و مانده " +
  "از ابتدا پیوسته است). مبالغ به ارز خودِ تنخواه است و مانده‌ی جاری در تاریخ برابر، شارژ را پیش از پرداخت حساب می‌کند.";

const DOC_ROUTE: Record<string, string> = { FUNDING: "/payments", SPENDING: "/petty-cash-payments" };

/** اعداد منفی به‌شکل متعارف حسابداری (داخل پرانتز و قرمز) — کلاس olap-amount-negative از قبل در styles.css هست. */
function SignedCell({ value }: { value: number }) {
  const negative = value < 0;
  const text = negative ? `(${formatAmountFa(Math.abs(value))})` : formatAmountFa(value);
  return <span className={negative ? "olap-amount-negative" : undefined}>{text}</span>;
}

function numCol<T extends PettyCashRow | CustodianRow>(header: string, field: keyof T, signed = false): BalanceTableColumn<T> {
  return {
    header,
    render: (r) => (signed ? <SignedCell value={(r[field] as number) || 0} /> : formatAmountFa((r[field] as number) || 0)),
    sortValue: (r) => (r[field] as number) || 0,
    filterType: "number",
    filterValue: (r) => (r[field] as number) || 0,
    decimal: true,
  };
}

// کلیدها باید دقیقاً با LEDGER_COLUMN_DEFS در backend/src/routes/pettyCashReview.ts یکی باشند
const LEDGER_COLUMNS: (BalanceTableColumn<LedgerRow> & { field: string })[] = [
  { header: "نوع", field: "type", render: (r) => <span className="badge">{r.type}</span>, sortValue: (r) => r.type, filterType: "string", filterValue: (r) => r.type },
  { header: "شماره", field: "number", render: (r) => toFaDigits(String(r.number)), sortValue: (r) => r.number, filterType: "number", filterValue: (r) => r.number },
  { header: "تاریخ", field: "date", render: (r) => formatJalaliDate(r.date), sortValue: (r) => r.date, filterType: "date", filterValue: (r) => r.date?.slice(0, 10) },
  { header: "کد تنخواه", field: "pettyCashCode", render: (r) => toFaDigits(r.pettyCashCode), sortValue: (r) => r.pettyCashCode, filterType: "string", filterValue: (r) => r.pettyCashCode },
  { header: "تنخواه", field: "pettyCashTitle", render: (r) => r.pettyCashTitle, sortValue: (r) => r.pettyCashTitle, filterType: "string", filterValue: (r) => r.pettyCashTitle },
  { header: "کد تنخواه‌دار", field: "custodianCode", render: (r) => toFaDigits(r.custodianCode), sortValue: (r) => r.custodianCode, filterType: "string", filterValue: (r) => r.custodianCode },
  { header: "تنخواه‌دار", field: "custodianTitle", render: (r) => r.custodianTitle, sortValue: (r) => r.custodianTitle, filterType: "string", filterValue: (r) => r.custodianTitle },
  { header: "طرف حساب", field: "partyDisplay", render: (r) => r.partyDisplay, sortValue: (r) => r.partyDisplay, filterType: "string", filterValue: (r) => r.partyDisplay },
  { header: "شرح", field: "description", render: (r) => toFaDigits(r.description), sortValue: (r) => r.description, filterType: "string", filterValue: (r) => r.description },
  { header: "شارژ", field: "inflow", render: (r) => formatAmountFa(r.inflow), sortValue: (r) => r.inflow, filterType: "number", filterValue: (r) => r.inflow, decimal: true },
  { header: "پرداخت", field: "outflow", render: (r) => formatAmountFa(r.outflow), sortValue: (r) => r.outflow, filterType: "number", filterValue: (r) => r.outflow, decimal: true },
  // مانده‌ی جاری عمداً decimal نیست: جمع ستون «مانده‌ی جاری» بی‌معناست (فقط شارژ/پرداخت در ردیف «جمع» جمع می‌شوند)
  { header: "مانده", field: "balance", render: (r) => <SignedCell value={r.balance} />, sortValue: (r) => r.balance, filterType: "number", filterValue: (r) => r.balance },
];
const LEDGER_SORT_FIELD_MAP: Record<string, string> = Object.fromEntries(LEDGER_COLUMNS.map((c) => [c.header, c.field]));

export default function PettyCashReview() {
  const { openTab } = useTabs();
  const snapshot = getPettyCashReviewSnapshot();
  const [periodsLoaded, setPeriodsLoaded] = useState(false);
  const [filters, setFilters] = useState(snapshot?.filters ?? { fromDate: "", toDate: "" });
  const [activeTab, setActiveTab] = useState(snapshot?.activeTab ?? 0);
  const [tabData, setTabData] = useState<Record<number, (PettyCashRow | CustodianRow)[]>>(snapshot?.tabData ?? {});
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
    setPettyCashReviewSnapshot({
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
    const pettyCashIds = new Set<string>();
    const custodianIds = new Set<string>();
    for (const t of chain.tabsBefore(tabIndex)) {
      const rows = tabData[t] || [];
      for (const id of chain.get(t)) {
        const row: any = rows.find((r) => String(r.id) === String(id));
        if (!row) continue;
        if (t === PETTY_CASH_TAB) pettyCashIds.add(String(row.pettyCashId));
        else if (t === CUSTODIAN_TAB) custodianIds.add(String(row.custodianId));
      }
    }
    if (pettyCashIds.size) p.set("pettyCashIds", Array.from(pettyCashIds).join(","));
    if (custodianIds.size) p.set("custodianIds", Array.from(custodianIds).join(","));
    return p;
  }

  async function loadBalanceTab(tab: number) {
    await tabLoader.run(
      tab,
      async (isStale) => {
        const path = tab === PETTY_CASH_TAB ? "petty-cashes" : "custodians";
        const data = await api.get(`/petty-cash-review/${path}?${buildParams(tab).toString()}`);
        if (isStale()) return;
        setTabData((prev) => ({ ...prev, [tab]: data }));
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
        appendSortParams(p, sort, LEDGER_SORT_FIELD_MAP);
        if (Object.keys(colFilters).length) {
          const serverFilters: Record<string, ActiveFilter> = {};
          for (const [header, f] of Object.entries(colFilters)) {
            const field = LEDGER_SORT_FIELD_MAP[header];
            if (field) serverFilters[field] = f;
          }
          if (Object.keys(serverFilters).length) p.set("filters", JSON.stringify(serverFilters));
        }
        const data = await api.get(`/petty-cash-review/ledger?${p.toString()}`);
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
      else loadBalanceTab(tab);
    },
    activationDepsKey
  );

  function refreshCurrentTab() {
    if (activeTab === LEDGER_TAB) loadLedger();
    else loadBalanceTab(activeTab);
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

  const tabDefs = TAB_LABELS.map((label, idx) => ({ key: `pcr-${idx}`, label, count: idx === LEDGER_TAB ? 0 : chain.get(idx).size }));

  const pettyCashColumns = useMemo((): BalanceTableColumn<PettyCashRow>[] => {
    const strFilter: ColumnFilterType = "string";
    return [
      { header: "کد", render: (r) => toFaDigits(r.code), sortValue: (r) => r.code, width: "100px", filterType: strFilter, filterValue: (r) => r.code },
      { header: "عنوان", render: (r) => r.title, sortValue: (r) => r.title, filterType: strFilter, filterValue: (r) => r.title },
      { header: "ارز", render: (r) => r.currencyTitle, sortValue: (r) => r.currencyTitle, width: "90px", filterType: strFilter, filterValue: (r) => r.currencyTitle },
      numCol<PettyCashRow>("مانده ابتدا", "openingBalance", true),
      numCol<PettyCashRow>("شارژ", "inflow"),
      numCol<PettyCashRow>("پرداخت", "outflow"),
      numCol<PettyCashRow>("مانده", "closingBalance", true),
    ];
  }, []);

  const custodianColumns = useMemo((): BalanceTableColumn<CustodianRow>[] => {
    const strFilter: ColumnFilterType = "string";
    return [
      { header: "کد", render: (r) => toFaDigits(r.code), sortValue: (r) => r.code, width: "100px", filterType: strFilter, filterValue: (r) => r.code },
      { header: "تنخواه‌دار", render: (r) => r.title, sortValue: (r) => r.title, filterType: strFilter, filterValue: (r) => r.title },
      { header: "تنخواه", render: (r) => r.pettyCashTitle, sortValue: (r) => r.pettyCashTitle, filterType: strFilter, filterValue: (r) => r.pettyCashTitle },
      { header: "ارز", render: (r) => r.currencyTitle, sortValue: (r) => r.currencyTitle, width: "90px", filterType: strFilter, filterValue: (r) => r.currencyTitle },
      numCol<CustodianRow>("مانده ابتدا", "openingBalance", true),
      numCol<CustodianRow>("شارژ", "inflow"),
      numCol<CustodianRow>("پرداخت", "outflow"),
      numCol<CustodianRow>("مانده", "closingBalance", true),
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
            <InfoHint text={INFO_TEXT} title="مرور تنخواه" />
            <RefreshButton onClick={refreshCurrentTab} title="رفرش تب جاری" />
          </>
        }
        onClearFilters={clearFilters}
      />

      {activeTab === PETTY_CASH_TAB && (
        <SelectableBalanceTable
          stateKey={PETTY_CASH_TAB}
          rows={(tabData[PETTY_CASH_TAB] || []) as PettyCashRow[]}
          columns={pettyCashColumns}
          selected={chain.get(PETTY_CASH_TAB)}
          onToggle={(id: SelectId) => chain.toggle(PETTY_CASH_TAB, id)}
          loading={tabLoader.loading}
          restoreFilters={tabView.restoreFilters}
          restoreSort={tabView.restoreSort}
          onFiltersChange={tabView.onFiltersChange}
          onSortChange={tabView.onSortChange}
        />
      )}

      {activeTab === CUSTODIAN_TAB && (
        <SelectableBalanceTable
          stateKey={CUSTODIAN_TAB}
          rows={(tabData[CUSTODIAN_TAB] || []) as CustodianRow[]}
          columns={custodianColumns}
          selected={chain.get(CUSTODIAN_TAB)}
          onToggle={(id: SelectId) => chain.toggle(CUSTODIAN_TAB, id)}
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
          onRowDoubleClick={(r) => DOC_ROUTE[r.docTypeCode] && openTab(`${DOC_ROUTE[r.docTypeCode]}/${r.documentId}/edit`)}
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
