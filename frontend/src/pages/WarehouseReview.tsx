import { useEffect, useMemo, useState } from "react";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { ChainedTabsBar } from "../components/ChainedTabsBar";
import { SelectableBalanceTable, BalanceTableColumn } from "../components/SelectableBalanceTable";
import { RefreshButton } from "../components/RefreshButton";
import { useChainedMultiSelect, SelectId } from "../lib/useChainedMultiSelect";
import { getWarehouseReviewSnapshot, setWarehouseReviewSnapshot } from "../lib/warehouseReviewCache";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { resolveReviewDateRange, FiscalPeriodRange } from "../lib/fiscalYearDefaultDate";
import { useReviewTabLoader, useReviewTabActivation, useReviewTabViewState, serializeForDepsKey } from "../lib/useReviewTabLoader";
import { useTabs } from "../lib/TabsContext";
import { api } from "../lib/api";
import { InfoHint } from "../components/InfoHint";
import { ColumnFilterType, ActiveFilter } from "../components/DataTable";

// گزارش «مرور موجودی انبار» — با همان فرمت «مرور حسابها» (ChainedTabsBar + useChainedMultiSelect):
// تب‌های زنجیره‌ای که هر تب، انتخاب‌های تب‌های «پیش‌تر لمس‌شده» را به‌عنوان فیلتر اعمال می‌کند (دقیقاً
// همان الگوی accountConstraints/detailConstraints در AccountsReview.tsx، اما بدون سلسله‌مراتب حساب —
// این‌جا انبار/[سطوح گروه کالا]/کالا/سریال/بچ/تاریخ‌انقضا/محل‌فیزیکی هستند که مستقیماً از گردش اسناد
// انبار (warehouseMovementService سمت بک‌اند) استخراج می‌شوند، نه از یک درخت حساب).
//
// تب‌های «سطح گروه کالا»: به ازای هر ردیف GoodsGroupLevel یک تب پویا ساخته می‌شود (بین تب «انبار» و
// تب «کالا») — دقیقاً مثل تب‌های سطح گزارشگری در «مرور حسابها». هر ردیف این تب‌ها یک گره‌ی گروه کالا
// (نه یک کالای تکی) است و goodsItemIds زیرمجموعه‌ی خودش را هم برمی‌گرداند تا وقتی انتخاب شود، مثل
// انتخاب چند ردیف در تب «کالا» فیلتر تب‌های بعدی/قبلی را اعمال کند (مکانیزم فیلتر زنجیره‌ای موجود،
// بدون نیاز به منطق جداگانه‌ی بالادست/زیرمجموعه).
//
// mode="qty" («مرور تعدادی»، ساب‌ماژول «گزارش»): فقط ستون‌های تعدادی (مقدار اول دوره/وارده/صادره/مانده).
// mode="amount" («مرور مبلغی»، همان ساب‌ماژول «گزارش» — ماژول جدای «حسابداری انبار» طبق تصمیم صریح
// کاربر حذف و ادغام شد): همان ستون‌های تعدادی + ستون‌های مبلغی معادل
// (طبق درخواست صریح کاربر: «هر جا که مقدار هست در کنارش ستون مبلغ هم باشد»).

type ReviewMode = "qty" | "amount";

interface GroupLevel {
  id: number;
  order: number;
  title: string;
}

interface DimRow {
  id: SelectId;
  warehouseId?: number;
  warehouseCode?: number | null;
  warehouseTitle?: string;
  groupId?: number;
  groupCode?: string;
  groupTitle?: string;
  goodsItemIds?: number[];
  goodsItemId?: number;
  goodsItemCode?: string;
  goodsItemTitle?: string;
  expiryDate?: string | null;
  serialNumber?: string | null;
  batchNumber?: string | null;
  physicalLocation?: string | null;
  openingQuantity: number;
  openingAmount: number;
  inQuantity: number;
  inAmount: number;
  outQuantity: number;
  outAmount: number;
  balanceQuantity: number;
  balanceAmount: number;
}

interface LedgerRow {
  id: number;
  direction: "IN" | "OUT";
  docType: string;
  docId: number;
  docNumber: number;
  date: string;
  warehouseCode: number | null;
  warehouseTitle: string | null;
  goodsItemId: number;
  goodsItemCode: string;
  goodsItemTitle: string;
  quantity: number;
  amount: number;
  serialNumber: string | null;
  batchNumber: string | null;
  expiryDate: string | null;
  physicalLocation: string | null;
  detailCode: string | null;
  detailTitle: string | null;
  runningQuantity: number;
  runningAmount: number;
}

