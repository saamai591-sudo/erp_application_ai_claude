import { useEffect, useMemo, useState } from "react";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { ChainedTabsBar } from "../components/ChainedTabsBar";
import { SelectableBalanceTable, BalanceTableColumn } from "../components/SelectableBalanceTable";
import { RefreshButton } from "../components/RefreshButton";
import { InfoHint } from "../components/InfoHint";
import { ExcelExportIcon, PrintIcon } from "../components/GridExportIcons";
import { useChainedMultiSelect, SelectId } from "../lib/useChainedMultiSelect";
import { getSalesReviewSnapshot, setSalesReviewSnapshot } from "../lib/salesReviewCache";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { toEnglishDigits } from "../lib/digits";
import { resolveReviewDateRange, FiscalPeriodRange } from "../lib/fiscalYearDefaultDate";
import { useReviewTabLoader, useReviewTabActivation, useReviewTabViewState, serializeForDepsKey } from "../lib/useReviewTabLoader";
import { useTabs } from "../lib/TabsContext";
import { api } from "../lib/api";
import { ColumnFilterType } from "../components/DataTable";

// گزارش «مرور فروش» — طبق Documents/SalesReviewReport.md، دقیقاً هم‌فرمت «مرور حسابها»/«مرور تعدادی-
// مبلغی انبار» (ChainedTabsBar + useChainedMultiSelect): تب‌های زنجیره‌ای، انتخاب چند ردیف در یک تب،
// فیلترِ تب‌های بعدی/قبلی را اعمال می‌کند. منبع داده: SalesInvoiceLine (services/salesReviewService.ts
// سمت بک‌اند) — همه‌ی مبالغ از قبل به ارز پایه ذخیره شده‌اند، پس نیازی به تبدیل ارز اینجا نیست.
//
// طبق تصمیم صریح کاربر: «برگشت از فروش» در این فاز اصلاً وصل نمی‌شود — ستون‌های «مقدار برگشتی»/«مبلغ
// برگشتی» همیشه صفر هستند (نگاه کنید به یادداشت بالای backend/src/services/salesReviewService.ts).

interface DimRow {
  id: SelectId;
  code?: number | string | null;
  title?: string | null;
  salesCenterId?: number;
  salesTypeId?: number;
  customerId?: number;
  goodsGroupId?: number;
  accountingGroupId?: number;
  goodsItemId?: number;
  goodsItemIds?: number[];
  salesInvoiceId?: number;
  number?: number;
  date?: string;
  customerCode?: number;
  customerTitle?: string;
  quantity: number;
  returnedQuantity: number;
  netQuantity: number;
  amount: number;
  returnedAmount: number;
  discount: number;
  netAmount: number;
  vatAmount: number;
  netTotal: number;
}

interface LedgerRow {
  type: string;
  salesInvoiceId: number;
  number: number;
  date: string;
  customerCode: number;
  customerTitle: string;
  goodsItemCode: string;
  goodsItemTitle: string;
  unitTitle: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  discount: number;
  netAmount: number;
  vatAmount: number;
  netTotal: number;
}

const SALES_CENTER_TAB = 0;
const SALES_TYPE_TAB = 1;
const CUSTOMER_TAB = 2;
const GOODS_GROUP_TAB = 3;
const ACCOUNTING_GROUP_TAB = 4;
const GOODS_ITEM_TAB = 5;
const DOCUMENTS_TAB = 6;
const LEDGER_TAB = 7;

const TAB_LABELS = ["مرکز فروش", "نوع فروش", "مشتری", "گروه کالا", "گروه حسابداری", "کالا", "اسناد", "گردش"];

const INFO_TEXT =
  "گزارش سلسله‌مراتبی فروش — در هر تب چندین ردیف قابل انتخاب است تا تب‌های بعدی (و تب‌های «اسناد»/«گردش») بر اساس آن فیلتر شوند. " +
  "همه‌ی مبالغ به ارز پایه نمایش داده می‌شوند. مقدار/مبلغ برگشتی در این فاز همیشه صفر است (برگشت از فروش هنوز به این گزارش وصل نشده است).";

