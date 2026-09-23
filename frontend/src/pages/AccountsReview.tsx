import { useEffect, useMemo, useState } from "react";
import { ErrorToast } from "../components/ErrorToast";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { ChainedTabsBar } from "../components/ChainedTabsBar";
import { SelectableBalanceTable, BalanceTableColumn } from "../components/SelectableBalanceTable";
import { AdvancedFilterDialog, AdvancedFilterButton } from "../components/AdvancedFilterDialog";
import { RefreshButton } from "../components/RefreshButton";
import { useChainedMultiSelect, SelectId } from "../lib/useChainedMultiSelect";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { resolveReviewDateRange, FiscalPeriodRange } from "../lib/fiscalYearDefaultDate";
import { useReviewTabLoader, useReviewTabActivation, useReviewTabViewState, serializeForDepsKey } from "../lib/useReviewTabLoader";
import { useTabs } from "../lib/TabsContext";
import { getAccountsReviewSnapshot, setAccountsReviewSnapshot, DetailQueryState } from "../lib/accountsReviewCache";
import { api } from "../lib/api";
import { InfoHint } from "../components/InfoHint";
import { ActiveFilter, ColumnFilterType } from "../components/DataTable";

interface Level { id: number; order: number; title: string }
interface DocType { id: number; title: string; systemKey: string | null }
interface BalanceRow {
  id: SelectId;
  code: string;
  title: string;
  hasChildren: boolean;
  totalDebit: number;
  totalCredit: number;
  balance: number;
  balanceNature: "DEBIT" | "CREDIT";
}
interface LedgerRow {
  id: number;
  journalEntryId: number;
  number: number;
  referenceNumber: number;
  date: string;
  documentType: string;
  issuingSystem: string;
  status: string;
  description: string | null;
  debit: number;
  credit: number;
  runningBalance: number;
  runningBalanceNature: "DEBIT" | "CREDIT";
}

const STATUS_FA: Record<string, string> = { DRAFT: "ثبت", REVIEW: "بررسی", APPROVED: "تایید" };
const ISSUING_SYSTEM_FA: Record<string, string> = {
  ACCOUNTING: "حسابداری",
  ACCOUNTING_EXCEL_IMPORT: "حسابداری (ورود از اکسل)",
  ACCOUNT_CLOSING: "بستن حسابها",
  OPENING_CLOSING: "افتتاحیه و اختتامیه",
  WAREHOUSE: "اسناد انبار",
  PURCHASE: "فاکتور خرید",
  TREASURY: "خزانه‌داری",
};
const DETAIL_SLOTS = [1, 2, 3] as const;

const balanceColumns = [
  { header: "کد", render: (r: BalanceRow) => toFaDigits(r.code), width: "110px", sortValue: (r: BalanceRow) => r.code, filterType: "string" as ColumnFilterType, filterValue: (r: BalanceRow) => r.code },
  { header: "عنوان", render: (r: BalanceRow) => r.title, sortValue: (r: BalanceRow) => r.title, filterType: "string" as ColumnFilterType, filterValue: (r: BalanceRow) => r.title },
  { header: "جمع بدهکار", render: (r: BalanceRow) => formatAmountFa(r.totalDebit), sortValue: (r: BalanceRow) => r.totalDebit, filterType: "number" as ColumnFilterType, filterValue: (r: BalanceRow) => r.totalDebit, decimal: true },
  { header: "جمع بستانکار", render: (r: BalanceRow) => formatAmountFa(r.totalCredit), sortValue: (r: BalanceRow) => r.totalCredit, filterType: "number" as ColumnFilterType, filterValue: (r: BalanceRow) => r.totalCredit, decimal: true },
  {
    header: "مانده بدهکار",
    render: (r: BalanceRow) => (r.balanceNature === "DEBIT" && r.balance ? formatAmountFa(r.balance) : "—"),
    sortValue: (r: BalanceRow) => (r.balanceNature === "DEBIT" ? r.balance : 0),
    filterType: "number" as ColumnFilterType,
    filterValue: (r: BalanceRow) => (r.balanceNature === "DEBIT" ? r.balance : 0),
    decimal: true,
    totalValue: (r: BalanceRow) => (r.balanceNature === "DEBIT" ? r.balance : 0),
  },
  {
    header: "مانده بستانکار",
    render: (r: BalanceRow) => (r.balanceNature === "CREDIT" && r.balance ? formatAmountFa(r.balance) : "—"),
    sortValue: (r: BalanceRow) => (r.balanceNature === "CREDIT" ? r.balance : 0),
    filterType: "number" as ColumnFilterType,
    filterValue: (r: BalanceRow) => (r.balanceNature === "CREDIT" ? r.balance : 0),
    decimal: true,
    totalValue: (r: BalanceRow) => (r.balanceNature === "CREDIT" ? r.balance : 0),
  },
];