const WAREHOUSE_TAB = 0;
const GROUP_LEVEL_TAB_START = 1;

const DIRECTION_FA: Record<string, string> = { IN: "وارده", OUT: "صادره" };

// نگاشت نوع سند (متن فارسی برگشتی از بک‌اند) به مسیر ویرایش، برای دابل‌کلیک روی ردیف گردش — این ۵ نوع
// نمای «حسابداری انبار» مجزا هم دارند، پس فقط بخش قابل الحاق به basePath ذخیره می‌شود
const DOC_TYPE_PATH: Record<string, string> = {
  "موجودی اول دوره": "initial-inventory",
  "رسید انبار خرید": "warehouse-receipts",
  "حواله انتقالی": "warehouse-transfer-out",
  "رسید انتقال": "warehouse-transfer-in",
  "اضافات انبارگردانی": "warehouse-adjustments",
};

// طبق stockAnalysis.md بند ۳۴ — این ۱۰ نوع سند جدید برخلاف ۵ نوع بالا نمای «حسابداری انبار» مجزا
// ندارند (فقط انبارداری)، پس مسیر کامل (نه فقط بخش قابل الحاق به basePath) ذخیره می‌شود
const DOC_TYPE_FULL_PATH: Record<string, string> = {
  "مصرف مرکز هزینه": "/center-consumptions",
  "مصرف پروژه": "/project-consumptions",
  "مصرف تولید": "/production-consumptions",
  "برگشت مصرف مرکز هزینه": "/center-consumption-returns",
  "برگشت مصرف پروژه": "/project-consumption-returns",
  "برگشت مصرف تولید": "/production-consumption-returns",
  "برگشت از فروش": "/sales-returns",
  "برگشت به تامین‌کننده": "/supplier-returns",
  "رسید تولید": "/production-receipts",
  "حواله دارایی ثابت": "/fixed-asset-issues",
  "کسری انبارگردانی": "/inventory-counting-shortages",
};

function infoText(mode: ReviewMode) {
  const base =
    "گزارش سلسله‌مراتبی موجودی انبار — در هر تب چندین ردیف قابل انتخاب است تا تب‌های بعدی (و تب «گردش») بر اساس آن فیلتر شوند. " +
    "مقدار/مبلغ اول دوره یعنی مانده‌ی قبل از «از تاریخ»؛ وارده/صادره یعنی گردش در بازه‌ی انتخابی؛ مانده یعنی اول دوره + وارده − صادره. " +
    "به ازای هر سطح گروه کالا نیز یک تب جداگانه وجود دارد که موجودی را بر اساس آن سطح از درخت گروه کالا جمع می‌زند.";
  return mode === "qty"
    ? base + " این گزارش («مرور تعدادی») فقط مقدار را نشان می‌دهد."
    : base + " این گزارش («مرور مبلغی») مقدار و مبلغ معادل هر ردیف را با هم نشان می‌دهد.";
}

// اسناد صادره (خروج) به فرمت رایج حسابداری برای اعداد منفی نمایش داده می‌شوند: داخل پرانتز و قرمز —
// dir="ltr" چون در متن راست‌به‌چپ، پرانتز/کاما/ارقام باید به ترتیب چپ‌به‌راست خودشان بمانند
function formatAccountingAmount(value: number, isOutbound: boolean) {
  const text = formatAmountFa(Math.abs(value));
  if (!isOutbound) return text;
  return (
    <span dir="ltr" style={{ color: "var(--danger)" }}>
      ({text})
    </span>
  );
}

function amountCol(header: string, field: keyof DimRow, outbound = false): BalanceTableColumn<DimRow> {
  return {
    header,
    render: (r) => formatAccountingAmount((r[field] as number) || 0, outbound),
    sortValue: (r) => (r[field] as number) || 0,
    filterType: "number",
    filterValue: (r) => (r[field] as number) || 0,
    decimal: true,
  };
}

