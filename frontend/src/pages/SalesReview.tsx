import { useEffect, useMemo, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { ChainedTabsBar } from "../components/ChainedTabsBar";
import { SelectableBalanceTable, BalanceTableColumn } from "../components/SelectableBalanceTable";
import { RefreshButton } from "../components/RefreshButton";
import { InfoHint } from "../components/InfoHint";
import { useChainedMultiSelect, SelectId } from "../lib/useChainedMultiSelect";
import { getSalesReviewSnapshot, setSalesReviewSnapshot } from "../lib/salesReviewCache";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { resolveReviewDateRange, FiscalPeriodRange } from "../lib/fiscalYearDefaultDate";
import { useReviewTabLoader, useReviewTabActivation, useReviewTabViewState, serializeForDepsKey } from "../lib/useReviewTabLoader";
import { useTabs } from "../lib/TabsContext";
import { api } from "../lib/api";
import { ColumnFilterType, ActiveFilter } from "../components/DataTable";

// گزارش «مرور فروش» — طبق Documents/SalesReviewReport.md، دقیقاً هم‌فرمت «مرور حسابها»/«مرور تعدادی-
// مبلغی انبار» (ChainedTabsBar + useChainedMultiSelect): تب‌های زنجیره‌ای، انتخاب چند ردیف در یک تب،
// فیلترِ تب‌های بعدی/قبلی را اعمال می‌کند. منبع داده: SalesInvoiceLine + SalesReturnInvoiceLine
// (services/salesReviewService.ts سمت بک‌اند) — همه‌ی مبالغ از قبل به ارز پایه ذخیره شده‌اند، پس نیازی
// به تبدیل ارز اینجا نیست.
//
// طبق تصمیم صریح کاربر: «برگشت از فروش» حالا وصل است — ستون‌های «مقدار برگشتی»/«مبلغ برگشتی» از
// SalesReturnInvoiceLine جمع زده می‌شوند و تخفیف/ارزش‌افزوده/خالص هر تب دوطرفه‌اند (فروش منهای برگشت) —
// نگاه کنید به یادداشت بالای backend/src/routes/salesReview.ts. تب «اسناد» طبق متن مستند فقط فاکتور
// فروش را فهرست می‌کند؛ تب «گردش» هر دو نوع را با ستون «نوع» ترکیب می‌کند.
//
// طبق تصمیم صریح کاربر (نمایش علامت‌دار): «مقدار برگشتی»/«مبلغ برگشتی» همیشه منفی/قرمز/پرانتزی نمایش
// داده می‌شوند (دقیقاً هم‌الگوی AmountCell در OlapReports.tsx — کلاس olap-amount-negative). ستون
// «تخفیف» تب‌های تجمعی (که از قبل تخفیف فروش منهای تخفیف برگشت را نگه می‌دارد) هم با همین قرارداد ولی
// با علامت معکوس نمایش داده می‌شود — یعنی مقدار نمایشی = −(تخفیف فروش − تخفیف برگشت) — تا سه قاعده‌ی
// خواسته‌شده هم‌زمان درست دربیاید: تخفیف خالصِ فروش‌محور منفی/قرمز، تخفیف خالصِ برگشت‌محور مثبت. در تب
// «گردش» که هر ردیف فقط یک نوع (فروش یا برگشت) است، همین قرارداد به‌صورت شرطی بر اساس «نوع» ردیف اعمال
// می‌شود: مقدار/مبلغ ردیف‌های برگشتی منفی، تخفیفِ ردیف‌های فروش منفی، تخفیفِ ردیف‌های برگشتی مثبت
// (دقیقاً هم‌ارز با قاعده‌ی تب‌های تجمعی، چون یک ردیف گردش «فروش» تخفیف برگشت=۰ دارد و برعکس).

interface GroupLevel {
  id: number;
  order: number;
  title: string;
}

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
  id: number;
  type: string;
  documentId: number;
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
// طبق درخواست صریح کاربر: «گروه کالا» باید دقیقاً هم‌رفتار «مرور تعدادی-مبلغی انبار» باشد — یک تب پویا
// به‌ازای هر سطح سلسله‌مراتب گروه کالا (نه یک تب تخت واحد مثل قبل)؛ مرزهای تب‌های بعدی (گروه حسابداری/
// کالا/اسناد/گردش) بر همین اساس در کامپوننت زیر، بسته به تعداد سطوح واقعی، پویا محاسبه می‌شوند —
// دقیقاً هم‌الگوی GROUP_LEVEL_TAB_START/GOODS_TAB و... در WarehouseReview.tsx.
const GROUP_LEVEL_TAB_START = 3;

const INFO_TEXT =
  "گزارش سلسله‌مراتبی فروش — در هر تب چندین ردیف قابل انتخاب است تا تب‌های بعدی (و تب‌های «اسناد»/«گردش») بر اساس آن فیلتر شوند. " +
  "همه‌ی مبالغ به ارز پایه نمایش داده می‌شوند. مقدار/مبلغ برگشتی از فاکتور برگشت از فروش محاسبه می‌شود؛ تخفیف/ارزش‌افزوده/خالص هر تب دوطرفه‌اند (فروش منهای برگشت).";

/** اعداد منفی به‌شکل متعارف حسابداری (داخل پرانتز و قرمز) نمایش داده می‌شوند — دقیقاً هم‌الگوی
 * AmountCell در OlapReports.tsx (کلاس olap-amount-negative، از قبل در styles.css تعریف شده). */
function SignedCell({ value }: { value: number }) {
  const negative = value < 0;
  const text = negative ? `(${formatAmountFa(Math.abs(value))})` : formatAmountFa(value);
  return <span className={negative ? "olap-amount-negative" : undefined}>{text}</span>;
}

// دقیقاً همان مقدار/مبلغِ ردیف، فقط با علامت معکوس — برای ردیف‌های «برگشت از فروش» تب گردش (که مقدار/
// مبلغ خودشان همیشه مثبت از سرور می‌آید) و برای «تخفیف» ردیف‌های «فروش» (که باید منفی نمایش داده شود).
function ledgerNegated(r: LedgerRow, field: "quantity" | "amount" | "discount"): number {
  return -(r[field] as number);
}
// تخفیفِ ردیف «برگشت از فروش» طبق تصمیم صریح کاربر باید مثبت بماند (علامت معکوسِ مبلغ منفیِ همان ردیف)
// — یعنی بدون معکوس‌سازی، همان مقدار خام سرور.
function ledgerAsIs(r: LedgerRow, field: "quantity" | "amount" | "discount"): number {
  return r[field] as number;
}

// ستون‌های تب «گردش» — دقیقاً هم‌الگوی LEDGER_COLUMNS در AccountsReview.tsx، با این تفاوت که چون این
// تب حالا SelectableBalanceTable را به‌کار می‌برد (نه یک <table> دستی)، همین یک آرایه هم columns واقعی
// را تعریف می‌کند و هم (از طریق «field») نگاشت هدر→کلید سرور را؛ کلیدها باید دقیقاً با
// LEDGER_COLUMN_DEFS در backend/src/routes/salesReview.ts یکی باشند. طبق تصمیم صریح کاربر: مقدار/مبلغ
// ردیف‌های «برگشت از فروش» منفی/قرمز/پرانتزی‌اند (ledgerNegated)؛ تخفیفِ ردیف‌های «فروش» هم منفی/قرمز/
// پرانتزی است، ولی تخفیفِ ردیف‌های «برگشت از فروش» مثبت می‌ماند (ledgerAsIs) — چون علامتش باید معکوسِ
// مبلغِ (منفیِ) همان ردیف باشد.
const LEDGER_COLUMNS: (BalanceTableColumn<LedgerRow> & { field: string })[] = [
  { header: "نوع", field: "type", render: (r) => <span className="badge">{r.type}</span>, sortValue: (r) => r.type, filterType: "string", filterValue: (r) => r.type },
  { header: "شماره", field: "number", render: (r) => toFaDigits(String(r.number)), sortValue: (r) => r.number, filterType: "number", filterValue: (r) => r.number },
  { header: "تاریخ", field: "date", render: (r) => formatJalaliDate(r.date), sortValue: (r) => r.date, filterType: "date", filterValue: (r) => r.date?.slice(0, 10) },
  { header: "کد مشتری", field: "customerCode", render: (r) => toFaDigits(String(r.customerCode)), sortValue: (r) => r.customerCode, filterType: "number", filterValue: (r) => r.customerCode },
  { header: "عنوان مشتری", field: "customerTitle", render: (r) => r.customerTitle, sortValue: (r) => r.customerTitle, filterType: "string", filterValue: (r) => r.customerTitle },
  { header: "کد کالا", field: "goodsItemCode", render: (r) => toFaDigits(r.goodsItemCode), sortValue: (r) => r.goodsItemCode, filterType: "string", filterValue: (r) => r.goodsItemCode },
  { header: "عنوان کالا", field: "goodsItemTitle", render: (r) => r.goodsItemTitle, sortValue: (r) => r.goodsItemTitle, filterType: "string", filterValue: (r) => r.goodsItemTitle },
  {
    header: "مقدار", field: "quantity",
    render: (r) => <SignedCell value={r.type === "فروش" ? ledgerAsIs(r, "quantity") : ledgerNegated(r, "quantity")} />,
    sortValue: (r) => (r.type === "فروش" ? ledgerAsIs(r, "quantity") : ledgerNegated(r, "quantity")),
    filterType: "number", filterValue: (r) => (r.type === "فروش" ? ledgerAsIs(r, "quantity") : ledgerNegated(r, "quantity")), decimal: true,
  },
  { header: "فی", field: "unitPrice", render: (r) => formatAmountFa(r.unitPrice), sortValue: (r) => r.unitPrice, filterType: "number", filterValue: (r) => r.unitPrice },
  {
    header: "مبلغ", field: "amount",
    render: (r) => <SignedCell value={r.type === "فروش" ? ledgerAsIs(r, "amount") : ledgerNegated(r, "amount")} />,
    sortValue: (r) => (r.type === "فروش" ? ledgerAsIs(r, "amount") : ledgerNegated(r, "amount")),
    filterType: "number", filterValue: (r) => (r.type === "فروش" ? ledgerAsIs(r, "amount") : ledgerNegated(r, "amount")), decimal: true,
  },
  {
    header: "تخفیف", field: "discount",
    render: (r) => <SignedCell value={r.type === "فروش" ? ledgerNegated(r, "discount") : ledgerAsIs(r, "discount")} />,
    sortValue: (r) => (r.type === "فروش" ? ledgerNegated(r, "discount") : ledgerAsIs(r, "discount")),
    filterType: "number", filterValue: (r) => (r.type === "فروش" ? ledgerNegated(r, "discount") : ledgerAsIs(r, "discount")), decimal: true,
  },
  { header: "خالص فروش", field: "netAmount", render: (r) => formatAmountFa(r.netAmount), sortValue: (r) => r.netAmount, filterType: "number", filterValue: (r) => r.netAmount, decimal: true },
  { header: "ارزش افزوده", field: "vatAmount", render: (r) => formatAmountFa(r.vatAmount), sortValue: (r) => r.vatAmount, filterType: "number", filterValue: (r) => r.vatAmount, decimal: true },
  { header: "خالص", field: "netTotal", render: (r) => formatAmountFa(r.netTotal), sortValue: (r) => r.netTotal, filterType: "number", filterValue: (r) => r.netTotal, decimal: true },
];
const LEDGER_SORT_FIELD_MAP: Record<string, string> = Object.fromEntries(LEDGER_COLUMNS.map((c) => [c.header, c.field]));

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

// دقیقاً هم‌الگوی numCol، فقط مقدار نمایشی/مرتب‌سازی/فیلتر با علامت معکوس محاسبه می‌شود — برای «مقدار
// برگشتی»/«مبلغ برگشتی» (که همیشه باید منفی/قرمز/پرانتزی نمایش داده شوند) و «تخفیف» (که چون از قبل
// «تخفیف فروش منهای تخفیف برگشت» است، معکوس‌کردنش دقیقاً هر سه قاعده‌ی خواسته‌شده را هم‌زمان درست
// می‌کند: تخفیفِ فروش‌محور منفی، تخفیفِ برگشت‌محور مثبت — نگاه کنید به یادداشت بالای فایل).
function negatedNumCol(header: string, field: keyof DimRow): BalanceTableColumn<DimRow> {
  return {
    header,
    render: (r) => <SignedCell value={-((r[field] as number) || 0)} />,
    sortValue: (r) => -((r[field] as number) || 0),
    filterType: "number",
    filterValue: (r) => -((r[field] as number) || 0),
    decimal: true,
  };
}

export default function SalesReview() {
  const { openTab } = useTabs();
  const snapshot = getSalesReviewSnapshot();
  const [periods, setPeriods] = useState<FiscalPeriodRange[]>([]);
  const [periodsLoaded, setPeriodsLoaded] = useState(false);
  const [groupLevels, setGroupLevels] = useState<GroupLevel[]>([]);
  const [levelsLoaded, setLevelsLoaded] = useState(false);
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
      ledgerSort,
      ledgerFilters,
    });
  }, [chain.selections, chain.order, activeTab, filters, tabData, tabView.viewState, tabLoader.loadedTabs, ledgerRows, ledgerPage, ledgerPageSize, ledgerTotal, ledgerTotalPages, ledgerSort, ledgerFilters]);

  useEffect(() => {
    async function init() {
      const [per, lvls]: [FiscalPeriodRange[], GroupLevel[]] = await Promise.all([
        api.get("/fiscal-periods"),
        api.get("/goods-group-levels"),
      ]);
      setPeriods(per);
      setPeriodsLoaded(true);
      setGroupLevels(lvls);
      setLevelsLoaded(true);
      setFilters((prev) => (prev.fromDate ? prev : resolveReviewDateRange(per)));
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // مرزهای تب‌ها به‌صورت پویا بر اساس تعداد سطوح گروه کالا محاسبه می‌شوند — دقیقاً هم‌الگوی GOODS_TAB و...
  // در WarehouseReview.tsx.
  const ACCOUNTING_GROUP_TAB = GROUP_LEVEL_TAB_START + groupLevels.length;
  const GOODS_ITEM_TAB = ACCOUNTING_GROUP_TAB + 1;
  const DOCUMENTS_TAB = GOODS_ITEM_TAB + 1;
  const LEDGER_TAB = DOCUMENTS_TAB + 1;

  const TAB_LABELS = ["مرکز فروش", "نوع فروش", "مشتری", ...groupLevels.map((l) => l.title), "گروه حسابداری", "کالا", "اسناد", "گردش"];

  function isGroupLevelTab(tabIndex: number) {
    return tabIndex >= GROUP_LEVEL_TAB_START && tabIndex < ACCOUNTING_GROUP_TAB;
  }

  function dimEndpoint(tabIndex: number): string {
    if (tabIndex === SALES_CENTER_TAB) return "/sales-review/sales-centers";
    if (tabIndex === SALES_TYPE_TAB) return "/sales-review/sales-types";
    if (tabIndex === CUSTOMER_TAB) return "/sales-review/customers";
    if (isGroupLevelTab(tabIndex)) return "/sales-review/goods-group-level";
    if (tabIndex === ACCOUNTING_GROUP_TAB) return "/sales-review/accounting-groups";
    if (tabIndex === GOODS_ITEM_TAB) return "/sales-review/goods-items";
    if (tabIndex === DOCUMENTS_TAB) return "/sales-review/documents";
    return "";
  }

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
        if ((isGroupLevelTab(t) || t === ACCOUNTING_GROUP_TAB) && row.goodsItemIds) row.goodsItemIds.forEach((gid) => goodsItemIds.add(String(gid)));
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
        if (isGroupLevelTab(tabIndex)) {
          const level = groupLevels[tabIndex - GROUP_LEVEL_TAB_START];
          if (level) p.set("levelOrder", String(level.order));
        }
        const data = await api.get(`${dimEndpoint(tabIndex)}?${p.toString()}`);
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
    loadLedger(1, size, ledgerSort, ledgerFilters);
  }

  function onLedgerSortChange(sort: { header: string; dir: "asc" | "desc" } | null) {
    setLedgerSort(sort);
    loadLedger(1, ledgerPageSize, sort, ledgerFilters);
  }

  function onLedgerFiltersChange(f: Record<string, ActiveFilter>) {
    setLedgerFilters(f);
    loadLedger(1, ledgerPageSize, ledgerSort, f);
  }

  const activationDepsKey = useMemo(
    () => serializeForDepsKey({ selections: chain.selections, order: chain.order, filters, groupLevels }),
    [chain.selections, chain.order, filters, groupLevels]
  );
  useReviewTabActivation(
    periodsLoaded && levelsLoaded && !!filters.fromDate,
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
    setLedgerSort(null);
    setLedgerFilters({});
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
        negatedNumCol("تخفیف", "discount"),
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
      negatedNumCol("مقدار برگشتی", "returnedQuantity"),
      numCol("خالص فروش - مقدار", "netQuantity"),
      numCol("مبلغ فروش", "amount"),
      negatedNumCol("مبلغ برگشتی", "returnedAmount"),
      negatedNumCol("تخفیف", "discount"),
      numCol("خالص فروش", "netAmount"),
      numCol("ارزش افزوده", "vatAmount"),
      numCol("خالص", "netTotal"),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, groupLevels]);

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
            <InfoHint text={INFO_TEXT} title="مرور فروش" />
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
          onToggle={onToggleRow}
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
          onRowDoubleClick={(r) => openTab(r.type === "فروش" ? `/sales-invoices/${r.documentId}/edit` : `/sales-return-invoices/${r.documentId}/edit`)}
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
            onPageSizeChange: changeLedgerPageSize,
            onSortChange: onLedgerSortChange,
            onFiltersChange: onLedgerFiltersChange,
          }}
        />
      )}
    </div>
  );
}