// نسخه‌ی ستون‌های تب‌های تفصیل: مثل balanceColumns ولی «مانده بدهکار»/«مانده بستانکار» فاقد sortValue/filterValue هستند
// چون این دو، نمایش تفکیک‌شده‌ی یک مقدار محاسبه‌شده (balance/balanceNature) هستند و سمت سرور قابل مرتب‌سازی/فیلتر نیستند
// (مرتب‌سازی و فیلتر واقعی روی «جمع بدهکار»/«جمع بستانکار» که مقادیر مستقیم دیتابیس هستند، همچنان کاملاً پشتیبانی می‌شود)
// — decimal/totalValue عمداً حفظ می‌شوند: جمع پای گرید کاملاً سمت کلاینت است، به فیلتر/مرتب‌سازی سمت سرور نیازی ندارد.
const detailBalanceColumns = balanceColumns.map((c) =>
  c.header === "مانده بدهکار" || c.header === "مانده بستانکار"
    ? { header: c.header, render: c.render, width: (c as any).width, decimal: (c as any).decimal, totalValue: (c as any).totalValue }
    : c
);

// نگاشت عنوان فارسی ستون به نام فیلد سمت سرور (route بک‌اند /reports/detail-summary)
const DETAIL_SORT_FIELD_MAP: Record<string, string> = {
  "کد": "code",
  "عنوان": "title",
  "جمع بدهکار": "totalDebit",
  "جمع بستانکار": "totalCredit",
};

const DEFAULT_DETAIL_QUERY: DetailQueryState = { page: 1, pageSize: 25, sort: null, filters: {} };