// ستون‌های تب «گردش» — دقیقاً هم‌الگوی LEDGER_COLUMNS در AccountsReview.tsx/SalesReview.tsx، فقط ستون‌های
// مبلغی فقط در mode="amount" اضافه می‌شوند. کلیدها (field) باید دقیقاً با ledgerColumnDefs در
// backend/src/routes/warehouseReview.ts یکی باشند. مقدار/مبلغ یک ستون واحد با هر دو جهت مخلوط‌اند (نه
// وارده/صادره‌ی جدا، برخلاف تب‌های دیگر) — totalValue علامت‌دار (صادره منفی) برمی‌گرداند تا جمع پای
// گرید هم همان معنای حسابداری قبلی را داشته باشد، در حالی که filterValue همچنان اندازه‌ی مثبت خام است.
function ledgerColumns(mode: ReviewMode): (BalanceTableColumn<LedgerRow> & { field: string })[] {
  const cols: (BalanceTableColumn<LedgerRow> & { field: string })[] = [
    { header: "نوع", field: "direction", render: (r) => <span className="badge">{DIRECTION_FA[r.direction]}</span>, sortValue: (r) => DIRECTION_FA[r.direction], filterType: "string", filterValue: (r) => DIRECTION_FA[r.direction] },
    { header: "نوع سند", field: "docType", render: (r) => r.docType, sortValue: (r) => r.docType, filterType: "string", filterValue: (r) => r.docType },
    { header: "شماره", field: "docNumber", render: (r) => toFaDigits(String(r.docNumber)), sortValue: (r) => r.docNumber, filterType: "number", filterValue: (r) => r.docNumber },
    { header: "تاریخ", field: "date", render: (r) => formatJalaliDate(r.date), sortValue: (r) => r.date, filterType: "date", filterValue: (r) => r.date?.slice(0, 10) },
    { header: "کد انبار", field: "warehouseCode", render: (r) => (r.warehouseCode != null ? toFaDigits(String(r.warehouseCode)) : "—"), sortValue: (r) => r.warehouseCode ?? 0, filterType: "number", filterValue: (r) => r.warehouseCode },
    { header: "انبار", field: "warehouseTitle", render: (r) => r.warehouseTitle || "—", sortValue: (r) => r.warehouseTitle || "", filterType: "string", filterValue: (r) => r.warehouseTitle || "" },
    { header: "کد کالا", field: "goodsItemCode", render: (r) => toFaDigits(r.goodsItemCode), sortValue: (r) => r.goodsItemCode, filterType: "string", filterValue: (r) => r.goodsItemCode },
    { header: "کالا", field: "goodsItemTitle", render: (r) => r.goodsItemTitle, sortValue: (r) => r.goodsItemTitle, filterType: "string", filterValue: (r) => r.goodsItemTitle },
    {
      header: "مقدار",
      field: "quantity",
      render: (r) => formatAccountingAmount(r.quantity, r.direction === "OUT"),
      sortValue: (r) => r.quantity,
      filterType: "number",
      filterValue: (r) => r.quantity,
      decimal: true,
      totalValue: (r) => (r.direction === "OUT" ? -r.quantity : r.quantity),
    },
  ];
  if (mode === "amount") {
    cols.push({
      header: "مبلغ",
      field: "amount",
      render: (r) => formatAccountingAmount(r.amount, r.direction === "OUT"),
      sortValue: (r) => r.amount,
      filterType: "number",
      filterValue: (r) => r.amount,
      decimal: true,
      totalValue: (r) => (r.direction === "OUT" ? -r.amount : r.amount),
    });
  }
  // «مانده در خط» عمداً بدون sortValue/filterType است — یک مقدار تجمعی وابسته به ترتیب پردازش سرور
  // است، نه یک مقدار مستقیم قابل فیلتر/مرتب‌سازی (دقیقاً هم‌قرارداد LEDGER_COLUMNS در AccountsReview.tsx).
  cols.push({ header: "مانده در خط", field: "runningQuantity", render: (r) => formatAmountFa(r.runningQuantity) });
  if (mode === "amount") {
    cols.push({ header: "مانده مبلغی در خط", field: "runningAmount", render: (r) => formatAmountFa(r.runningAmount) });
  }
  cols.push(
    { header: "کد تفصیل", field: "detailCode", render: (r) => (r.detailCode ? toFaDigits(r.detailCode) : "—"), sortValue: (r) => r.detailCode || "", filterType: "string", filterValue: (r) => r.detailCode || "" },
    { header: "عنوان تفصیل", field: "detailTitle", render: (r) => r.detailTitle || "—", sortValue: (r) => r.detailTitle || "", filterType: "string", filterValue: (r) => r.detailTitle || "" }
  );
  return cols;
}
const LEDGER_SORT_FIELD_MAP: Record<string, string> = Object.fromEntries(ledgerColumns("amount").map((c) => [c.header, c.field]));

