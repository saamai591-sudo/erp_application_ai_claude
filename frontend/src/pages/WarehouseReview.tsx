import { useEffect, useMemo, useRef, useState } from "react";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { ChainedTabsBar } from "../components/ChainedTabsBar";
import { SelectableBalanceTable, BalanceTableColumn } from "../components/SelectableBalanceTable";
import { RefreshButton } from "../components/RefreshButton";
import { useChainedMultiSelect, SelectId } from "../lib/useChainedMultiSelect";
import { getWarehouseReviewSnapshot, setWarehouseReviewSnapshot } from "../lib/warehouseReviewCache";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { toEnglishDigits } from "../lib/digits";
import { getSavedFiscalPeriodId } from "../lib/userSettings";
import { useTabs } from "../lib/TabsContext";
import { api } from "../lib/api";
import { InfoHint } from "../components/InfoHint";
import { ColumnFilterType } from "../components/DataTable";

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

interface FiscalPeriod {
  id: number;
  title: string;
  fromDate: string;
  toDate: string;
}

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

const LEDGER_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

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
  };
}

export default function WarehouseReview({ mode }: { mode: ReviewMode }) {
  const { openTab } = useTabs();
  const basePath = mode === "qty" ? "/warehousing" : "/warehouse-accounting";
  const snapshot = getWarehouseReviewSnapshot(mode);
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [groupLevels, setGroupLevels] = useState<GroupLevel[]>([]);
  const [levelsLoaded, setLevelsLoaded] = useState(false);
  const [filters, setFilters] = useState(snapshot?.filters ?? { fromDate: "", toDate: "" });
  const [activeTab, setActiveTab] = useState(snapshot?.activeTab ?? 0);
  const [tabData, setTabData] = useState<Record<number, DimRow[]>>(snapshot?.tabData ?? {});
  const [tabLoading, setTabLoading] = useState(false);
  const [loadedTabs, setLoadedTabs] = useState<Set<number>>(new Set(snapshot?.loadedTabs ?? []));
  const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>(snapshot?.ledgerRows ?? []);
  const [ledgerPage, setLedgerPage] = useState(snapshot?.ledgerPage ?? 1);
  const [ledgerPageSize, setLedgerPageSize] = useState(snapshot?.ledgerPageSize ?? 25);
  const [ledgerTotal, setLedgerTotal] = useState(snapshot?.ledgerTotal ?? 0);
  const [ledgerTotalPages, setLedgerTotalPages] = useState(snapshot?.ledgerTotalPages ?? 1);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chain = useChainedMultiSelect(snapshot?.chainState);

  // ذخیره‌ی زنده‌ی وضعیت در حافظه‌ی موقت بیرون از چرخه‌ی کامپوننت — دقیقاً هم‌الگوی AccountsReview.tsx —
  // تا با رفتن به یک تب دیگر (مثلاً باز کردن سند از تب گردش) و بازگشت، وضعیت این صفحه از دست نرود.
  useEffect(() => {
    setWarehouseReviewSnapshot(mode, {
      chainState: { selections: chain.selections, order: chain.order },
      activeTab,
      filters,
      tabData,
      loadedTabs: Array.from(loadedTabs),
      ledgerRows,
      ledgerPage,
      ledgerPageSize,
      ledgerTotal,
      ledgerTotalPages,
    });
  }, [mode, chain.selections, chain.order, activeTab, filters, tabData, loadedTabs, ledgerRows, ledgerPage, ledgerPageSize, ledgerTotal, ledgerTotalPages]);

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

  function defaultDateRange(periodsList: FiscalPeriod[]) {
    const savedId = getSavedFiscalPeriodId();
    const current =
      (savedId && periodsList.find((p) => String(p.id) === savedId)) ||
      [...periodsList].sort((a, b) => (a.toDate < b.toDate ? 1 : -1))[0];
    return current ? { fromDate: current.fromDate.slice(0, 10), toDate: current.toDate.slice(0, 10) } : { fromDate: "", toDate: "" };
  }

  useEffect(() => {
    async function init() {
      const [per, lvls]: [FiscalPeriod[], GroupLevel[]] = await Promise.all([
        api.get("/fiscal-periods"),
        api.get("/goods-group-levels"),
      ]);
      setPeriods(per);
      setGroupLevels(lvls);
      setLevelsLoaded(true);
      setFilters((prev) => (prev.fromDate ? prev : defaultDateRange(per)));
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
    setTabLoading(true);
    setError(null);
    try {
      const p = buildParams(tabIndex);
      if (isGroupLevelTab(tabIndex)) {
        const level = groupLevels[tabIndex - GROUP_LEVEL_TAB_START];
        if (level) p.set("levelOrder", String(level.order));
      }
      const data = await api.get(`${dimEndpoint(tabIndex)}?${p.toString()}`);
      setTabData((prev) => ({ ...prev, [tabIndex]: data }));
      setLoadedTabs((prev) => new Set(prev).add(tabIndex));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setTabLoading(false);
    }
  }

  async function loadLedger(page = 1, pageSize = ledgerPageSize) {
    setLedgerLoading(true);
    setError(null);
    try {
      const p = buildParams(LEDGER_TAB);
      p.set("page", String(page));
      p.set("pageSize", String(pageSize));
      const data = await api.get(`/warehouse-review/ledger?${p.toString()}`);
      setLedgerRows(data.rows);
      setLedgerPage(data.page);
      setLedgerPageSize(data.pageSize);
      setLedgerTotal(data.total);
      setLedgerTotalPages(data.totalPages);
      setLoadedTabs((prev) => new Set(prev).add(LEDGER_TAB));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLedgerLoading(false);
    }
  }

  function changeLedgerPageSize(size: number) {
    loadLedger(1, size);
  }

  const skippedInitialFetch = useRef(false);

  useEffect(() => {
    if (!levelsLoaded || !filters.fromDate) return;
    if (!skippedInitialFetch.current) {
      skippedInitialFetch.current = true;
      if (loadedTabs.has(activeTab)) return;
    }
    if (activeTab === LEDGER_TAB) loadLedger();
    else loadDimTab(activeTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, chain.selections, chain.order, filters, levelsLoaded, groupLevels]);

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
    setLedgerRows([]);
    setLedgerPage(1);
    setLoadedTabs(new Set());
    setActiveTab(0);
  }

  function clearEverything() {
    resetAll();
    setFilters(defaultDateRange(periods));
  }

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

  async function exportLedgerCsv() {
    setError(null);
    try {
      const p = buildParams(LEDGER_TAB);
      p.set("page", "1");
      p.set("pageSize", "100000");
      const data = await api.get(`/warehouse-review/ledger?${p.toString()}`);
      const header = [
        "نوع", "نوع سند", "شماره", "تاریخ", "کد انبار", "انبار", "کد کالا", "کالا", "مقدار",
        ...(mode === "amount" ? ["مبلغ"] : []), "مانده",
        ...(mode === "amount" ? ["مانده مبلغی"] : []), "کد تفصیل", "عنوان تفصیل",
      ];
      // مقدار/مبلغ در داده‌ی خام همیشه اندازه‌ی مثبت است (جهت از فیلد نوع/direction معلوم می‌شود)؛ در
      // نمای تصویری با پرانتز/رنگ قرمز منفی نشان داده می‌شود، ولی CSV رنگ/پرانتز ندارد، پس اینجا باید
      // واقعاً با علامت منفی صادر شود تا خروجی اکسل هم فرمت حسابداریِ رایج (صادره = منفی) را نشان دهد
      const rows = data.rows.map((r: LedgerRow) => {
        const sign = r.direction === "OUT" ? -1 : 1;
        return [
          DIRECTION_FA[r.direction], r.docType, r.docNumber, toEnglishDigits(formatJalaliDate(r.date)), r.warehouseCode ?? "", r.warehouseTitle || "", r.goodsItemCode, r.goodsItemTitle, r.quantity * sign,
          ...(mode === "amount" ? [r.amount * sign] : []), r.runningQuantity,
          ...(mode === "amount" ? [r.runningAmount] : []), r.detailCode || "", r.detailTitle || "",
        ];
      });
      const csv = [header, ...rows].map((row) => row.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "گردش-موجودی-انبار.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="header-toolbar" style={{ gap: 4 }}>
          <InfoHint text={infoText(mode)} title={mode === "qty" ? "مرور تعدادی" : "مرور مبلغی"} />
          <RefreshButton onClick={refreshCurrentTab} title="رفرش تب جاری" />
        </div>
      </div>

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
          <span style={{ flex: 1 }} />
          <button type="button" className="btn secondary" onClick={clearEverything}>حذف همه فیلترها</button>
        </div>
      </div>

      <ChainedTabsBar tabs={tabDefs} activeIndex={activeTab} onChange={setActiveTab} />

      {activeTab !== LEDGER_TAB && (
        <SelectableBalanceTable rows={tabData[activeTab] || []} columns={columns} selected={chain.get(activeTab)} onToggle={onToggleRow} loading={tabLoading} />
      )}

      {activeTab === LEDGER_TAB && (
        <div className="datatable-root">
          <div className="ar-ledger-toolbar">
            <span style={{ flex: 1 }} />
            <button type="button" className="btn secondary" onClick={() => window.print()}>چاپ</button>
            <button type="button" className="btn secondary" onClick={exportLedgerCsv}>خروجی اکسل (CSV)</button>
          </div>
          <div className="grid-wrap">
            <div className="card grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }}>
              {ledgerLoading && ledgerRows.length === 0 ? (
                <div className="empty-state">در حال بارگذاری...</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>نوع</th>
                      <th>نوع سند</th>
                      <th>شماره</th>
                      <th>تاریخ</th>
                      <th>کد انبار</th>
                      <th>انبار</th>
                      <th>کد کالا</th>
                      <th>کالا</th>
                      <th>مقدار</th>
                      {mode === "amount" && <th>مبلغ</th>}
                      <th>مانده در خط</th>
                      {mode === "amount" && <th>مانده مبلغی در خط</th>}
                      <th>کد تفصیل</th>
                      <th>عنوان تفصیل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerRows.length === 0 && (
                      <tr><td colSpan={mode === "amount" ? 14 : 12} className="empty-state" style={{ border: "none" }}>گردشی یافت نشد</td></tr>
                    )}
                    {ledgerRows.map((r, i) => (
                      <tr
                        key={i}
                        onDoubleClick={() => {
                          const full = DOC_TYPE_FULL_PATH[r.docType];
                          if (full) {
                            openTab(`${full}/${r.docId}/edit`);
                            return;
                          }
                          const seg = DOC_TYPE_PATH[r.docType];
                          if (seg) openTab(`${basePath}/${seg}/${r.docId}/edit`);
                        }}
                        style={{ cursor: "pointer" }}
                        title="دابل‌کلیک برای باز کردن سند"
                      >
                        <td><span className="badge">{DIRECTION_FA[r.direction]}</span></td>
                        <td>{r.docType}</td>
                        <td>{toFaDigits(String(r.docNumber))}</td>
                        <td>{formatJalaliDate(r.date)}</td>
                        <td>{r.warehouseCode != null ? toFaDigits(String(r.warehouseCode)) : "—"}</td>
                        <td>{r.warehouseTitle || "—"}</td>
                        <td>{toFaDigits(r.goodsItemCode)}</td>
                        <td>{r.goodsItemTitle}</td>
                        <td>{formatAccountingAmount(r.quantity, r.direction === "OUT")}</td>
                        {mode === "amount" && <td>{formatAccountingAmount(r.amount, r.direction === "OUT")}</td>}
                        <td>{formatAmountFa(r.runningQuantity)}</td>
                        {mode === "amount" && <td>{formatAmountFa(r.runningAmount)}</td>}
                        <td>{r.detailCode ? toFaDigits(r.detailCode) : "—"}</td>
                        <td>{r.detailTitle || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="grid-footer">
              <span className="grid-footer-info">
                {ledgerLoading
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
                  <button type="button" className="btn secondary" disabled={ledgerPage <= 1 || ledgerLoading} onClick={() => loadLedger(1)}>ابتدا</button>
                  <button type="button" className="btn secondary" disabled={ledgerPage <= 1 || ledgerLoading} onClick={() => loadLedger(ledgerPage - 1)}>قبلی</button>
                  <span className="grid-page-indicator">صفحه {toFaDigits(String(ledgerPage))} از {toFaDigits(String(ledgerTotalPages))}</span>
                  <button type="button" className="btn secondary" disabled={ledgerPage >= ledgerTotalPages || ledgerLoading} onClick={() => loadLedger(ledgerPage + 1)}>بعدی</button>
                  <button type="button" className="btn secondary" disabled={ledgerPage >= ledgerTotalPages || ledgerLoading} onClick={() => loadLedger(ledgerTotalPages)}>انتها</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
