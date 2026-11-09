import { useEffect, useMemo, useRef, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { ChainedTabsBar } from "../components/ChainedTabsBar";
import { SelectableBalanceTable, BalanceTableColumn } from "../components/SelectableBalanceTable";
import { RefreshButton } from "../components/RefreshButton";
import { InfoHint } from "../components/InfoHint";
import { useChainedMultiSelect, SelectId } from "../lib/useChainedMultiSelect";
import { getQuoteReviewSnapshot, setQuoteReviewSnapshot } from "../lib/quoteReviewCache";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { resolveReviewDateRange, FiscalPeriodRange } from "../lib/fiscalYearDefaultDate";
import { useReviewTabLoader, useReviewTabActivation, useReviewTabViewState, serializeForDepsKey } from "../lib/useReviewTabLoader";
import { useTabs } from "../lib/TabsContext";
import { api } from "../lib/api";
import { ColumnFilterType } from "../components/DataTable";
import { Modal } from "../components/Modal";

// «مرور پیش‌فاکتور» (فروش › گزارش) — هم‌الگوی «مرور فروش/خرید» (ChainedTabsBar + useChainedMultiSelect): تب‌های زنجیره‌ای مرکز فروش ←
// نوع فروش ← مشتری ← کالا ← اقلام؛ انتخاب ردیف در یک تب، تب‌های بعدی را فیلتر می‌کند. قواعد در backend/src/services/quoteReviewService.ts.
// مبالغ به ارز پیش‌فاکتورند (ستون «ارز»)، پس تب‌های تجمعی به‌ازای هر ارز یک سطر دارند.

const CENTER_TAB = 0;
const TYPE_TAB = 1;
const CUSTOMER_TAB = 2;
const GOODS_TAB = 3;
const ITEMS_TAB = 4;
const TAB_LABELS = ["مرکز فروش", "نوع فروش", "مشتری", "کالا", "اقلام"];
const ENDPOINTS = ["sales-centers", "sales-types", "customers", "goods-items", "items"];

const INFO_TEXT =
  "پیگیری سرنوشت پیش‌فاکتورهای تاییدشده. «سفارش‌شده» از سفارش‌های فروش، «حواله‌شده» از حواله‌های فروش (مستقیم یا از راه سفارش؛ فقط کالا) و «فاکتورشده» از فاکتورهای فروش ابطال‌نشده (مستقیم، از راه سفارش یا حواله) می‌آید. مبلغ‌ها پس از تخفیف و به ارز پیش‌فاکتورند و «بستن پیگیری» و برگشت از فروش در مانده‌ها اثر ندارند. فیلتر تاریخ روی تاریخ پیش‌فاکتور است؛ برای باز کردن پیش‌فاکتور روی ردیف تب «اقلام» دوبار کلیک کنید.";

interface Row {
  id: SelectId;
  code?: number | string | null;
  title?: string | null;
  currency?: string;
  salesCenterId?: number;
  salesTypeId?: number;
  customerId?: number;
  goodsItemId?: number;
  quoteId?: number;
  number?: number;
  date?: string;
  salesCenterTitle?: string;
  salesTypeTitle?: string;
  customerTitle?: string;
  goodsItemCode?: string;
  goodsItemTitle?: string;
  goodsGroupTitle?: string;
  unitTitle?: string;
  accountingGroupTitle?: string;
  [k: string]: any;
}

type DocKind = "orders" | "deliveries" | "invoices";
interface DocsDetail {
  kind: DocKind;
  canOpen: boolean;
  currency: string;
  title: string;
  withQuote: boolean;
  rows: { id: string; documentId: number; number: number; date: string; quoteNumber: number; quantity: number; amount: number | null }[];
}
const DOC_TEXT: Record<DocKind, { title: string; open: string; path: (id: number) => string }> = {
  orders: { title: "سفارش‌های فروش", open: "باز کردن سفارش", path: (id) => `/sales-orders/${id}/edit` },
  deliveries: { title: "حواله‌های فروش", open: "باز کردن حواله", path: (id) => `/sales-deliveries/${id}/edit` },
  invoices: { title: "فاکتورهای فروش", open: "باز کردن فاکتور", path: (id) => `/sales-invoices/${id}/edit` },
};
type ShowDocs = (kind: DocKind, row: Row) => void;

// ستون‌های «انجام‌شده» (سفارش/حواله/فاکتور) لینک‌اند و ریز اسناد را در مودال نشان می‌دهند (مثل آنالیز موجودی)
function numCol(header: string, field: string, docKind?: DocKind, showRef?: { current: ShowDocs }): BalanceTableColumn<Row> {
  return {
    header,
    render: (r) => {
      const v = (r[field] as number) || 0;
      if (!docKind || !showRef || v === 0) return formatAmountFa(v);
      return (
        <a href="#" style={{ textDecoration: "underline", cursor: "pointer" }} title="نمایش اسناد" onClick={(e) => { e.preventDefault(); e.stopPropagation(); showRef.current(docKind, r); }}>
          {formatAmountFa(v)}
        </a>
      );
    },
    sortValue: (r) => (r[field] as number) || 0,
    filterType: "number",
    filterValue: (r) => (r[field] as number) || 0,
    decimal: true,
  };
}

const numericCols = (ref: { current: ShowDocs }): BalanceTableColumn<Row>[] => [
  numCol("مقدار پیش‌فاکتور", "quantity"),
  numCol("مبلغ پیش‌فاکتور", "amount"),
  numCol("مقدار سفارش‌شده", "orderedQuantity", "orders", ref),
  numCol("مبلغ سفارش‌شده", "orderedAmount", "orders", ref),
  numCol("مقدار حواله‌شده", "deliveredQuantity", "deliveries", ref),
  numCol("مقدار فاکتورشده", "invoicedQuantity", "invoices", ref),
  numCol("مبلغ فاکتورشده", "invoicedAmount", "invoices", ref),
  numCol("مانده سفارش‌نشده", "notOrderedQuantity"),
  numCol("مبلغ سفارش‌نشده", "notOrderedAmount"),
  numCol("مانده حواله‌نشده", "notDeliveredQuantity"),
  numCol("مانده فاکتورنشده", "notInvoicedQuantity"),
  numCol("مبلغ فاکتورنشده", "notInvoicedAmount"),
];

const str: ColumnFilterType = "string";
function textCol(header: string, get: (r: Row) => string, width?: string): BalanceTableColumn<Row> {
  return { header, render: (r) => get(r) || "—", sortValue: (r) => get(r), filterType: str, filterValue: (r) => get(r), ...(width ? { width } : {}) };
}

export default function QuoteReview() {
  const { openTab } = useTabs();
  const snapshot = getQuoteReviewSnapshot();
  const [periodsLoaded, setPeriodsLoaded] = useState(false);
  const [filters, setFilters] = useState(snapshot?.filters ?? { fromDate: "", toDate: "" });
  const [activeTab, setActiveTab] = useState(snapshot?.activeTab ?? 0);
  const [tabData, setTabData] = useState<Record<number, Row[]>>((snapshot?.tabData as Record<number, Row[]>) ?? {});
  const tabLoader = useReviewTabLoader(snapshot?.loadedTabs ?? []);
  const [error, setError] = useState<string | null>(null);
  const [docs, setDocs] = useState<DocsDetail | null>(null);
  const showRef = useRef<ShowDocs>(() => {});
  const chain = useChainedMultiSelect(snapshot?.chainState);
  const tabView = useReviewTabViewState(activeTab, snapshot?.tabViewState ?? {});

  useEffect(() => {
    setQuoteReviewSnapshot({
      chainState: { selections: chain.selections, order: chain.order },
      activeTab,
      filters,
      tabData,
      tabViewState: tabView.viewState,
      loadedTabs: Array.from(tabLoader.loadedTabs),
    });
  }, [chain.selections, chain.order, activeTab, filters, tabData, tabView.viewState, tabLoader.loadedTabs]);

  useEffect(() => {
    (async () => {
      const per: FiscalPeriodRange[] = await api.get("/fiscal-periods");
      setPeriodsLoaded(true);
      setFilters((prev) => (prev.fromDate ? prev : resolveReviewDateRange(per)));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // فیلتر مؤثر روی هر تب = انتخاب‌های تب‌های «قبلی» زنجیره (همان collectFilters مرور خرید)
  function buildParams(tabIndex: number) {
    const centers = new Set<string>();
    const types = new Set<string>();
    const customers = new Set<string>();
    const goods = new Set<string>();
    for (const t of chain.tabsBefore(tabIndex)) {
      const rows = tabData[t] || [];
      for (const id of chain.get(t)) {
        const row = rows.find((r) => String(r.id) === String(id));
        if (!row) continue;
        if (t === CENTER_TAB && row.salesCenterId != null) centers.add(String(row.salesCenterId));
        if (t === TYPE_TAB && row.salesTypeId != null) types.add(String(row.salesTypeId));
        if (t === CUSTOMER_TAB && row.customerId != null) customers.add(String(row.customerId));
        if (t === GOODS_TAB && row.goodsItemId != null) goods.add(String(row.goodsItemId));
      }
    }
    const p = new URLSearchParams();
    p.set("fromDate", filters.fromDate);
    p.set("toDate", filters.toDate);
    if (centers.size) p.set("salesCenterIds", Array.from(centers).join(","));
    if (types.size) p.set("salesTypeIds", Array.from(types).join(","));
    if (customers.size) p.set("customerIds", Array.from(customers).join(","));
    if (goods.size) p.set("goodsItemIds", Array.from(goods).join(","));
    return p;
  }

  // ریز اسناد سلول کلیک‌شده: فیلترهای زنجیره + سطر (ردیف پیش‌فاکتور در تب اقلام، وگرنه بُعد سطر × ارز)
  showRef.current = async (kind, row) => {
    try {
      const p = buildParams(activeTab);
      if (activeTab === ITEMS_TAB) p.set("lineId", String(row.id));
      else {
        p.set("currencyId", String(row.currencyId));
        const dim = ["salesCenterId", "salesTypeId", "customerId", "goodsItemId"][activeTab];
        if (row[dim] != null) p.set(dim, String(row[dim]));
      }
      const r = await api.get(`/quote-review-docs/${kind}?${p.toString()}`);
      setDocs({ ...r, title: DOC_TEXT[kind].title, withQuote: activeTab !== ITEMS_TAB });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  async function loadTab(tabIndex: number) {
    await tabLoader.run(
      tabIndex,
      async (isStale) => {
        const data = await api.get(`/quote-review/${ENDPOINTS[tabIndex]}?${buildParams(tabIndex).toString()}`);
        if (isStale()) return;
        setTabData((prev) => ({ ...prev, [tabIndex]: data }));
      },
      setError
    );
  }

  const activationDepsKey = useMemo(() => serializeForDepsKey({ upstream: chain.upstream(activeTab), filters }), [chain.selections, chain.order, activeTab, filters]);
  useReviewTabActivation(periodsLoaded && !!filters.fromDate, activeTab, tabLoader.loadedTabs, (tab) => loadTab(tab), activationDepsKey);

  function clearFilters() {
    chain.reset();
    setTabData({});
    tabView.reset();
    tabLoader.resetLoaded();
    setActiveTab(0);
  }

  // تغییر بازه‌ی تاریخ فقط داده‌ی بارگذاری‌شده را باطل می‌کند؛ انتخاب‌ها و فیلتر ستون‌ها می‌مانند
  function invalidateData() {
    setTabData({});
    tabLoader.resetLoaded();
  }

  const tabDefs = TAB_LABELS.map((label, idx) => ({ key: `qr-${idx}`, label, count: idx === ITEMS_TAB ? 0 : chain.get(idx).size }));

  const columns = useMemo((): BalanceTableColumn<Row>[] => {
    if (activeTab === ITEMS_TAB) {
      return [
        { header: "شماره", render: (r) => toFaDigits(String(r.number)), sortValue: (r) => r.number || 0, width: "80px", filterType: "number", filterValue: (r) => r.number ?? null },
        { header: "تاریخ", render: (r) => (r.date ? formatJalaliDate(r.date) : "—"), sortValue: (r) => r.date || "", filterType: "date", filterValue: (r) => r.date?.slice(0, 10) },
        textCol("ارز", (r) => r.currency || "", "80px"),
        textCol("مرکز فروش", (r) => r.salesCenterTitle || ""),
        textCol("نوع فروش", (r) => r.salesTypeTitle || ""),
        textCol("مشتری", (r) => r.customerTitle || ""),
        textCol("کد کالا", (r) => r.goodsItemCode || "", "110px"),
        textCol("عنوان کالا", (r) => r.goodsItemTitle || ""),
        textCol("گروه کالا", (r) => r.goodsGroupTitle || ""),
        textCol("واحد سنجش", (r) => r.unitTitle || "", "90px"),
        textCol("گروه حسابداری", (r) => r.accountingGroupTitle || ""),
        ...numericCols(showRef),
      ];
    }
    return [
      { header: "کد", render: (r) => (r.code != null ? toFaDigits(String(r.code)) : "—"), sortValue: (r) => r.code ?? "", width: "100px", filterType: str, filterValue: (r) => (r.code != null ? String(r.code) : "") },
      textCol("عنوان", (r) => r.title || ""),
      textCol("ارز", (r) => r.currency || "", "80px"),
      ...numericCols(showRef),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  return (
    <div>
      <ErrorToast message={error} />
      <div className="card ar-filters">
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
          <div className="form-field-inline">
            <label>از تاریخ</label>
            <JalaliDatePicker value={filters.fromDate} onChange={(v) => { if (v === filters.fromDate) return; setFilters((p) => ({ ...p, fromDate: v })); invalidateData(); }} />
          </div>
          <div className="form-field-inline">
            <label>تا تاریخ</label>
            <JalaliDatePicker value={filters.toDate} onChange={(v) => { if (v === filters.toDate) return; setFilters((p) => ({ ...p, toDate: v })); invalidateData(); }} />
          </div>
        </div>
      </div>

      <ChainedTabsBar
        tabs={tabDefs}
        activeIndex={activeTab}
        onChange={setActiveTab}
        actions={
          <>
            <InfoHint text={INFO_TEXT} title="مرور پیش‌فاکتور" />
            <RefreshButton onClick={() => loadTab(activeTab)} title="رفرش تب جاری" />
          </>
        }
        onClearFilters={clearFilters}
      />

      <SelectableBalanceTable
        stateKey={activeTab}
        rows={tabData[activeTab] || []}
        columns={columns}
        selectable={activeTab !== ITEMS_TAB}
        selected={chain.get(activeTab)}
        onToggle={(id: SelectId) => chain.toggle(activeTab, id)}
        onRowDoubleClick={activeTab === ITEMS_TAB ? (r) => r.quoteId != null && openTab(`/sales-quotes/${r.quoteId}/edit`) : undefined}
        loading={tabLoader.loading}
        restoreFilters={tabView.restoreFilters}
        restoreSort={tabView.restoreSort}
        onFiltersChange={tabView.onFiltersChange}
        onSortChange={tabView.onSortChange}
      />
      {docs && (
        <Modal title={`${docs.title} (${docs.currency})`} onClose={() => setDocs(null)}>
          <div style={{ maxHeight: "60vh", overflow: "auto" }}>
            <table className="data-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>شماره</th>
                  <th>تاریخ</th>
                  {docs.withQuote && <th>پیش‌فاکتور</th>}
                  <th>مقدار</th>
                  {docs.kind !== "deliveries" && <th>مبلغ</th>}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {docs.rows.map((d) => (
                  <tr key={d.id}>
                    <td>{toFaDigits(String(d.number))}</td>
                    <td>{formatJalaliDate(d.date)}</td>
                    {docs.withQuote && <td>{toFaDigits(String(d.quoteNumber))}</td>}
                    <td>{formatAmountFa(d.quantity)}</td>
                    {docs.kind !== "deliveries" && <td>{formatAmountFa(d.amount ?? 0)}</td>}
                    <td>
                      {docs.canOpen && (
                        <button type="button" className="btn secondary" style={{ padding: "3px 10px", fontSize: 12 }} onClick={() => openTab(DOC_TEXT[docs.kind].path(d.documentId))}>
                          {DOC_TEXT[docs.kind].open}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {docs.rows.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", opacity: 0.7 }}>سندی یافت نشد</td>
                  </tr>
                )}
              </tbody>
              {docs.rows.length > 1 && (
                <tfoot>
                  <tr>
                    <td colSpan={docs.withQuote ? 3 : 2} style={{ textAlign: "end" }}>جمع</td>
                    <td>{formatAmountFa(docs.rows.reduce((a, d) => a + d.quantity, 0))}</td>
                    {docs.kind !== "deliveries" && <td>{formatAmountFa(docs.rows.reduce((a, d) => a + (d.amount ?? 0), 0))}</td>}
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
}
