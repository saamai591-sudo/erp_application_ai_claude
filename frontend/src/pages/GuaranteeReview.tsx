import { useEffect, useMemo, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { ChainedTabsBar } from "../components/ChainedTabsBar";
import { SelectableBalanceTable, BalanceTableColumn } from "../components/SelectableBalanceTable";
import { RefreshButton } from "../components/RefreshButton";
import { InfoHint } from "../components/InfoHint";
import { useChainedMultiSelect, SelectId } from "../lib/useChainedMultiSelect";
import { getGuaranteeReviewSnapshot, setGuaranteeReviewSnapshot } from "../lib/guaranteeReviewCache";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { resolveReviewDateRange, FiscalPeriodRange } from "../lib/fiscalYearDefaultDate";
import { useReviewTabLoader, useReviewTabActivation, useReviewTabViewState, serializeForDepsKey } from "../lib/useReviewTabLoader";
import { useTabs } from "../lib/TabsContext";
import { api } from "../lib/api";
import { appendSortParams } from "../lib/gridSort";
import { ColumnFilterType, ActiveFilter } from "../components/DataTable";
import { SignedCell } from "../components/reviewColumns";

// گزارش «مرور تضامین دریافتی/پرداختی» (مدیریت خزانه › گزارش): یک صفحه برای هر دو جهت (prop direction) با سه تب زنجیره‌ای «طرف حساب» ← «ابزار» ← «گردش».
// مبالغ به ارز خودِ ابزار؛ مانده = مجموع مبلغ فعلی ابزارهای ابطال/استردادنشده. قواعد: backend/src/routes/guaranteeReview.ts.

type Direction = "RECEIPT" | "PAYMENT";

interface BalanceFields {
  openingBalance: number;
  inflow: number;
  reduce: number;
  cancel: number;
  ret: number;
  closingBalance: number;
}
interface PartyRow extends BalanceFields {
  id: SelectId;
  code: string;
  title: string;
  currencyTitle: string;
}
interface InstrumentRow extends BalanceFields {
  id: SelectId;
  instrumentId: number;
  partyCode: string;
  partyTitle: string;
  type: string;
  number: string;
  guaranteeTypeTitle: string;
  documentNumber: number;
  documentDate: string;
  isOpening: boolean;
  currencyTitle: string;
  originalAmount: number;
  dueDate: string | null;
  dueState: "OVERDUE" | "NOT_DUE" | "NONE" | "CLOSED";
  status: string;
}
interface LedgerRow {
  id: number;
  type: string;
  openPath: string;
  number: number;
  date: string;
  partyCode: string;
  partyTitle: string;
  instrumentType: string;
  instrumentNumber: string;
  guaranteeTypeTitle: string;
  currencyTitle: string;
  increase: number;
  reduce: number;
  cancel: number;
  ret: number;
  newDueDate: string | null;
  balance: number;
}

const PARTY_TAB = 0;
const INSTRUMENT_TAB = 1;
const LEDGER_TAB = 2;
const TAB_LABELS = ["طرف حساب", "ابزار", "گردش"];
const STATUS_OPTIONS = [
  { v: "ACTIVE", t: "فعال" },
  { v: "CANCELLED", t: "ابطال‌شده" },
  { v: "RETURNED", t: "مسترد" },
];
const DUE_OPTIONS = [
  { v: "OVERDUE", t: "سررسید گذشته" },
  { v: "NONE", t: "فاقد سررسید" },
  { v: "NOT_DUE", t: "سررسید نشده" },
];

/** اعداد منفی به‌شکل متعارف حسابداری (داخل پرانتز و قرمز) */
function numCol<T extends BalanceFields>(header: string, field: keyof BalanceFields, signed = false): BalanceTableColumn<T> {
  return {
    header,
    render: (r) => (signed ? <SignedCell value={r[field] || 0} /> : formatAmountFa(r[field] || 0)),
    sortValue: (r) => r[field] || 0,
    filterType: "number",
    filterValue: (r) => r[field] || 0,
    decimal: true,
  };
}

const DUE_COLOR: Record<string, string | undefined> = { OVERDUE: "#b00020" };

export default function GuaranteeReview({ direction }: { direction: Direction }) {
  const isReceipt = direction === "RECEIPT";
  const base = isReceipt ? "/guarantee-receipt-review" : "/guarantee-payment-review";
  const word = isReceipt ? "دریافت" : "پرداخت";
  const title = isReceipt ? "مرور تضامین دریافتی" : "مرور تضامین پرداختی";
  const { openTab } = useTabs();
  const snapshot = getGuaranteeReviewSnapshot(direction);
  const [periodsLoaded, setPeriodsLoaded] = useState(false);
  const [filters, setFilters] = useState(snapshot?.filters ?? { fromDate: "", toDate: "", status: ["ACTIVE"] as string[], due: DUE_OPTIONS.map((o) => o.v) });
  const [activeTab, setActiveTab] = useState(snapshot?.activeTab ?? 0);
  const [tabData, setTabData] = useState<Record<number, any[]>>(snapshot?.tabData ?? {});
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
    setGuaranteeReviewSnapshot(direction, {
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
      setFilters((prev) => (prev.fromDate ? prev : { ...prev, ...resolveReviewDateRange(per) }));
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buildParams(tabIndex: number) {
    const p = new URLSearchParams();
    p.set("fromDate", filters.fromDate);
    p.set("toDate", filters.toDate);
    // همیشه ارسال می‌شود: بخشی که هیچ گزینه‌ای تیک ندارد (مقدار خالی) هیچ داده‌ای برنمی‌گرداند
    p.set("status", filters.status.join(","));
    p.set("due", filters.due.join(","));
    const partyKeys = new Set<string>();
    const instrumentIds = new Set<string>();
    for (const t of chain.tabsBefore(tabIndex)) {
      for (const id of chain.get(t)) {
        if (t === PARTY_TAB) partyKeys.add(String(id));
        else if (t === INSTRUMENT_TAB) instrumentIds.add(String(id));
      }
    }
    if (partyKeys.size) p.set("partyKeys", Array.from(partyKeys).join(","));
    if (instrumentIds.size) p.set("instrumentIds", Array.from(instrumentIds).join(","));
    return p;
  }

  async function loadBalanceTab(tab: number) {
    await tabLoader.run(
      tab,
      async (isStale) => {
        const data = await api.get(`${base}/${tab === PARTY_TAB ? "parties" : "instruments"}?${buildParams(tab).toString()}`);
        if (isStale()) return;
        setTabData((prev) => ({ ...prev, [tab]: data }));
      },
      setError
    );
  }

  const ledgerColumns = useMemo((): (BalanceTableColumn<LedgerRow> & { field: string })[] => {
    const s = (header: string, field: keyof LedgerRow, extra: Partial<BalanceTableColumn<LedgerRow>> = {}): BalanceTableColumn<LedgerRow> & { field: string } => ({
      header,
      field,
      render: (r) => String(r[field] ?? ""),
      sortValue: (r) => String(r[field] ?? ""),
      filterType: "string",
      filterValue: (r) => String(r[field] ?? ""),
      ...extra,
    });
    const n = (header: string, field: keyof LedgerRow): BalanceTableColumn<LedgerRow> & { field: string } => ({
      header,
      field,
      render: (r) => (Number(r[field]) ? formatAmountFa(Number(r[field])) : ""),
      sortValue: (r) => Number(r[field]),
      filterType: "number",
      filterValue: (r) => Number(r[field]),
      decimal: true,
    });
    return [
      s("نوع", "type", { render: (r) => <span className="badge">{r.type}</span> }),
      s("شماره سند", "number", { render: (r) => toFaDigits(String(r.number)), sortValue: (r) => r.number, filterType: "number", filterValue: (r) => r.number }),
      s("تاریخ", "date", { render: (r) => formatJalaliDate(r.date), filterType: "date", filterValue: (r) => r.date?.slice(0, 10) }),
      s("کد طرف حساب", "partyCode", { render: (r) => toFaDigits(r.partyCode) }),
      s("طرف حساب", "partyTitle"),
      s("نوع ابزار", "instrumentType"),
      s("شماره ابزار", "instrumentNumber", { render: (r) => toFaDigits(r.instrumentNumber) }),
      s("نوع تضمین", "guaranteeTypeTitle"),
      s("ارز", "currencyTitle", { fxOnly: true }),
      n(`${word} و افزایش`, "increase"),
      n("تقلیل", "reduce"),
      n("ابطال", "cancel"),
      n("استرداد", "ret"),
      s("سررسید جدید", "newDueDate", { render: (r) => (r.newDueDate ? formatJalaliDate(r.newDueDate) : ""), filterType: "date", filterValue: (r) => r.newDueDate?.slice(0, 10) ?? "" }),
      // مانده‌ی جاری عمداً decimal نیست: جمع ستون مانده بی‌معناست
      { header: "مانده", field: "balance", render: (r) => <SignedCell value={r.balance} />, sortValue: (r) => r.balance, filterType: "number", filterValue: (r) => r.balance },
    ];
  }, [word]);
  const ledgerSortMap: Record<string, string> = useMemo(() => Object.fromEntries(ledgerColumns.map((c) => [c.header, c.field])), [ledgerColumns]);

  async function loadLedger(page = 1, pageSize = ledgerPageSize, sort = ledgerSort, colFilters = ledgerFilters) {
    await tabLoader.run(
      LEDGER_TAB,
      async (isStale) => {
        const p = buildParams(LEDGER_TAB);
        p.set("page", String(page));
        p.set("pageSize", String(pageSize));
        appendSortParams(p, sort, ledgerSortMap);
        if (Object.keys(colFilters).length) {
          const serverFilters: Record<string, ActiveFilter> = {};
          for (const [header, f] of Object.entries(colFilters)) {
            const field = ledgerSortMap[header];
            if (field) serverFilters[field] = f;
          }
          if (Object.keys(serverFilters).length) p.set("filters", JSON.stringify(serverFilters));
        }
        const data = await api.get(`${base}/ledger?${p.toString()}`);
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

  const activationDepsKey = useMemo(() => serializeForDepsKey({ upstream: chain.upstream(activeTab), filters }), [chain.selections, chain.order, activeTab, filters]);
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

  // «حذف همه فیلترها»: انتخاب‌های زنجیره‌ای پاک و فیلترها به پیش‌فرض (وضعیت «فعال» و هر سه گزینه‌ی سررسید) برمی‌گردد؛ فقط بازه‌ی تاریخ می‌ماند
  function clearFilters() {
    chain.reset();
    setTabData({});
    tabView.reset();
    setLedgerRows([]);
    setLedgerPage(1);
    setLedgerSort(null);
    setLedgerFilters({});
    setFilters((p) => ({ ...p, status: ["ACTIVE"], due: DUE_OPTIONS.map((o) => o.v) }));
    tabLoader.resetLoaded();
    setActiveTab(0);
  }

  // تغییر فیلترهای هدر فقط داده‌ی بارگذاری‌شده را باطل می‌کند؛ انتخاب‌های زنجیره‌ای و فیلتر/مرتب‌سازی گریدها می‌ماند
  function invalidateData() {
    setTabData({});
    setLedgerRows([]);
    setLedgerPage(1);
    tabLoader.resetLoaded();
  }
  function patchFilters(patch: Partial<typeof filters>) {
    setFilters((p) => ({ ...p, ...patch }));
    invalidateData();
  }

  const tabDefs = TAB_LABELS.map((label, idx) => ({ key: `gr-${idx}`, label, count: idx === LEDGER_TAB ? 0 : chain.get(idx).size }));

  const partyColumns = useMemo((): BalanceTableColumn<PartyRow>[] => {
    const str: ColumnFilterType = "string";
    return [
      { header: "کد", render: (r) => toFaDigits(r.code), sortValue: (r) => r.code, width: "100px", filterType: str, filterValue: (r) => r.code },
      { header: "طرف حساب", render: (r) => r.title, sortValue: (r) => r.title, filterType: str, filterValue: (r) => r.title },
      { header: "ارز", fxOnly: true, render: (r) => r.currencyTitle, sortValue: (r) => r.currencyTitle, width: "90px", filterType: str, filterValue: (r) => r.currencyTitle },
      numCol<PartyRow>("مانده ابتدا", "openingBalance", true),
      numCol<PartyRow>(`${word} و افزایش`, "inflow"),
      numCol<PartyRow>("تقلیل", "reduce"),
      numCol<PartyRow>("ابطال", "cancel"),
      numCol<PartyRow>("استرداد", "ret"),
      numCol<PartyRow>("مانده", "closingBalance", true),
    ];
  }, [word]);

  const instrumentColumns = useMemo((): BalanceTableColumn<InstrumentRow>[] => {
    const str: ColumnFilterType = "string";
    return [
      { header: "طرف حساب", render: (r) => r.partyTitle, sortValue: (r) => r.partyTitle, filterType: str, filterValue: (r) => r.partyTitle },
      { header: "نوع", render: (r) => r.type, sortValue: (r) => r.type, width: "90px", filterType: str, filterValue: (r) => r.type },
      { header: "شماره", render: (r) => toFaDigits(r.number), sortValue: (r) => r.number, filterType: str, filterValue: (r) => r.number },
      { header: "نوع تضمین", render: (r) => r.guaranteeTypeTitle, sortValue: (r) => r.guaranteeTypeTitle, filterType: str, filterValue: (r) => r.guaranteeTypeTitle },
      { header: "سند", render: (r) => (r.isOpening ? "افتتاحیه" : toFaDigits(String(r.documentNumber))), sortValue: (r) => r.documentNumber, width: "90px", filterType: "number", filterValue: (r) => r.documentNumber },
      { header: "تاریخ سند", render: (r) => formatJalaliDate(r.documentDate), sortValue: (r) => r.documentDate, width: "110px", filterType: "date", filterValue: (r) => r.documentDate?.slice(0, 10) },
      { header: "ارز", fxOnly: true, render: (r) => r.currencyTitle, sortValue: (r) => r.currencyTitle, width: "90px", filterType: str, filterValue: (r) => r.currencyTitle },
      { header: "مبلغ اولیه", render: (r) => formatAmountFa(r.originalAmount), sortValue: (r) => r.originalAmount, filterType: "number", filterValue: (r) => r.originalAmount, decimal: false },
      {
        header: "سررسید فعلی",
        render: (r) => <span style={{ color: DUE_COLOR[r.dueState], fontWeight: DUE_COLOR[r.dueState] ? 600 : undefined }}>{r.dueDate ? formatJalaliDate(r.dueDate) : "—"}</span>,
        sortValue: (r) => r.dueDate ?? "",
        width: "120px",
        filterType: "date",
        filterValue: (r) => r.dueDate?.slice(0, 10) ?? "",
      },
      { header: "وضعیت", render: (r) => r.status, sortValue: (r) => r.status, width: "100px", filterType: str, filterValue: (r) => r.status },
      numCol<InstrumentRow>("مانده ابتدا", "openingBalance", true),
      numCol<InstrumentRow>(`${word} و افزایش`, "inflow"),
      numCol<InstrumentRow>("تقلیل", "reduce"),
      numCol<InstrumentRow>("ابطال", "cancel"),
      numCol<InstrumentRow>("استرداد", "ret"),
      numCol<InstrumentRow>("مانده", "closingBalance", true),
    ];
  }, [word]);

  const infoText =
    `گردش و مانده‌ی ضمانت‌نامه‌ها، چک‌ها و سفته‌های ${word}ی — در تب «طرف حساب» یک یا چند ردیف را انتخاب کنید تا تب «ابزار» و «گردش» فقط برای همان‌ها نشان داده شود. ` +
    "مانده‌ی ابتدا از همه‌ی سال‌های قبل حساب می‌شود و ضمانت‌نامه‌های افتتاحیه (استقرار) در مانده‌ی ابتدا می‌آیند. مانده = مجموع مبلغ فعلی ابزارهای ابطال/استردادنشده. " +
    "مبالغ به ارز خودِ ابزار است. گزینه‌های هر بخش فیلتر (وضعیت، سررسید) با «یا» ترکیب می‌شوند و بخش‌ها با «و»؛ بخشی که هیچ گزینه‌ای تیک نداشته باشد هیچ داده‌ای نشان نمی‌دهد. سررسید نسبت به امروز و روی سررسید فعلی (بعد از تمدیدها) است و ابزارهای ابطال‌شده یا مسترد در فیلتر سررسید نمی‌آیند.";

  return (
    <div>
      <ErrorToast message={error} />

      <div className="card ar-filters">
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
          <div className="form-field-inline">
            <label>از تاریخ</label>
            <JalaliDatePicker value={filters.fromDate} onChange={(v) => { if (v !== filters.fromDate) patchFilters({ fromDate: v }); }} />
          </div>
          <div className="form-field-inline">
            <label>تا تاریخ</label>
            <JalaliDatePicker value={filters.toDate} onChange={(v) => { if (v !== filters.toDate) patchFilters({ toDate: v }); }} />
          </div>
          <fieldset style={{ border: "1px solid var(--border, #ccc)", borderRadius: 6, padding: "4px 12px 6px", margin: 0 }}>
            <legend style={{ fontSize: 12, padding: "0 6px" }}>وضعیت</legend>
            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              {STATUS_OPTIONS.map((o) => (
                <label key={o.v} style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                  <input type="checkbox" checked={filters.status.includes(o.v)} onChange={(e) => patchFilters({ status: e.target.checked ? [...filters.status, o.v] : filters.status.filter((x) => x !== o.v) })} />
                  {o.t}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset style={{ border: "1px solid var(--border, #ccc)", borderRadius: 6, padding: "4px 12px 6px", margin: 0 }}>
            <legend style={{ fontSize: 12, padding: "0 6px" }}>سررسید</legend>
            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              {DUE_OPTIONS.map((o) => (
                <label key={o.v} style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                  <input type="checkbox" checked={filters.due.includes(o.v)} onChange={(e) => patchFilters({ due: e.target.checked ? [...filters.due, o.v] : filters.due.filter((x) => x !== o.v) })} />
                  {o.t}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </div>

      <ChainedTabsBar
        tabs={tabDefs}
        activeIndex={activeTab}
        onChange={setActiveTab}
        actions={
          <>
            <InfoHint text={infoText} title={title} />
            <RefreshButton onClick={refreshCurrentTab} title="رفرش تب جاری" />
          </>
        }
        onClearFilters={clearFilters}
      />

      {activeTab === PARTY_TAB && (
        <SelectableBalanceTable
          stateKey={PARTY_TAB}
          rows={(tabData[PARTY_TAB] || []) as PartyRow[]}
          columns={partyColumns}
          selected={chain.get(PARTY_TAB)}
          onToggle={(id: SelectId) => chain.toggle(PARTY_TAB, id)}
          loading={tabLoader.loading}
          restoreFilters={tabView.restoreFilters}
          restoreSort={tabView.restoreSort}
          onFiltersChange={tabView.onFiltersChange}
          onSortChange={tabView.onSortChange}
        />
      )}

      {activeTab === INSTRUMENT_TAB && (
        <SelectableBalanceTable
          stateKey={INSTRUMENT_TAB}
          rows={(tabData[INSTRUMENT_TAB] || []) as InstrumentRow[]}
          columns={instrumentColumns}
          selected={chain.get(INSTRUMENT_TAB)}
          onToggle={(id: SelectId) => chain.toggle(INSTRUMENT_TAB, id)}
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
          columns={ledgerColumns}
          selectable={false}
          onRowDoubleClick={(r) => r.openPath && openTab(r.openPath)}
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
            onSortChange: (sort) => {
              setLedgerSort(sort);
              loadLedger(1, ledgerPageSize, sort, ledgerFilters);
            },
            onFiltersChange: (f) => {
              setLedgerFilters(f);
              loadLedger(1, ledgerPageSize, ledgerSort, f);
            },
          }}
        />
      )}
    </div>
  );
}