// ستون‌های تب «گردش» — دقیقاً هم‌الگوی balanceColumns/detailBalanceColumns بالا، حالا از طریق
// SelectableBalanceTable (به‌جای <table> دستی قبلی) رندر می‌شوند. کلیدها (field) باید دقیقاً با
// LEDGER_COLUMNS در backend/src/routes/reports.ts یکی باشند. «مانده بدهکار/بستانکار» عمداً بدون
// sortValue/filterType‌اند — یک مقدار تجمعیِ وابسته به ترتیب پردازش سرور است، نه مقدار مستقیم قابل
// فیلتر (نگاه کنید به یادداشت مشابه در warehouseReview.ts#ledgerColumnDefs).
function ledgerColumns(showRunningBalance: boolean): (BalanceTableColumn<LedgerRow> & { field: string })[] {
  const cols: (BalanceTableColumn<LedgerRow> & { field: string })[] = [
    { header: "شماره سند", field: "number", render: (r) => toFaDigits(String(r.number)), sortValue: (r) => r.number, filterType: "number", filterValue: (r) => r.number },
    { header: "شماره عطف", field: "referenceNumber", render: (r) => toFaDigits(String(r.referenceNumber)), sortValue: (r) => r.referenceNumber, filterType: "number", filterValue: (r) => r.referenceNumber },
    { header: "تاریخ", field: "date", render: (r) => formatJalaliDate(r.date), sortValue: (r) => r.date, filterType: "date", filterValue: (r) => r.date?.slice(0, 10) },
    { header: "نوع سند", field: "documentType", render: (r) => r.documentType, sortValue: (r) => r.documentType, filterType: "string", filterValue: (r) => r.documentType },
    { header: "سیستم", field: "issuingSystem", render: (r) => ISSUING_SYSTEM_FA[r.issuingSystem] || r.issuingSystem, sortValue: (r) => ISSUING_SYSTEM_FA[r.issuingSystem] || r.issuingSystem, filterType: "string", filterValue: (r) => ISSUING_SYSTEM_FA[r.issuingSystem] || r.issuingSystem },
    { header: "وضعیت", field: "status", render: (r) => <span className="badge">{STATUS_FA[r.status]}</span>, sortValue: (r) => STATUS_FA[r.status] || r.status, filterType: "string", filterValue: (r) => STATUS_FA[r.status] || r.status },
    { header: "شرح", field: "description", render: (r) => r.description || "—", sortValue: (r) => r.description || "", filterType: "string", filterValue: (r) => r.description || "" },
    { header: "بدهکار", field: "debit", render: (r) => (r.debit ? formatAmountFa(r.debit) : "—"), sortValue: (r) => r.debit, filterType: "number", filterValue: (r) => r.debit, decimal: true },
    { header: "بستانکار", field: "credit", render: (r) => (r.credit ? formatAmountFa(r.credit) : "—"), sortValue: (r) => r.credit, filterType: "number", filterValue: (r) => r.credit, decimal: true },
  ];
  if (showRunningBalance) {
    cols.push(
      { header: "مانده بدهکار", field: "runningBalanceDebit", render: (r) => (r.runningBalanceNature === "DEBIT" && r.runningBalance ? formatAmountFa(r.runningBalance) : "—") },
      { header: "مانده بستانکار", field: "runningBalanceCredit", render: (r) => (r.runningBalanceNature === "CREDIT" && r.runningBalance ? formatAmountFa(r.runningBalance) : "—") }
    );
  }
  return cols;
}
const LEDGER_SORT_FIELD_MAP: Record<string, string> = Object.fromEntries(ledgerColumns(false).map((c) => [c.header, c.field]));