export default function WarehouseReview({ mode }: { mode: ReviewMode }) {
  const { openTab } = useTabs();
  const basePath = mode === "qty" ? "/warehousing" : "/warehouse-accounting";
  const snapshot = getWarehouseReviewSnapshot(mode);
  const [periods, setPeriods] = useState<FiscalPeriodRange[]>([]);
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
  const tabView = useReviewTabViewState(activeTab, snapshot?.dimViewState ?? {});

  // ذخیره‌ی زنده‌ی وضعیت در حافظه‌ی موقت بیرون از چرخه‌ی کامپوننت — دقیقاً هم‌الگوی AccountsReview.tsx —
  // تا با رفتن به یک تب دیگر (مثلاً باز کردن سند از تب گردش) و بازگشت، وضعیت این صفحه از دست نرود.
  useEffect(() => {
    setWarehouseReviewSnapshot(mode, {
      chainState: { selections: chain.selections, order: chain.order },
      activeTab,
      filters,
      tabData,
      dimViewState: tabView.viewState,
      loadedTabs: Array.from(tabLoader.loadedTabs),
      ledgerRows,
      ledgerPage,
      ledgerPageSize,
      ledgerTotal,
      ledgerTotalPages,
      ledgerSort,
      ledgerFilters,
    });
  }, [mode, chain.selections, chain.order, activeTab, filters, tabData, tabView.viewState, tabLoader.loadedTabs, ledgerRows, ledgerPage, ledgerPageSize, ledgerTotal, ledgerTotalPages, ledgerSort, ledgerFilters]);

  // مرزهای تب‌ها به‌صورت پویا بر اساس تعداد سطوح گروه کالا محاسبه می‌شوند (دقیقاً مثل accountTabCount
  // در AccountsReview.tsx که بر اساس تعداد سطوح گزارشگری محاسبه می‌شود)
  const GOODS_TAB = GROUP_LEVEL_TAB_START + groupLevels.length;
  const EXPIRY_TAB = GOODS_TAB + 1;
  const SERIAL_TAB = GOODS_TAB + 2;
  const BATCH_TAB = GOODS_TAB + 3;
  const LOCATION_TAB = GOODS_TAB + 4;
  const LEDGER_TAB = GOODS_TAB + 5;

  const TAB_LABELS = [
    "انبار",
    ...groupLevels.map((l) => l.title),
    "کالا",
    "کالا - تاریخ انقضا",
    "کالا - سریال",
    "کالا - شماره بچ",
    "کالا - محل فیزیکی",
    "گردش",
  ];

  function isGroupLevelTab(tabIndex: number) {
    return tabIndex >= GROUP_LEVEL_TAB_START && tabIndex < GOODS_TAB;
  }

  function dimEndpoint(tabIndex: number): string {
    if (tabIndex === WAREHOUSE_TAB) return "/warehouse-review/warehouses";
    if (isGroupLevelTab(tabIndex)) return "/warehouse-review/goods-group-level";
    if (tabIndex === GOODS_TAB) return "/warehouse-review/goods-items";
    if (tabIndex === EXPIRY_TAB) return "/warehouse-review/goods-expiry";
    if (tabIndex === SERIAL_TAB) return "/warehouse-review/goods-serial";
    if (tabIndex === BATCH_TAB) return "/warehouse-review/goods-batch";
    if (tabIndex === LOCATION_TAB) return "/warehouse-review/goods-location";
    return "";
  }

  useEffect(() => {
    async function init() {
      const [per, lvls]: [FiscalPeriodRange[], GroupLevel[]] = await Promise.all([
        api.get("/fiscal-periods"),
        api.get("/goods-group-levels"),
      ]);
      setPeriods(per);
      setGroupLevels(lvls);
      setLevelsLoaded(true);
      setFilters((prev) => (prev.fromDate ? prev : resolveReviewDateRange(per)));
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** فیلترهای مؤثر روی tabIndex: از هر تبی که «پیش‌تر» (به ترتیب زمانی انتخاب کاربر) لمس شده، بر اساس
   * ردیف‌های واقعاً انتخاب‌شده (نه فقط شناسه)، مقدار فیلتر متناظر استخراج می‌شود. برای تب‌های «سطح گروه
   * کالا»، هر ردیف به‌جای یک goodsItemId تکی، فهرست goodsItemIds زیرمجموعه‌ی خودش را دارد. */
  function collectFilters(tabIndex: number) {
    const warehouseIds = new Set<string>();
    const goodsItemIds = new Set<string>();
    const expiryDates = new Set<string>();
    const serialNumbers = new Set<string>();
    const batchNumbers = new Set<string>();
    const physicalLocations = new Set<string>();
    for (const t of chain.tabsBefore(tabIndex)) {
      if (t === LEDGER_TAB) continue;
      const rows = tabData[t] || [];
      for (const id of chain.get(t)) {
        const row = rows.find((r) => String(r.id) === String(id));
        if (!row) continue;
        if (t === WAREHOUSE_TAB && row.warehouseId != null) warehouseIds.add(String(row.warehouseId));
        if (t !== WAREHOUSE_TAB) {
          if (row.goodsItemIds && row.goodsItemIds.length) {
            row.goodsItemIds.forEach((gid) => goodsItemIds.add(String(gid)));
          } else if (row.goodsItemId != null) {
            goodsItemIds.add(String(row.goodsItemId));
          }
        }
        if (t === EXPIRY_TAB && row.expiryDate) expiryDates.add(row.expiryDate.slice(0, 10));
        if (t === SERIAL_TAB && row.serialNumber) serialNumbers.add(row.serialNumber);
        if (t === BATCH_TAB && row.batchNumber) batchNumbers.add(row.batchNumber);
        if (t === LOCATION_TAB && row.physicalLocation) physicalLocations.add(row.physicalLocation);
      }
    }
    return { warehouseIds, goodsItemIds, expiryDates, serialNumbers, batchNumbers, physicalLocations };
  }

  function buildParams(tabIndex: number) {
    const p = new URLSearchParams();
    p.set("fromDate", filters.fromDate);
    p.set("toDate", filters.toDate);
    const f = collectFilters(tabIndex);
    if (f.warehouseIds.size) p.set("warehouseIds", Array.from(f.warehouseIds).join(","));
    if (f.goodsItemIds.size) p.set("goodsItemIds", Array.from(f.goodsItemIds).join(","));
    if (f.expiryDates.size) p.set("expiryDates", Array.from(f.expiryDates).join(","));
    if (f.serialNumbers.size) p.set("serialNumbers", Array.from(f.serialNumbers).join(","));
    if (f.batchNumbers.size) p.set("batchNumbers", Array.from(f.batchNumbers).join(","));
    if (f.physicalLocations.size) p.set("physicalLocations", Array.from(f.physicalLocations).join(","));
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
        if (isStale()) return; // یک fetch تازه‌تر برای همین تب در راه است/رسیده — این پاسخ دیرآمده نادیده گرفته می‌شود
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
        const data = await api.get(`/warehouse-review/ledger?${p.toString()}`);
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
    levelsLoaded && !!filters.fromDate,
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

  function resetAll() {
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

  // دکمه‌ی «حذف همه فیلترها» — طبق اصلاح صریح کاربر (۱۴۰۵/۰۶/۱۹): انتخاب یک ردیف در یک تب هم خودش یک
  // «فیلتر» زنجیره‌ای است، نه چیزی جدا از فیلترهای ستونی گرید — پس با این دکمه هم باید پاک شود (و
  // کاربر به اولین تب برگردد). این دقیقاً همان resetAll موجود است (که فقط بازه‌ی تاریخ بالای گزارش را
  // دست‌نخورده می‌گذارد، چون آن با تغییر واقعی‌اش از طریق خودِ فیلد تاریخ بازنشانی می‌شود، نه این دکمه)
  // — نیازی به یک تابع جدای تکراری نیست. نگاه کنید به یادداشت مشابه در AccountsReview.tsx#clearFilters
  // (که آن‌جا چون فیلترهای اضافی گردش هم دارد، از resetAll خودش کمی بیشتر است).

  const tabDefs = TAB_LABELS.map((label, idx) => ({
    key: `wr-${idx}`,
    label,
    count: idx === LEDGER_TAB ? 0 : chain.get(idx).size,
  }));

  const columns = useMemo((): BalanceTableColumn<DimRow>[] => {
    const prefix: BalanceTableColumn<DimRow>[] = [];
    const strFilter: ColumnFilterType = "string";
    if (activeTab === WAREHOUSE_TAB) {
      prefix.push(
        { header: "کد انبار", render: (r) => (r.warehouseCode != null ? toFaDigits(String(r.warehouseCode)) : "—"), sortValue: (r) => r.warehouseCode ?? 0, width: "90px", filterType: "number", filterValue: (r) => r.warehouseCode ?? null },
        { header: "عنوان", render: (r) => r.warehouseTitle || "—", sortValue: (r) => r.warehouseTitle || "", filterType: strFilter, filterValue: (r) => r.warehouseTitle || "" }
      );
    } else if (isGroupLevelTab(activeTab)) {
      prefix.push(
        { header: "کد گروه", render: (r) => (r.groupCode ? toFaDigits(r.groupCode) : "—"), sortValue: (r) => r.groupCode || "", width: "110px", filterType: strFilter, filterValue: (r) => r.groupCode || "" },
        { header: "عنوان", render: (r) => r.groupTitle || "—", sortValue: (r) => r.groupTitle || "", filterType: strFilter, filterValue: (r) => r.groupTitle || "" }
      );
    } else {
      prefix.push(
        { header: "کد کالا", render: (r) => (r.goodsItemCode ? toFaDigits(r.goodsItemCode) : "—"), sortValue: (r) => r.goodsItemCode || "", width: "110px", filterType: strFilter, filterValue: (r) => r.goodsItemCode || "" },
        { header: "عنوان", render: (r) => r.goodsItemTitle || "—", sortValue: (r) => r.goodsItemTitle || "", filterType: strFilter, filterValue: (r) => r.goodsItemTitle || "" }
      );
      if (activeTab === EXPIRY_TAB) prefix.push({ header: "تاریخ انقضا", render: (r) => (r.expiryDate ? formatJalaliDate(r.expiryDate) : "—"), sortValue: (r) => r.expiryDate || "", filterType: strFilter, filterValue: (r) => r.expiryDate || "" });
      if (activeTab === SERIAL_TAB) prefix.push({ header: "سریال", render: (r) => r.serialNumber || "—", sortValue: (r) => r.serialNumber || "", filterType: strFilter, filterValue: (r) => r.serialNumber || "" });
      if (activeTab === BATCH_TAB) prefix.push({ header: "شماره بچ", render: (r) => r.batchNumber || "—", sortValue: (r) => r.batchNumber || "", filterType: strFilter, filterValue: (r) => r.batchNumber || "" });
      if (activeTab === LOCATION_TAB) prefix.push({ header: "محل فیزیکی", render: (r) => r.physicalLocation || "—", sortValue: (r) => r.physicalLocation || "", filterType: strFilter, filterValue: (r) => r.physicalLocation || "" });
    }

    const suffix: BalanceTableColumn<DimRow>[] = [amountCol("مقدار اول دوره", "openingQuantity")];
    if (mode === "amount") suffix.push(amountCol("مبلغ اول دوره", "openingAmount"));
    suffix.push(amountCol("وارده", "inQuantity"));
    if (mode === "amount") suffix.push(amountCol("مبلغ وارده", "inAmount"));
    suffix.push(amountCol("صادره", "outQuantity", true));
    if (mode === "amount") suffix.push(amountCol("مبلغ صادره", "outAmount", true));
    suffix.push(amountCol("مانده", "balanceQuantity"));
    if (mode === "amount") suffix.push(amountCol("مانده مبلغی", "balanceAmount"));

    return [...prefix, ...suffix];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, mode, groupLevels]);

  const ledgerCols = useMemo(() => ledgerColumns(mode), [mode]);

  return (
    <div>
      {error && <div className="alert error">{error}</div>}

      <div className="card ar-filters">
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
          <div className="form-field-inline">
            <label>از تاریخ</label>
            <JalaliDatePicker value={filters.fromDate} onChange={(v) => { setFilters((p) => ({ ...p, fromDate: v })); resetAll(); }} />
          </div>
          <div className="form-field-inline">
            <label>تا تاریخ</label>
            <JalaliDatePicker value={filters.toDate} onChange={(v) => { setFilters((p) => ({ ...p, toDate: v })); resetAll(); }} />
          </div>
        </div>
      </div>

      <ChainedTabsBar
        tabs={tabDefs}
        activeIndex={activeTab}
        onChange={setActiveTab}
        actions={
          <>
            <InfoHint text={infoText(mode)} title={mode === "qty" ? "مرور تعدادی" : "مرور مبلغی"} />
            <RefreshButton onClick={refreshCurrentTab} title="رفرش تب جاری" />
          </>
        }
        onClearFilters={resetAll}
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
          columns={ledgerCols}
          selectable={false}
          onRowDoubleClick={(r) => {
            const full = DOC_TYPE_FULL_PATH[r.docType];
            if (full) {
              openTab(`${full}/${r.docId}/edit`);
              return;
            }
            const seg = DOC_TYPE_PATH[r.docType];
            if (seg) openTab(`${basePath}/${seg}/${r.docId}/edit`);
          }}
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