const LEDGER_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function dimEndpoint(tabIndex: number): string {
  switch (tabIndex) {
    case SALES_CENTER_TAB:
      return "/sales-review/sales-centers";
    case SALES_TYPE_TAB:
      return "/sales-review/sales-types";
    case CUSTOMER_TAB:
      return "/sales-review/customers";
    case GOODS_GROUP_TAB:
      return "/sales-review/goods-groups";
    case ACCOUNTING_GROUP_TAB:
      return "/sales-review/accounting-groups";
    case GOODS_ITEM_TAB:
      return "/sales-review/goods-items";
    case DOCUMENTS_TAB:
      return "/sales-review/documents";
    default:
      return "";
  }
}

function numCol(header: string, field: keyof DimRow): BalanceTableColumn<DimRow> {
  return {
    header,
    render: (r) => formatAmountFa((r[field] as number) || 0),
    sortValue: (r) => (r[field] as number) || 0,
    filterType: "number",
    filterValue: (r) => (r[field] as number) || 0,
    decimal: true,
  };
}

export default function SalesReview() {
  const { openTab } = useTabs();
  const snapshot = getSalesReviewSnapshot();
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
  const [error, setError] = useState<string | null>(null);

  const chain = useChainedMultiSelect(snapshot?.chainState);
  const tabView = useReviewTabViewState(activeTab, snapshot?.tabViewState ?? {});

  useEffect(() => {
    setSalesReviewSnapshot({
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
    });
  }, [chain.selections, chain.order, activeTab, filters, tabData, tabView.viewState, tabLoader.loadedTabs, ledgerRows, ledgerPage, ledgerPageSize, ledgerTotal, ledgerTotalPages]);

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

  /** فیلترهای مؤثر روی tabIndex: از هر تبی که «پیش‌تر» لمس شده، بر اساس ردیف‌های واقعاً انتخاب‌شده،
   * مقدار فیلتر متناظر استخراج می‌شود — دقیقاً هم‌الگوی collectFilters در WarehouseReview.tsx. تب‌های
   * «گروه کالا»/«گروه حسابداری» به‌جای یک goodsItemId تکی، goodsItemIds زیرمجموعه‌ی خودشان را دارند. */
  function collectFilters(tabIndex: number) {
    const salesCenterIds = new Set<string>();
    const salesTypeIds = new Set<string>();
    const customerIds = new Set<string>();
    const goodsItemIds = new Set<string>();
    const invoiceIds = new Set<string>();
    for (const t of chain.tabsBefore(tabIndex)) {
      if (t === LEDGER_TAB) continue;
      const rows = tabData[t] || [];
      for (const id of chain.get(t)) {
        const row = rows.find((r) => String(r.id) === String(id));
        if (!row) continue;
        if (t === SALES_CENTER_TAB && row.salesCenterId != null) salesCenterIds.add(String(row.salesCenterId));
        if (t === SALES_TYPE_TAB && row.salesTypeId != null) salesTypeIds.add(String(row.salesTypeId));
        if (t === CUSTOMER_TAB && row.customerId != null) customerIds.add(String(row.customerId));
        if ((t === GOODS_GROUP_TAB || t === ACCOUNTING_GROUP_TAB) && row.goodsItemIds) row.goodsItemIds.forEach((gid) => goodsItemIds.add(String(gid)));
        if (t === GOODS_ITEM_TAB && row.goodsItemId != null) goodsItemIds.add(String(row.goodsItemId));
        if (t === DOCUMENTS_TAB && row.salesInvoiceId != null) invoiceIds.add(String(row.salesInvoiceId));
      }
    }
    return { salesCenterIds, salesTypeIds, customerIds, goodsItemIds, invoiceIds };
  }

  function buildParams(tabIndex: number) {
    const p = new URLSearchParams();
    p.set("fromDate", filters.fromDate);
    p.set("toDate", filters.toDate);
    const f = collectFilters(tabIndex);
    if (f.salesCenterIds.size) p.set("salesCenterIds", Array.from(f.salesCenterIds).join(","));
    if (f.salesTypeIds.size) p.set("salesTypeIds", Array.from(f.salesTypeIds).join(","));
    if (f.customerIds.size) p.set("customerIds", Array.from(f.customerIds).join(","));
    if (f.goodsItemIds.size) p.set("goodsItemIds", Array.from(f.goodsItemIds).join(","));
    if (f.invoiceIds.size) p.set("invoiceIds", Array.from(f.invoiceIds).join(","));
    return p;
  }

  async function loadDimTab(tabIndex: number) {
    await tabLoader.run(
      tabIndex,
      async (isStale) => {
        const p = buildParams(tabIndex);
        const data = await api.get(`${dimEndpoint(tabIndex)}?${p.toString()}`);
        if (isStale()) return;
        setTabData((prev) => ({ ...prev, [tabIndex]: data }));
      },
      setError
    );
  }

  async function loadLedger(page = 1, pageSize = ledgerPageSize) {
    await tabLoader.run(
      LEDGER_TAB,
      async (isStale) => {
        const p = buildParams(LEDGER_TAB);
        p.set("page", String(page));
        p.set("pageSize", String(pageSize));
        const data = await api.get(`/sales-review/ledger?${p.toString()}`);
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

  function changeLedgerPageSize(size: number) {
    loadLedger(1, size);
  }

  const activationDepsKey = useMemo(
    () => serializeForDepsKey({ selections: chain.selections, order: chain.order, filters }),
    [chain.selections, chain.order, filters]
  );
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

  function onToggleRow(id: SelectId) {
    chain.toggle(activeTab, id);
  }

  // «حذف همه فیلترها»: دقیقاً هم‌مقیاس نسخه‌ی نهایی/اصلاح‌شده در AccountsReview/WarehouseReview —
  // انتخاب‌های زنجیره‌ای هم یک فیلتر محسوب می‌شوند (نه فقط فیلترهای ستونی)، فقط بازه‌ی «از تاریخ/تا
  // تاریخ» بالای گزارش دست‌نخورده می‌ماند.
  function clearFilters() {
    chain.reset();
    setTabData({});
    tabView.reset();
    setLedgerRows([]);
    setLedgerPage(1);
    tabLoader.resetLoaded();
    setActiveTab(0);
  }

  const tabDefs = TAB_LABELS.map((label, idx) => ({
    key: `sr-${idx}`,
    label,
    count: idx === LEDGER_TAB ? 0 : chain.get(idx).size,
  }));

  const columns = useMemo((): BalanceTableColumn<DimRow>[] => {
    const strFilter: ColumnFilterType = "string";
    const prefix: BalanceTableColumn<DimRow>[] = [];

    if (activeTab === DOCUMENTS_TAB) {
      prefix.push(
        { header: "شماره", render: (r) => toFaDigits(String(r.number)), sortValue: (r) => r.number || 0, width: "80px", filterType: "number", filterValue: (r) => r.number ?? null },
        { header: "تاریخ", render: (r) => (r.date ? formatJalaliDate(r.date) : "—"), sortValue: (r) => r.date || "", filterType: "date", filterValue: (r) => r.date?.slice(0, 10) },
        { header: "کد مشتری", render: (r) => (r.customerCode != null ? toFaDigits(String(r.customerCode)) : "—"), sortValue: (r) => r.customerCode ?? 0, filterType: "number", filterValue: (r) => r.customerCode ?? null },
        { header: "عنوان مشتری", render: (r) => r.customerTitle || "—", sortValue: (r) => r.customerTitle || "", filterType: strFilter, filterValue: (r) => r.customerTitle || "" }
      );
      return [
        ...prefix,
        numCol("مبلغ", "amount"),
        numCol("تخفیف", "discount"),
        numCol("خالص فروش", "netAmount"),
        numCol("ارزش افزوده", "vatAmount"),
        numCol("خالص", "netTotal"),
      ];
    }

    prefix.push(
      { header: "کد", render: (r) => (r.code != null ? toFaDigits(String(r.code)) : "—"), sortValue: (r) => r.code ?? "", width: "100px", filterType: strFilter, filterValue: (r) => (r.code != null ? String(r.code) : "") },
      { header: "عنوان", render: (r) => r.title || "—", sortValue: (r) => r.title || "", filterType: strFilter, filterValue: (r) => r.title || "" }
    );

    return [
      ...prefix,
      numCol("مقدار", "quantity"),
      numCol("مقدار برگشتی", "returnedQuantity"),
      numCol("خالص فروش - مقدار", "netQuantity"),
      numCol("مبلغ فروش", "amount"),
      numCol("مبلغ برگشتی", "returnedAmount"),
      numCol("تخفیف", "discount"),
      numCol("خالص فروش", "netAmount"),
      numCol("ارزش افزوده", "vatAmount"),
      numCol("خالص", "netTotal"),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const ledgerQuantityTotal = ledgerRows.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
  const ledgerAmountTotal = ledgerRows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const ledgerDiscountTotal = ledgerRows.reduce((s, r) => s + (Number(r.discount) || 0), 0);
  const ledgerNetAmountTotal = ledgerRows.reduce((s, r) => s + (Number(r.netAmount) || 0), 0);
  const ledgerVatTotal = ledgerRows.reduce((s, r) => s + (Number(r.vatAmount) || 0), 0);
  const ledgerNetTotalTotal = ledgerRows.reduce((s, r) => s + (Number(r.netTotal) || 0), 0);

  async function exportLedgerCsv() {
    setError(null);
    try {
      const p = buildParams(LEDGER_TAB);
      p.set("page", "1");
      p.set("pageSize", "100000");
      const data = await api.get(`/sales-review/ledger?${p.toString()}`);
      const header = ["نوع", "شماره", "تاریخ", "کد مشتری", "عنوان مشتری", "کد کالا", "کالا", "واحد", "مقدار", "فی", "مبلغ", "تخفیف", "خالص فروش", "ارزش افزوده", "خالص"];
      const rows = data.rows.map((r: LedgerRow) => [
        r.type, r.number, toEnglishDigits(formatJalaliDate(r.date)), r.customerCode, r.customerTitle, r.goodsItemCode, r.goodsItemTitle, r.unitTitle,
        r.quantity, r.unitPrice, r.amount, r.discount, r.netAmount, r.vatAmount, r.netTotal,
      ]);
      const csv = [header, ...rows].map((row) => row.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "گردش-فروش.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div>
      {error && <div className="alert error">{error}</div>}

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
            <InfoHint text={INFO_TEXT} title="مرور فروش" />
            <RefreshButton onClick={refreshCurrentTab} title="رفرش تب جاری" />
            {activeTab === LEDGER_TAB && (
              <>
                <button type="button" className="toolbar-icon-btn" onClick={exportLedgerCsv} title="خروجی اکسل">
                  <ExcelExportIcon />
                </button>
                <button type="button" className="toolbar-icon-btn" onClick={() => window.print()} title="چاپ">
                  <PrintIcon />
                </button>
              </>
            )}
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
          onToggle={onToggleRow}
          loading={tabLoader.loading}
          restoreFilters={tabView.restoreFilters}
          restoreSort={tabView.restoreSort}
          onFiltersChange={tabView.onFiltersChange}
          onSortChange={tabView.onSortChange}
        />
      )}

      {activeTab === LEDGER_TAB && (
        <div className="datatable-root">
          <div className="grid-wrap">
            <div className="card grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }}>
              {tabLoader.loading && ledgerRows.length === 0 ? (
                <div className="empty-state">در حال بارگذاری...</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>نوع</th>
                      <th>شماره</th>
                      <th>تاریخ</th>
                      <th>کد مشتری</th>
                      <th>عنوان مشتری</th>
                      <th>کد کالا</th>
                      <th>عنوان کالا</th>
                      <th>مقدار</th>
                      <th>فی</th>
                      <th>مبلغ</th>
                      <th>تخفیف</th>
                      <th>خالص فروش</th>
                      <th>ارزش افزوده</th>
                      <th>خالص</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerRows.length === 0 && (
                      <tr><td colSpan={13} className="empty-state" style={{ border: "none" }}>گردشی یافت نشد</td></tr>
                    )}
                    {ledgerRows.map((r, i) => (
                      <tr
                        key={i}
                        onDoubleClick={() => openTab(`/sales-invoices/${r.salesInvoiceId}/edit`)}
                        style={{ cursor: "pointer" }}
                        title="دابل‌کلیک برای باز کردن سند"
                      >
                        <td><span className="badge">{r.type}</span></td>
                        <td>{toFaDigits(String(r.number))}</td>
                        <td>{formatJalaliDate(r.date)}</td>
                        <td>{toFaDigits(String(r.customerCode))}</td>
                        <td>{r.customerTitle}</td>
                        <td>{toFaDigits(r.goodsItemCode)}</td>
                        <td>{r.goodsItemTitle}</td>
                        <td>{formatAmountFa(r.quantity)}</td>
                        <td>{formatAmountFa(r.unitPrice)}</td>
                        <td>{formatAmountFa(r.amount)}</td>
                        <td>{formatAmountFa(r.discount)}</td>
                        <td>{formatAmountFa(r.netAmount)}</td>
                        <td>{formatAmountFa(r.vatAmount)}</td>
                        <td>{formatAmountFa(r.netTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {ledgerRows.length > 0 && (
              <div className="grid-footer-totals">
                <span className="grid-footer-totals-item"><b>مقدار:</b> {formatAmountFa(ledgerQuantityTotal)}</span>
                <span className="grid-footer-totals-item"><b>مبلغ:</b> {formatAmountFa(ledgerAmountTotal)}</span>
                <span className="grid-footer-totals-item"><b>تخفیف:</b> {formatAmountFa(ledgerDiscountTotal)}</span>
                <span className="grid-footer-totals-item"><b>خالص فروش:</b> {formatAmountFa(ledgerNetAmountTotal)}</span>
                <span className="grid-footer-totals-item"><b>ارزش افزوده:</b> {formatAmountFa(ledgerVatTotal)}</span>
                <span className="grid-footer-totals-item"><b>خالص:</b> {formatAmountFa(ledgerNetTotalTotal)}</span>
              </div>
            )}
            <div className="grid-footer">
              <span className="grid-footer-info">
                {tabLoader.loading
                  ? "در حال بارگذاری..."
                  : ledgerTotal === 0
                  ? "بدون رکورد"
                  : `نمایش ${toFaDigits(String((ledgerPage - 1) * ledgerPageSize + 1))} تا ${toFaDigits(String(Math.min(ledgerPage * ledgerPageSize, ledgerTotal)))} از ${toFaDigits(String(ledgerTotal))} رکورد`}
              </span>
              <div className="grid-footer-controls">
                <label className="grid-page-size">
                  تعداد در صفحه
                  <select value={ledgerPageSize} onChange={(e) => changeLedgerPageSize(Number(e.target.value))}>
                    {LEDGER_PAGE_SIZE_OPTIONS.map((n) => (
                      <option key={n} value={n}>{toFaDigits(String(n))}</option>
                    ))}
                  </select>
                </label>
                <div className="grid-page-nav">
                  <button type="button" className="btn secondary" disabled={ledgerPage <= 1 || tabLoader.loading} onClick={() => loadLedger(1)}>ابتدا</button>
                  <button type="button" className="btn secondary" disabled={ledgerPage <= 1 || tabLoader.loading} onClick={() => loadLedger(ledgerPage - 1)}>قبلی</button>
                  <span className="grid-page-indicator">صفحه {toFaDigits(String(ledgerPage))} از {toFaDigits(String(ledgerTotalPages))}</span>
                  <button type="button" className="btn secondary" disabled={ledgerPage >= ledgerTotalPages || tabLoader.loading} onClick={() => loadLedger(ledgerPage + 1)}>بعدی</button>
                  <button type="button" className="btn secondary" disabled={ledgerPage >= ledgerTotalPages || tabLoader.loading} onClick={() => loadLedger(ledgerTotalPages)}>انتها</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