export default function AccountsReview() {
  const { openTab } = useTabs();
  const snapshot = getAccountsReviewSnapshot();
  const [levels, setLevels] = useState<Level[]>([]);
  const [docTypes, setDocTypes] = useState<DocType[]>([]);
  const [activeTab, setActiveTab] = useState(snapshot?.activeTab ?? 0);
  const [tabData, setTabData] = useState<Record<number, BalanceRow[]>>(snapshot?.tabData ?? {});
  const tabLoader = useReviewTabLoader(snapshot?.loadedTabs ?? []);
  const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>(snapshot?.ledgerRows ?? []);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerPageSize, setLedgerPageSize] = useState(snapshot?.ledgerPageSize ?? 25);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerTotalPages, setLedgerTotalPages] = useState(1);
  const [detailQuery, setDetailQuery] = useState<Record<number, DetailQueryState>>(snapshot?.detailQuery ?? {});
  const [detailTotal, setDetailTotal] = useState<Record<number, number>>(snapshot?.detailTotal ?? {});
  const [ledgerSort, setLedgerSort] = useState<{ header: string; dir: "asc" | "desc" } | null>(snapshot?.ledgerSort ?? null);
  const [ledgerFilters, setLedgerFilters] = useState<Record<string, ActiveFilter>>(snapshot?.ledgerFilters ?? {});
  const [showRunningBalance, setShowRunningBalance] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [filters, setFilters] = useState(
    snapshot?.filters ?? {
      fromDate: "",
      toDate: "",
      documentTypeIds: new Set<number>(),
      numberFrom: "",
      numberTo: "",
      referenceFrom: "",
      referenceTo: "",
    }
  );

  const accountTabCount = levels.length;
  const detailTabStart = accountTabCount;
  const ledgerTabIndex = accountTabCount + 3;

  const [periods, setPeriods] = useState<FiscalPeriodRange[]>([]);
  const chain = useChainedMultiSelect(snapshot?.chainState);
  const tabView = useReviewTabViewState(activeTab, snapshot?.balanceViewState ?? {});

  // ذخیره‌ی زنده‌ی وضعیت در حافظه‌ی موقت بیرون از چرخه‌ی کامپوننت،
  // تا با رفتن به یک تب دیگر (مثلاً باز کردن سند از تب گردش) و بازگشت، وضعیت این صفحه از دست نرود.
  // توجه: levels/docTypes/periods عمداً کش نمی‌شوند و همیشه تازه واکشی می‌شوند
  // (مثلاً اگر یک سطح گزارشگری حذف شده باشد، بلافاصله در تب‌ها منعکس شود)
  useEffect(() => {
    setAccountsReviewSnapshot({
      chainState: { selections: chain.selections, order: chain.order },
      activeTab,
      filters,
      tabData,
      balanceViewState: tabView.viewState,
      detailQuery,
      detailTotal,
      ledgerRows,
      ledgerPageSize,
      ledgerSort,
      ledgerFilters,
      loadedTabs: Array.from(tabLoader.loadedTabs),
    });
  }, [chain.selections, chain.order, activeTab, filters, tabData, tabView.viewState, detailQuery, detailTotal, ledgerRows, ledgerPageSize, ledgerSort, ledgerFilters, tabLoader.loadedTabs]);

  useEffect(() => {
    async function init() {
      const [lvls, docs, per]: [Level[], DocType[], FiscalPeriodRange[]] = await Promise.all([
        api.get("/reporting-levels"),
        api.get("/document-types"),
        api.get("/fiscal-periods"),
      ]);
      setLevels(lvls);
      setDocTypes(docs);
      setPeriods(per);
      // اگر بازه‌ی تاریخ از قبل (از حافظه‌ی موقت) موجود نیست، پیش‌فرض دوره مالی جاری را ست کن و همه‌ی
      // انواع سند را پیش‌فرض تیک بزن — طبق تصمیم صریح کاربر، به‌جز «بستن حسابها» (اختتامیه‌ی سود و زیان)
      // و «اختتامیه» (اختتامیه‌ی سال مالی) که نباید پیش‌فرض تیک باشند؛ هر نوع سند تازه‌ای که بعداً اضافه
      // شود هم باید خودکار پیش‌فرض تیک باشد، پس این یک لیست سفید نیست بلکه استثنا روی همه است.
      const excludedByDefault = new Set(["CLOSING_ACCOUNTS", "CLOSING"]);
      const defaultDocTypeIds = new Set(docs.filter((d) => !excludedByDefault.has(d.systemKey || "")).map((d) => d.id));
      setFilters((prev) =>
        prev.fromDate
          ? prev
          : {
              ...prev,
              ...resolveReviewDateRange(per),
              documentTypeIds: defaultDocTypeIds,
            }
      );
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filterParams = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.fromDate) p.set("fromDate", filters.fromDate);
    if (filters.toDate) p.set("toDate", filters.toDate);
    if (filters.documentTypeIds.size) p.set("documentTypeIds", Array.from(filters.documentTypeIds).join(","));
    if (filters.numberFrom) p.set("numberFrom", filters.numberFrom);
    if (filters.numberTo) p.set("numberTo", filters.numberTo);
    if (filters.referenceFrom) p.set("referenceFrom", filters.referenceFrom);
    if (filters.referenceTo) p.set("referenceTo", filters.referenceTo);
    return p;
  }, [filters]);

  /**
   * برای تب حسابیِ tabIndex (با سطح levelIndex)، از بین تب‌های حسابیِ «بالادست در ترتیب زمانی»،
   * نزدیک‌ترین تب کم‌عمق‌تر (برای فیلتر بالا-به-پایین) و نزدیک‌ترین تب عمیق‌تر (برای فیلتر پایین-به-بالا) را برمی‌گرداند
   */
  function accountConstraints(tabIndex: number): { parentIds: SelectId[]; descendantIds: SelectId[] } {
    const before = chain.tabsBefore(tabIndex);
    let parentIds: SelectId[] = [];
    let parentDist = Infinity;
    let descendantIds: SelectId[] = [];
    let descDist = Infinity;
    for (const t of before) {
      if (t >= accountTabCount) continue; // فقط تب‌های سطح حساب
      const ids = Array.from(chain.get(t));
      if (!ids.length) continue;
      const dist = Math.abs(t - tabIndex);
      if (t < tabIndex && dist < parentDist) {
        parentIds = ids;
        parentDist = dist;
      }
      if (t > tabIndex && dist < descDist) {
        descendantIds = ids;
        descDist = dist;
      }
    }
    return { parentIds, descendantIds };
  }

  /** فیلترهای تفصیلیِ فعال در بین تب‌های «بالادستِ زمانیِ» tabIndex (هر اسلات مستقل) */
  function detailConstraints(tabIndex: number): Record<1 | 2 | 3, string[]> {
    const before = chain.tabsBefore(tabIndex);
    const result: Record<1 | 2 | 3, string[]> = { 1: [], 2: [], 3: [] };
    for (const t of before) {
      if (t < detailTabStart || t >= ledgerTabIndex) continue;
      const slot = (t - detailTabStart + 1) as 1 | 2 | 3;
      const ids = Array.from(chain.get(t)).map(String);
      if (ids.length) result[slot] = ids;
    }
    return result;
  }

  async function loadAccountTab(tabIndex: number) {
    await tabLoader.run(
      tabIndex,
      async (isStale) => {
        const level = levels[tabIndex];
        const p = new URLSearchParams(filterParams);
        p.set("levelOrder", String(level.order));
        const { parentIds, descendantIds } = accountConstraints(tabIndex);
        if (parentIds.length) p.set("parentIds", parentIds.join(","));
        if (descendantIds.length) p.set("descendantIds", descendantIds.join(","));
        const details = detailConstraints(tabIndex);
        DETAIL_SLOTS.forEach((slot) => {
          if (details[slot].length) p.set(`detail${slot}Codes`, details[slot].join(","));
        });
        const data = await api.get(`/reports/trial-balance?${p.toString()}`);
        if (isStale()) return; // یک fetch تازه‌تر برای همین تب در راه است/رسیده — این پاسخ دیرآمده نادیده گرفته می‌شود
        setTabData((prev) => ({ ...prev, [tabIndex]: data }));
      },
      setError
    );
  }

  async function loadDetailTab(tabIndex: number, slot: 1 | 2 | 3) {
    await tabLoader.run(
      tabIndex,
      async (isStale) => {
        const q = detailQuery[tabIndex] ?? DEFAULT_DETAIL_QUERY;
        const p = new URLSearchParams(filterParams);
        p.set("slot", String(slot));
        const { parentIds } = accountConstraints(tabIndex);
        if (parentIds.length) p.set("parentIds", parentIds.join(","));
        const details = detailConstraints(tabIndex);
        DETAIL_SLOTS.forEach((s) => {
          if (s !== slot && details[s].length) p.set(`detail${s}Codes`, details[s].join(","));
        });
        p.set("page", String(q.page));
        p.set("pageSize", String(q.pageSize));
        if (q.sort) {
          const field = DETAIL_SORT_FIELD_MAP[q.sort.header];
          if (field) {
            p.set("sortField", field);
            p.set("sortDir", q.sort.dir);
          }
        }
        if (q.filters && Object.keys(q.filters).length) {
          const mapped: Record<string, ActiveFilter> = {};
          for (const [header, f] of Object.entries(q.filters)) {
            const field = DETAIL_SORT_FIELD_MAP[header];
            if (field) mapped[field] = f;
          }
          if (Object.keys(mapped).length) p.set("filters", JSON.stringify(mapped));
        }
        const data = await api.get(`/reports/detail-summary?${p.toString()}`);
        if (isStale()) return;
        setTabData((prev) => ({ ...prev, [tabIndex]: data.rows }));
        setDetailTotal((prev) => ({ ...prev, [tabIndex]: data.total }));
      },
      setError
    );
  }

  /** تغییر صفحه/تعداد در صفحه/مرتب‌سازیِ تب تفصیل جاری — به‌روزرسانی detailQuery باعث fetch مجدد (از طریق useEffect اصلی) می‌شود */
  function updateDetailQuery(tabIndex: number, patch: Partial<DetailQueryState>) {
    setDetailQuery((prev) => ({ ...prev, [tabIndex]: { ...(prev[tabIndex] ?? DEFAULT_DETAIL_QUERY), ...patch } }));
  }

  async function loadLedger(page = 1, pageSize = ledgerPageSize, sort = ledgerSort, colFilters = ledgerFilters) {
    await tabLoader.run(
      ledgerTabIndex,
      async (isStale) => {
        const p = new URLSearchParams(filterParams);
        const { parentIds } = accountConstraints(ledgerTabIndex);
        if (parentIds.length) p.set("parentIds", parentIds.join(","));
        const details = detailConstraints(ledgerTabIndex);
        DETAIL_SLOTS.forEach((slot) => {
          if (details[slot].length) p.set(`detail${slot}Codes`, details[slot].join(","));
        });
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
        const data = await api.get(`/reports/ledger?${p.toString()}`);
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

  function onLedgerSortChange(sort: { header: string; dir: "asc" | "desc" } | null) {
    setLedgerSort(sort);
    loadLedger(1, ledgerPageSize, sort, ledgerFilters);
  }

  function onLedgerFiltersChange(f: Record<string, ActiveFilter>) {
    setLedgerFilters(f);
    loadLedger(1, ledgerPageSize, ledgerSort, f);
  }

  const activationDepsKey = useMemo(
    () =>
      serializeForDepsKey({
        levels,
        selections: chain.selections,
        order: chain.order,
        filterParams: filterParams.toString(),
        detailQuery: detailQuery[activeTab],
      }),
    [levels, chain.selections, chain.order, filterParams, detailQuery, activeTab]
  );
  useReviewTabActivation(
    levels.length > 0 && !!filters.fromDate,
    activeTab,
    tabLoader.loadedTabs,
    (tab) => {
      if (tab < accountTabCount) loadAccountTab(tab);
      else if (tab < ledgerTabIndex) loadDetailTab(tab, (tab - detailTabStart + 1) as 1 | 2 | 3);
      else loadLedger();
    },
    activationDepsKey
  );

  /** رفرش دستی تب فعلی — فقط داده‌ی همان تب را دوباره از سرور می‌گیرد، به فیلترها/انتخاب‌ها دست نمی‌زند */
  function refreshCurrentTab() {
    if (activeTab < accountTabCount) loadAccountTab(activeTab);
    else if (activeTab < ledgerTabIndex) loadDetailTab(activeTab, (activeTab - detailTabStart + 1) as 1 | 2 | 3);
    else loadLedger();
  }

  function onToggleRow(id: SelectId) {
    chain.toggle(activeTab, id);
  }

  function resetAll() {
    chain.reset();
    setTabData({});
    tabView.reset();
    setDetailQuery({});
    setDetailTotal({});
    setLedgerPage(1);
    tabLoader.resetLoaded();
    setActiveTab(0);
  }

  /** دکمه‌ی «حذف همه فیلترها» — طبق اصلاح صریح کاربر (۱۴۰۵/۰۶/۱۹): انتخاب یک ردیف در یک تب (که فیلتر
   * تب‌های بعدی/قبلی زنجیره را تعیین می‌کند) هم خودش دقیقاً یک «فیلتر» است، نه چیزی جدا — نسخه‌ی قبلی
   * این تابع اشتباهاً چیزی جز فیلترهای ستونی گرید را دست‌نخورده می‌گذاشت (از جمله انتخاب‌های زنجیره‌ای)،
   * که باعث می‌شد مثلاً انتخاب یک ردیف در تب «گروه» با این دکمه پاک نشود. تنها استثنای واقعی همان چیزی
   * است که از اول گفته شده بود: فیلترهای «بالای گزارش» (بازه تاریخ، و دیالوگ فیلتر پیشرفته شامل انواع
   * سند/محدوده‌ی شماره سند/عطف) — این‌ها با resetAll (که با تغییر واقعی‌شان صدا زده می‌شود) بازنشانی
   * می‌شوند، نه با این دکمه. همه‌چیز دیگر (انتخاب‌های زنجیره‌ای تب‌ها، فیلتر/مرتب‌سازی ستونی سه‌گانه‌ی
   * tabView/detailQuery/ledgerFilters، دادهٔ بارگذاری‌شده، و بازگشت به اولین تب) پاک می‌شود — دقیقاً
   * هم‌الگوی resetAll، فقط بدون setFilters. */
  function clearFilters() {
    chain.reset();
    setTabData({});
    tabView.reset();
    setDetailQuery({});
    setDetailTotal({});
    setLedgerRows([]);
    setLedgerPage(1);
    setLedgerTotal(0);
    setLedgerTotalPages(1);
    setLedgerFilters({});
    setLedgerSort(null);
    tabLoader.resetLoaded();
    setActiveTab(0);
  }

  function toggleDocType(id: number) {
    setFilters((prev) => {
      const next = new Set(prev.documentTypeIds);
      next.has(id) ? next.delete(id) : next.add(id);
      return { ...prev, documentTypeIds: next };
    });
    resetAll();
  }

  const extraFilterCount =
    filters.documentTypeIds.size + (filters.numberFrom ? 1 : 0) + (filters.numberTo ? 1 : 0) + (filters.referenceFrom ? 1 : 0) + (filters.referenceTo ? 1 : 0);

  const tabDefs = [
    ...levels.map((lvl, idx) => ({ key: `lvl-${lvl.id}`, label: lvl.title, count: chain.get(idx).size })),
    ...DETAIL_SLOTS.map((slot) => ({ key: `detail-${slot}`, label: `تفصیل ${toFaDigits(String(slot))}`, count: chain.get(detailTabStart + slot - 1).size })),
    { key: "ledger", label: "گردش", count: 0 },
  ];

  const ledgerCols = useMemo(() => ledgerColumns(showRunningBalance), [showRunningBalance]);

  return (
    <div>
      <ErrorToast message={error} />

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
          <AdvancedFilterButton count={extraFilterCount} onClick={() => setFiltersOpen(true)} />
        </div>
      </div>

      {filtersOpen && (
        <AdvancedFilterDialog onApply={resetAll} onClose={() => setFiltersOpen(false)} onClear={() => setFilters((p) => ({ ...p, documentTypeIds: new Set(), numberFrom: "", numberTo: "", referenceFrom: "", referenceTo: "" }))}>
          <div className="form-field-inline">
            <label>شماره سند از</label>
            <input dir="ltr" value={filters.numberFrom} onChange={(e) => setFilters((p) => ({ ...p, numberFrom: e.target.value }))} />
          </div>
          <div className="form-field-inline">
            <label>شماره سند تا</label>
            <input dir="ltr" value={filters.numberTo} onChange={(e) => setFilters((p) => ({ ...p, numberTo: e.target.value }))} />
          </div>
          <div className="form-field-inline">
            <label>شماره عطف از</label>
            <input dir="ltr" value={filters.referenceFrom} onChange={(e) => setFilters((p) => ({ ...p, referenceFrom: e.target.value }))} />
          </div>
          <div className="form-field-inline">
            <label>شماره عطف تا</label>
            <input dir="ltr" value={filters.referenceTo} onChange={(e) => setFilters((p) => ({ ...p, referenceTo: e.target.value }))} />
          </div>
          <div className="form-field-inline" style={{ alignItems: "flex-start" }}>
            <label>انواع سند</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {docTypes.map((d) => (
                <label key={d.id} className="checkbox-row">
                  <input type="checkbox" checked={filters.documentTypeIds.has(d.id)} onChange={() => toggleDocType(d.id)} />
                  {d.title}
                </label>
              ))}
            </div>
          </div>
        </AdvancedFilterDialog>
      )}

      <ChainedTabsBar
        tabs={tabDefs}
        activeIndex={activeTab}
        onChange={setActiveTab}
        actions={
          <>
            <InfoHint text={`گزارش سلسله‌مراتبی مانده‌ی حساب‌ها — در هر تب چندین ردیف قابل انتخاب است؛ فقط حساب‌های دارای گردش در بازه نمایش داده می‌شوند`} title="مرور حسابها" />
            <RefreshButton onClick={refreshCurrentTab} title="رفرش تب جاری" />
          </>
        }
        onClearFilters={clearFilters}
      />

      {activeTab < detailTabStart && (
        <SelectableBalanceTable
          stateKey={activeTab}
          rows={tabData[activeTab] || []}
          columns={balanceColumns}
          selected={chain.get(activeTab)}
          onToggle={onToggleRow}
          loading={tabLoader.loading}
          restoreFilters={tabView.restoreFilters}
          restoreSort={tabView.restoreSort}
          onFiltersChange={tabView.onFiltersChange}
          onSortChange={tabView.onSortChange}
        />
      )}

      {activeTab >= detailTabStart && activeTab < ledgerTabIndex && (
        <SelectableBalanceTable
          stateKey={activeTab}
          restoreFilters={(detailQuery[activeTab] ?? DEFAULT_DETAIL_QUERY).filters}
          restoreSort={(detailQuery[activeTab] ?? DEFAULT_DETAIL_QUERY).sort}
          rows={tabData[activeTab] || []}
          columns={detailBalanceColumns}
          selected={chain.get(activeTab)}
          onToggle={onToggleRow}
          loading={tabLoader.loading}
          serverPaging={{
            page: (detailQuery[activeTab] ?? DEFAULT_DETAIL_QUERY).page,
            pageSize: (detailQuery[activeTab] ?? DEFAULT_DETAIL_QUERY).pageSize,
            total: detailTotal[activeTab] ?? 0,
            loading: tabLoader.loading,
            onPageChange: (page) => updateDetailQuery(activeTab, { page }),
            onPageSizeChange: (pageSize) => updateDetailQuery(activeTab, { pageSize, page: 1 }),
            onSortChange: (sort) => updateDetailQuery(activeTab, { sort, page: 1 }),
            onFiltersChange: (filters) => updateDetailQuery(activeTab, { filters, page: 1 }),
          }}
        />
      )}

      {activeTab === ledgerTabIndex && (
        <>
          <div className="ar-ledger-toolbar">
            <label className="checkbox-row">
              <input type="checkbox" checked={showRunningBalance} onChange={(e) => setShowRunningBalance(e.target.checked)} />
              مانده در خط
            </label>
          </div>
          <SelectableBalanceTable
            stateKey={ledgerTabIndex}
            rows={ledgerRows}
            columns={ledgerCols}
            selectable={false}
            onRowDoubleClick={(r) => openTab(`/journal-entries/${r.journalEntryId}/edit`)}
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
        </>
      )}
    </div>
  );
}
