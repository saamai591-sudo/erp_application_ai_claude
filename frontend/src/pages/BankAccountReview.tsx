import { useEffect, useMemo, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { ChainedTabsBar } from "../components/ChainedTabsBar";
import { SelectableBalanceTable, BalanceTableColumn } from "../components/SelectableBalanceTable";
import { RefreshButton } from "../components/RefreshButton";
import { InfoHint } from "../components/InfoHint";
import { useChainedMultiSelect, SelectId } from "../lib/useChainedMultiSelect";
import { getBankAccountReviewSnapshot, setBankAccountReviewSnapshot } from "../lib/bankAccountReviewCache";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { resolveReviewDateRange, FiscalPeriodRange } from "../lib/fiscalYearDefaultDate";
import { useReviewTabLoader, useReviewTabActivation, useReviewTabViewState, serializeForDepsKey } from "../lib/useReviewTabLoader";
import { useTabs } from "../lib/TabsContext";
import { api } from "../lib/api";
import { ColumnFilterType, ActiveFilter } from "../components/DataTable";

// گزارش «مرور حساب بانکی» (خزانه‌داری > گزارش) — هم‌فرمت «مرور فروش»/«مرور مبلغی انبار»: تب‌های زنجیره‌ای
// (ChainedTabsBar + useChainedMultiSelect)، انتخاب چند ردیف در یک تب فیلتر تب‌های دیگر را اعمال می‌کند.
// تب‌ها: حساب بانکی، شعبه‌ی بانک، نوع حساب بانکی (ستون‌های مانده ابتدا/دریافت/پرداخت/مانده)، «اسناد»
// (یک ردیف به‌ازای هر سند) و «گردش» (فهرست تخت گردش‌ها با مانده‌ی جاری، صفحه‌بندی و فیلتر سمت سرور).
// تعریف «گردش بانکی» و منبع داده: backend/src/services/bankAccountReviewService.ts.

interface DimRow {
  id: SelectId;
  code?: number | string | null;
  title?: string | null;
  bankAccountId?: number;
  bankBranchId?: number;
  accountTypeId?: number;
  docKey?: string;
  docType?: string;
  docTypeCode?: string;
  documentId?: number;
  number?: number;
  date?: string;
  partyDisplay?: string;
  openingBalance: number;
  inflow: number;
  outflow: number;
  closingBalance: number;
  net?: number;
}

interface LedgerRow {
  id: number;
  type: string;
  docTypeCode: string;
  documentId: number;
  number: number;
  date: string;
  bankAccountCode: string;
  bankAccountTitle: string;
  partyDisplay: string;
  description: string;
  inflow: number;
  outflow: number;
  balance: number;
}

const BANK_ACCOUNT_TAB = 0;
const BANK_BRANCH_TAB = 1;
const ACCOUNT_TYPE_TAB = 2;
const DOCUMENTS_TAB = 3;
const LEDGER_TAB = 4;
const TAB_LABELS = ["حساب بانکی", "شعبه بانک", "نوع حساب بانکی", "اسناد", "گردش"];

const INFO_TEXT =
  "گزارش سلسله‌مراتبی گردش حساب‌های بانکی — در هر تب چندین ردیف قابل انتخاب است تا تب‌های دیگر (و تب «اسناد»/«گردش») " +
  "فقط برای همان‌ها نمایش داده شوند. «دریافت» شامل حواله/پوز سند دریافت و چک‌های دریافتنیِ وصول‌شده، و «پرداخت» شامل حواله‌ی " +
  "سند پرداخت و چک‌های پرداختنیِ وصول‌شده است؛ واگذاری به بانک و صدور چک تا وقتی وصول نشده‌اند گردش بانکی نیستند و چک " +
  "برگشتی هم گردشی ندارد. مانده‌ی ابتدا تجمعی از اولین سند تا روز قبل از «از تاریخ» است. همه‌ی مبالغ به ارز پایه و فقط از " +
  "اسناد تاییدشده محاسبه می‌شوند.";

const DOC_ROUTE: Record<string, string> = {
  RECEIPT: "/receipts",
  PAYMENT: "/payments",
  CLEARING_RECEIVABLE: "/cheque-clearings-receivable",
  CLEARING_PAYABLE: "/cheque-clearings-payable",
};

/** اعداد منفی به‌شکل متعارف حسابداری (داخل پرانتز و قرمز) — کلاس olap-amount-negative از قبل در styles.css هست. */
function SignedCell({ value }: { value: number }) {
  const negative = value < 0;
  const text = negative ? `(${formatAmountFa(Math.abs(value))})` : formatAmountFa(value);
  return <span className={negative ? "olap-amount-negative" : undefined}>{text}</span>;
}

function numCol(header: string, field: keyof DimRow, signed = false): BalanceTableColumn<DimRow> {
  return {
    header,
    render: (r) => (signed ? <SignedCell value={(r[field] as number) || 0} /> : formatAmountFa((r[field] as number) || 0)),
    sortValue: (r) => (r[field] as number) || 0,
    filterType: "number",
    filterValue: (r) => (r[field] as number) || 0,
    decimal: true,
  };
}

// کلیدها باید دقیقاً با LEDGER_COLUMN_DEFS در backend/src/routes/bankAccountReview.ts یکی باشند
const LEDGER_COLUMNS: (BalanceTableColumn<LedgerRow> & { field: string })[] = [
  { header: "نوع", field: "type", render: (r) => <span className="badge">{r.type}</span>, sortValue: (r) => r.type, filterType: "string", filterValue: (r) => r.type },
  { header: "شماره", field: "number", render: (r) => toFaDigits(String(r.number)), sortValue: (r) => r.number, filterType: "number", filterValue: (r) => r.number },
  { header: "تاریخ", field: "date", render: (r) => formatJalaliDate(r.date), sortValue: (r) => r.date, filterType: "date", filterValue: (r) => r.date?.slice(0, 10) },
  { header: "کد حساب", field: "bankAccountCode", render: (r) => toFaDigits(r.bankAccountCode), sortValue: (r) => r.bankAccountCode, filterType: "string", filterValue: (r) => r.bankAccountCode },
  { header: "حساب بانکی", field: "bankAccountTitle", render: (r) => toFaDigits(r.bankAccountTitle), sortValue: (r) => r.bankAccountTitle, filterType: "string", filterValue: (r) => r.bankAccountTitle },
  { header: "طرف حساب", field: "partyDisplay", render: (r) => r.partyDisplay, sortValue: (r) => r.partyDisplay, filterType: "string", filterValue: (r) => r.partyDisplay },
  { header: "شرح", field: "description", render: (r) => toFaDigits(r.description), sortValue: (r) => r.description, filterType: "string", filterValue: (r) => r.description },
  { header: "دریافت", field: "inflow", render: (r) => formatAmountFa(r.inflow), sortValue: (r) => r.inflow, filterType: "number", filterValue: (r) => r.inflow, decimal: true },
  { header: "پرداخت", field: "outflow", render: (r) => formatAmountFa(r.outflow), sortValue: (r) => r.outflow, filterType: "number", filterValue: (r) => r.outflow, decimal: true },
  { header: "مانده", field: "balance", render: (r) => <SignedCell value={r.balance} />, sortValue: (r) => r.balance, filterType: "number", filterValue: (r) => r.balance, decimal: true },
];
const LEDGER_SORT_FIELD_MAP: Record<string, string> = Object.fromEntries(LEDGER_COLUMNS.map((c) => [c.header, c.field]));

export default function BankAccountReview() {
  const { openTab } = useTabs();
  const snapshot = getBankAccountReviewSnapshot();
  const [periods, setPeriods] = useState<FiscalPeriodRange[]>([]);
  const [periodsLoaded, setPeriodsLoaded] = useState(false);
  const [filters, setFilters] = useState(snapshot?.filters ?? { fromDate: "", toDate: "" });
  const [activeTab, setActiveTab] = useState(snapshot?.activeTab ?? 0);
  const [tabData, setTabData] = useState<Record<number, DimRow[]>>(snapshot?.tabData ?? {});
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
    setBankAccountReviewSnapshot({
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
      setPeriods(per);
      setPeriodsLoaded(true);
      setFilters((prev) => (prev.fromDate ? prev : resolveReviewDateRange(per)));
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dimEndpoint(tabIndex: number): string {
    if (tabIndex === BANK_ACCOUNT_TAB) return "/bank-account-review/bank-accounts";
    if (tabIndex === BANK_BRANCH_TAB) return "/bank-account-review/bank-branches";
    if (tabIndex === ACCOUNT_TYPE_TAB) return "/bank-account-review/account-types";
    if (tabIndex === DOCUMENTS_TAB) return "/bank-account-review/documents";
    return "";
  }

  /** فیلترهای مؤثر روی tabIndex از ردیف‌های انتخاب‌شده‌ی تب‌هایی که «پیش‌تر» لمس شده‌اند — هم‌الگوی مرور فروش. */
  function collectFilters(tabIndex: number) {
    const bankAccountIds = new Set<string>();
    const bankBranchIds = new Set<string>();
    const accountTypeIds = new Set<string>();
    const documentKeys = new Set<string>();
    for (const t of chain.tabsBefore(tabIndex)) {
      if (t === LEDGER_TAB) continue;
      const rows = tabData[t] || [];
      for (const id of chain.get(t)) {
        const row = rows.find((r) => String(r.id) === String(id));
        if (!row) continue;
        if (t === BANK_ACCOUNT_TAB && row.bankAccountId != null) bankAccountIds.add(String(row.bankAccountId));
        if (t === BANK_BRANCH_TAB && row.bankBranchId != null) bankBranchIds.add(String(row.bankBranchId));
        if (t === ACCOUNT_TYPE_TAB && row.accountTypeId != null) accountTypeIds.add(String(row.accountTypeId));
        if (t === DOCUMENTS_TAB && row.docKey) documentKeys.add(row.docKey);
      }
    }
    return { bankAccountIds, bankBranchIds, accountTypeIds, documentKeys };
  }

  function buildParams(tabIndex: number) {
    const p = new URLSearchParams();
    p.set("fromDate", filters.fromDate);
    p.set("toDate", filters.toDate);
    const f = collectFilters(tabIndex);
    if (f.bankAccountIds.size) p.set("bankAccountIds", Array.from(f.bankAccountIds).join(","));
    if (f.bankBranchIds.size) p.set("bankBranchIds", Array.from(f.bankBranchIds).join(","));
    if (f.accountTypeIds.size) p.set("accountTypeIds", Array.from(f.accountTypeIds).join(","));
    if (f.documentKeys.size) p.set("documentKeys", Array.from(f.documentKeys).join(","));
    return p;
  }

  async function loadDimTab(tabIndex: number) {
    await tabLoader.run(
      tabIndex,
      async (isStale) => {
        const data = await api.get(`${dimEndpoint(tabIndex)}?${buildParams(tabIndex).toString()}`);
        if (isStale()) return;
        setTabData((prev) => ({ ...prev, [tabIndex]: data }));
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
        const data = await api.get(`/bank-account-review/ledger?${p.toString()}`);
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
      else loadDimTab(tab);
    },
    activationDepsKey
  );

  function refreshCurrentTab() {
    if (activeTab === LEDGER_TAB) loadLedger();
    else loadDimTab(activeTab);
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

  const tabDefs = TAB_LABELS.map((label, idx) => ({
    key: `bar-${idx}`,
    label,
    count: idx === LEDGER_TAB ? 0 : chain.get(idx).size,
  }));

  const columns = useMemo((): BalanceTableColumn<DimRow>[] => {
    const strFilter: ColumnFilterType = "string";
    if (activeTab === DOCUMENTS_TAB) {
      return [
        { header: "نوع", render: (r) => <span className="badge">{r.docType}</span>, sortValue: (r) => r.docType || "", filterType: strFilter, filterValue: (r) => r.docType || "" },
        { header: "شماره", render: (r) => toFaDigits(String(r.number)), sortValue: (r) => r.number || 0, width: "80px", filterType: "number", filterValue: (r) => r.number ?? null },
        { header: "تاریخ", render: (r) => (r.date ? formatJalaliDate(r.date) : "—"), sortValue: (r) => r.date || "", filterType: "date", filterValue: (r) => r.date?.slice(0, 10) },
        { header: "طرف حساب", render: (r) => r.partyDisplay || "—", sortValue: (r) => r.partyDisplay || "", filterType: strFilter, filterValue: (r) => r.partyDisplay || "" },
        numCol("دریافت", "inflow"),
        numCol("پرداخت", "outflow"),
        numCol("خالص", "net", true),
      ];
    }
    return [
      { header: "کد", render: (r) => (r.code != null ? toFaDigits(String(r.code)) : "—"), sortValue: (r) => r.code ?? "", width: "100px", filterType: strFilter, filterValue: (r) => (r.code != null ? String(r.code) : "") },
      { header: "عنوان", render: (r) => (r.title ? toFaDigits(r.title) : "—"), sortValue: (r) => r.title || "", filterType: strFilter, filterValue: (r) => r.title || "" },
      numCol("مانده ابتدا", "openingBalance", true),
      numCol("دریافت", "inflow"),
      numCol("پرداخت", "outflow"),
      numCol("مانده", "closingBalance", true),
    ];
  }, [activeTab]);

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
            <InfoHint text={INFO_TEXT} title="مرور حساب بانکی" />
            <RefreshButton onClick={refreshCurrentTab} title="رفرش تب جاری" />
          </>
        }
        onClearFilters={clearFilters}
      />

      {activeTab !== LEDGER_TAB && (
        <SelectableBalanceTable
          stateKey={activeTab}
          rows={tabData[activeTab] || []}
          columns={columns}
          selected={chain.get(activeTab)}
          onToggle={(id: SelectId) => chain.toggle(activeTab, id)}
          onRowDoubleClick={activeTab === DOCUMENTS_TAB ? (r) => r.docTypeCode && openTab(`${DOC_ROUTE[r.docTypeCode]}/${r.documentId}/edit`) : undefined}
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
