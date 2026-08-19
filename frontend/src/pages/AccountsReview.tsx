import { useEffect, useMemo, useRef, useState } from "react";
import { JalaliDatePicker } from "../components/JalaliDatePicker";
import { ChainedTabsBar } from "../components/ChainedTabsBar";
import { SelectableBalanceTable } from "../components/SelectableBalanceTable";
import { AdvancedFilterDialog, AdvancedFilterButton } from "../components/AdvancedFilterDialog";
import { RefreshButton } from "../components/RefreshButton";
import { useChainedMultiSelect, SelectId } from "../lib/useChainedMultiSelect";
import { formatAmountFa, toFaDigits } from "../lib/formatAmount";
import { formatJalaliDate } from "../lib/formatDate";
import { getSavedFiscalPeriodId } from "../lib/userSettings";
import { useTabs } from "../lib/TabsContext";
import { getAccountsReviewSnapshot, setAccountsReviewSnapshot, DetailQueryState } from "../lib/accountsReviewCache";
import { api } from "../lib/api";
import { InfoHint } from "../components/InfoHint";
import { FilterIcon, SortIcon, FilterPopover, ActiveFilter, ColumnFilterType } from "../components/DataTable";

interface Level { id: number; order: number; title: string }
interface DocType { id: number; title: string; systemKey: string | null }
interface FiscalPeriod { id: number; title: string; fromDate: string; toDate: string }
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

function ClearFilterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M3 5h13M3 12h7M3 19h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17 15l5 5M22 15l-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const STATUS_FA: Record<string, string> = { DRAFT: "ثبت", REVIEW: "بررسی", APPROVED: "تایید" };
const NATURE_FA: Record<string, string> = { DEBIT: "بدهکار", CREDIT: "بستانکار" };
const ISSUING_SYSTEM_FA: Record<string, string> = {
  ACCOUNTING: "حسابداری",
  ACCOUNTING_EXCEL_IMPORT: "حسابداری (ورود از اکسل)",
  ACCOUNT_CLOSING: "بستن حسابها",
  OPENING_CLOSING: "افتتاحیه و اختتامیه",
};
const DETAIL_SLOTS = [1, 2, 3] as const;

const balanceColumns = [
  { header: "کد", render: (r: BalanceRow) => toFaDigits(r.code), width: "110px", sortValue: (r: BalanceRow) => r.code, filterType: "string" as ColumnFilterType, filterValue: (r: BalanceRow) => r.code },
  { header: "عنوان", render: (r: BalanceRow) => r.title, sortValue: (r: BalanceRow) => r.title, filterType: "string" as ColumnFilterType, filterValue: (r: BalanceRow) => r.title },
  { header: "جمع بدهکار", render: (r: BalanceRow) => formatAmountFa(r.totalDebit), sortValue: (r: BalanceRow) => r.totalDebit, filterType: "number" as ColumnFilterType, filterValue: (r: BalanceRow) => r.totalDebit },
  { header: "جمع بستانکار", render: (r: BalanceRow) => formatAmountFa(r.totalCredit), sortValue: (r: BalanceRow) => r.totalCredit, filterType: "number" as ColumnFilterType, filterValue: (r: BalanceRow) => r.totalCredit },
  {
    header: "مانده بدهکار",
    render: (r: BalanceRow) => (r.balanceNature === "DEBIT" && r.balance ? formatAmountFa(r.balance) : "—"),
    sortValue: (r: BalanceRow) => (r.balanceNature === "DEBIT" ? r.balance : 0),
    filterType: "number" as ColumnFilterType,
    filterValue: (r: BalanceRow) => (r.balanceNature === "DEBIT" ? r.balance : 0),
  },
  {
    header: "مانده بستانکار",
    render: (r: BalanceRow) => (r.balanceNature === "CREDIT" && r.balance ? formatAmountFa(r.balance) : "—"),
    sortValue: (r: BalanceRow) => (r.balanceNature === "CREDIT" ? r.balance : 0),
    filterType: "number" as ColumnFilterType,
    filterValue: (r: BalanceRow) => (r.balanceNature === "CREDIT" ? r.balance : 0),
  },
];

// نسخه‌ی ستون‌های تب‌های تفصیل: مثل balanceColumns ولی «مانده بدهکار»/«مانده بستانکار» فاقد sortValue/filterValue هستند
// چون این دو، نمایش تفکیک‌شده‌ی یک مقدار محاسبه‌شده (balance/balanceNature) هستند و سمت سرور قابل مرتب‌سازی/فیلتر نیستند
// (مرتب‌سازی و فیلتر واقعی روی «جمع بدهکار»/«جمع بستانکار» که مقادیر مستقیم دیتابیس هستند، همچنان کاملاً پشتیبانی می‌شود)
const detailBalanceColumns = balanceColumns.map((c) =>
  c.header === "مانده بدهکار" || c.header === "مانده بستانکار" ? { header: c.header, render: c.render, width: (c as any).width } : c
);

// نگاشت عنوان فارسی ستون به نام فیلد سمت سرور (route بک‌اند /reports/detail-summary)
const DETAIL_SORT_FIELD_MAP: Record<string, string> = {
  "کد": "code",
  "عنوان": "title",
  "جمع بدهکار": "totalDebit",
  "جمع بستانکار": "totalCredit",
};

const DEFAULT_DETAIL_QUERY: DetailQueryState = { page: 1, pageSize: 25, sort: null, filters: {} };
const LEDGER_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// ستون‌های قابل مرتب‌سازی/فیلتر تب «گردش» — سمت سرور اعمال می‌شود (دقیقاً مثل تب‌های تفصیل بالا و
// فهرست اسناد حسابداری)؛ ستون‌های «مانده بدهکار/بستانکار» عمداً اینجا نیستند چون یک مقدار تجمعیِ
// وابسته به ترتیب پردازش ردیف‌هاست، نه یک مقدار مستقیم قابل فیلتر.
const LEDGER_COLUMNS: { header: string; field: string; filterType: ColumnFilterType }[] = [
  { header: "شماره سند", field: "number", filterType: "number" },
  { header: "شماره عطف", field: "referenceNumber", filterType: "number" },
  { header: "تاریخ", field: "date", filterType: "date" },
  { header: "نوع سند", field: "documentType", filterType: "string" },
  { header: "سیستم", field: "issuingSystem", filterType: "string" },
  { header: "وضعیت", field: "status", filterType: "string" },
  { header: "شرح", field: "description", filterType: "string" },
  { header: "بدهکار", field: "debit", filterType: "number" },
  { header: "بستانکار", field: "credit", filterType: "number" },
];
const LEDGER_SORT_FIELD_MAP: Record<string, string> = Object.fromEntries(LEDGER_COLUMNS.map((c) => [c.header, c.field]));

export default function AccountsReview() {
  const { openTab } = useTabs();
  const snapshot = getAccountsReviewSnapshot();
  const [levels, setLevels] = useState<Level[]>([]);
  const [docTypes, setDocTypes] = useState<DocType[]>([]);
  const [activeTab, setActiveTab] = useState(snapshot?.activeTab ?? 0);
  const [tabData, setTabData] = useState<Record<number, BalanceRow[]>>(snapshot?.tabData ?? {});
  const [tabLoading, setTabLoading] = useState(false);
  const [ledgerRows, setLedgerRows] = useState<LedgerRow[]>(snapshot?.ledgerRows ?? []);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerPageSize, setLedgerPageSize] = useState(snapshot?.ledgerPageSize ?? 25);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerTotalPages, setLedgerTotalPages] = useState(1);
  const [detailQuery, setDetailQuery] = useState<Record<number, DetailQueryState>>(snapshot?.detailQuery ?? {});
  const [detailTotal, setDetailTotal] = useState<Record<number, number>>(snapshot?.detailTotal ?? {});
  const [loadedTabs, setLoadedTabs] = useState<Set<number>>(new Set(snapshot?.loadedTabs ?? []));
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerSort, setLedgerSort] = useState<{ header: string; dir: "asc" | "desc" } | null>(snapshot?.ledgerSort ?? null);
  const [ledgerFilters, setLedgerFilters] = useState<Record<string, ActiveFilter>>(snapshot?.ledgerFilters ?? {});
  const [openLedgerFilterFor, setOpenLedgerFilterFor] = useState<string | null>(null);
  const [ledgerPopoverPos, setLedgerPopoverPos] = useState({ top: 0, left: 0 });
  const ledgerFilterBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
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

  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const chain = useChainedMultiSelect(snapshot?.chainState);

  function defaultDateRange(periodsList: FiscalPeriod[]) {
    const savedId = getSavedFiscalPeriodId();
    const current =
      (savedId && periodsList.find((p) => String(p.id) === savedId)) ||
      [...periodsList].sort((a, b) => (a.toDate < b.toDate ? 1 : -1))[0];
    return current ? { fromDate: current.fromDate.slice(0, 10), toDate: current.toDate.slice(0, 10) } : { fromDate: "", toDate: "" };
  }

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
      detailQuery,
      detailTotal,
      ledgerRows,
      ledgerPageSize,
      ledgerSort,
      ledgerFilters,
      loadedTabs: Array.from(loadedTabs),
    });
  }, [chain.selections, chain.order, activeTab, filters, tabData, detailQuery, detailTotal, ledgerRows, ledgerPageSize, ledgerSort, ledgerFilters, loadedTabs]);

  useEffect(() => {
    async function init() {
      const [lvls, docs, per]: [Level[], DocType[], FiscalPeriod[]] = await Promise.all([
        api.get("/reporting-levels"),
        api.get("/document-types"),
        api.get("/fiscal-periods"),
      ]);
      setLevels(lvls);
      setDocTypes(docs);
      setPeriods(per);
      // اگر بازه‌ی تاریخ از قبل (از حافظه‌ی موقت) موجود نیست، پیش‌فرض دوره مالی جاری را ست کن
      // و نوع سند «عملیاتی» را به‌صورت پیش‌فرض تیک بزن
      const operational = docs.find((d) => d.systemKey === "OPERATIONAL");
      setFilters((prev) =>
        prev.fromDate
          ? prev
          : {
              ...prev,
              ...defaultDateRange(per),
              documentTypeIds: operational ? new Set([operational.id]) : prev.documentTypeIds,
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
    setTabLoading(true);
    setError(null);
    try {
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
      setTabData((prev) => ({ ...prev, [tabIndex]: data }));
      setLoadedTabs((prev) => new Set(prev).add(tabIndex));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setTabLoading(false);
    }
  }

  async function loadDetailTab(tabIndex: number, slot: 1 | 2 | 3) {
    setTabLoading(true);
    setError(null);
    try {
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
      setTabData((prev) => ({ ...prev, [tabIndex]: data.rows }));
      setDetailTotal((prev) => ({ ...prev, [tabIndex]: data.total }));
      setLoadedTabs((prev) => new Set(prev).add(tabIndex));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setTabLoading(false);
    }
  }

  /** تغییر صفحه/تعداد در صفحه/مرتب‌سازیِ تب تفصیل جاری — به‌روزرسانی detailQuery باعث fetch مجدد (از طریق useEffect اصلی) می‌شود */
  function updateDetailQuery(tabIndex: number, patch: Partial<DetailQueryState>) {
    setDetailQuery((prev) => ({ ...prev, [tabIndex]: { ...(prev[tabIndex] ?? DEFAULT_DETAIL_QUERY), ...patch } }));
  }

  async function loadLedger(page = 1, pageSize = ledgerPageSize, sort = ledgerSort, colFilters = ledgerFilters) {
    setLedgerLoading(true);
    setError(null);
    try {
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
      setLedgerRows(data.rows);
      setLedgerPage(data.page);
      setLedgerPageSize(data.pageSize);
      setLedgerTotal(data.total);
      setLedgerTotalPages(data.totalPages);
      setLoadedTabs((prev) => new Set(prev).add(ledgerTabIndex));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLedgerLoading(false);
    }
  }

  function changeLedgerPageSize(size: number) {
    loadLedger(1, size);
  }

  function toggleLedgerSort(header: string) {
    const next: { header: string; dir: "asc" | "desc" } | null =
      !ledgerSort || ledgerSort.header !== header ? { header, dir: "asc" } : ledgerSort.dir === "asc" ? { header, dir: "desc" } : null;
    setLedgerSort(next);
    loadLedger(1, ledgerPageSize, next, ledgerFilters);
  }

  function openLedgerFilter(header: string) {
    const btn = ledgerFilterBtnRefs.current[header];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setLedgerPopoverPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 220) });
    }
    setOpenLedgerFilterFor(openLedgerFilterFor === header ? null : header);
  }

  function applyLedgerFilter(header: string, f: ActiveFilter) {
    const next = { ...ledgerFilters, [header]: f };
    setLedgerFilters(next);
    loadLedger(1, ledgerPageSize, ledgerSort, next);
  }

  function clearLedgerFilter(header: string) {
    const next = { ...ledgerFilters };
    delete next[header];
    setLedgerFilters(next);
    loadLedger(1, ledgerPageSize, ledgerSort, next);
  }

  const skippedInitialFetch = useRef(false);

  useEffect(() => {
    if (levels.length === 0 || !filters.fromDate) return;

    // فقط در اولین اجرای واقعی بعد از mount: اگر داده‌ی این تب قبلاً (با سوییچ تب) کش شده، دوباره از سرور نگیر
    if (!skippedInitialFetch.current) {
      skippedInitialFetch.current = true;
      if (loadedTabs.has(activeTab)) return;
    }

    if (activeTab < accountTabCount) loadAccountTab(activeTab);
    else if (activeTab < ledgerTabIndex) loadDetailTab(activeTab, (activeTab - detailTabStart + 1) as 1 | 2 | 3);
    else loadLedger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, levels, chain.selections, chain.order, filterParams, detailQuery[activeTab]]);

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
    setDetailQuery({});
    setDetailTotal({});
    setLedgerPage(1);
    setLoadedTabs(new Set());
    setActiveTab(0);
  }

  /** پاک کردن کامل همه‌ی فیلترها (انتخاب‌های تب‌ها + بازه تاریخ + فیلترهای پیشرفته) — انگار صفحه از اول باز شده */
  function clearEverything() {
    chain.reset();
    setTabData({});
    setDetailQuery({});
    setDetailTotal({});
    setLedgerRows([]);
    setLedgerPage(1);
    setLedgerTotal(0);
    setLedgerTotalPages(1);
    setLoadedTabs(new Set());
    setActiveTab(0);
    setFilters({
      ...defaultDateRange(periods),
      documentTypeIds: new Set<number>(),
      numberFrom: "",
      numberTo: "",
      referenceFrom: "",
      referenceTo: "",
    });
  }

  function toggleDocType(id: number) {
    setFilters((prev) => {
      const next = new Set(prev.documentTypeIds);
      next.has(id) ? next.delete(id) : next.add(id);
      return { ...prev, documentTypeIds: next };
    });
    resetAll();
  }

  async function exportLedgerCsv() {
    setError(null);
    try {
      const p = new URLSearchParams(filterParams);
      const { parentIds } = accountConstraints(ledgerTabIndex);
      if (parentIds.length) p.set("parentIds", parentIds.join(","));
      const details = detailConstraints(ledgerTabIndex);
      DETAIL_SLOTS.forEach((slot) => {
        if (details[slot].length) p.set(`detail${slot}Codes`, details[slot].join(","));
      });
      p.set("page", "1");
      p.set("pageSize", "100000");
      const data = await api.get(`/reports/ledger?${p.toString()}`);
      const header = ["شماره سند", "شماره عطف", "تاریخ", "نوع سند", "سیستم", "بدهکار", "بستانکار", "مانده", "شرح"];
      const rows = data.rows.map((r: LedgerRow) => [
        r.number, r.referenceNumber, formatJalaliDate(r.date), r.documentType, ISSUING_SYSTEM_FA[r.issuingSystem] || r.issuingSystem,
        r.debit, r.credit, `${r.runningBalance} ${NATURE_FA[r.runningBalanceNature]}`, r.description || "",
      ]);
      const csv = [header, ...rows].map((row) => row.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "گردش-حساب.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message);
    }
  }

  const extraFilterCount =
    filters.documentTypeIds.size + (filters.numberFrom ? 1 : 0) + (filters.numberTo ? 1 : 0) + (filters.referenceFrom ? 1 : 0) + (filters.referenceTo ? 1 : 0);

  const tabDefs = [
    ...levels.map((lvl, idx) => ({ key: `lvl-${lvl.id}`, label: lvl.title, count: chain.get(idx).size })),
    ...DETAIL_SLOTS.map((slot) => ({ key: `detail-${slot}`, label: `تفصیل ${toFaDigits(String(slot))}`, count: chain.get(detailTabStart + slot - 1).size })),
    { key: "ledger", label: "گردش", count: 0 },
  ];

  return (
    <div>
      <div className="page-header ar-header">
        <div className="header-toolbar" style={{ gap: 4 }}><InfoHint text={`گزارش سلسله‌مراتبی مانده‌ی حساب‌ها — در هر تب چندین ردیف قابل انتخاب است؛ فقط حساب‌های دارای گردش در بازه نمایش داده می‌شوند`} title="مرور حسابها" />
          <RefreshButton onClick={refreshCurrentTab} title="رفرش تب جاری" />
          <button type="button" className="toolbar-icon-btn" onClick={clearEverything} title="حذف همه فیلترها">
            <ClearFilterIcon />
          </button>
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

      <ChainedTabsBar tabs={tabDefs} activeIndex={activeTab} onChange={setActiveTab} />

      {activeTab < detailTabStart && (
        <SelectableBalanceTable
          rows={tabData[activeTab] || []}
          columns={balanceColumns}
          selected={chain.get(activeTab)}
          onToggle={onToggleRow}
          loading={tabLoading}
        />
      )}

      {activeTab >= detailTabStart && activeTab < ledgerTabIndex && (
        <SelectableBalanceTable
          rows={tabData[activeTab] || []}
          columns={detailBalanceColumns}
          selected={chain.get(activeTab)}
          onToggle={onToggleRow}
          loading={tabLoading}
          serverPaging={{
            page: (detailQuery[activeTab] ?? DEFAULT_DETAIL_QUERY).page,
            pageSize: (detailQuery[activeTab] ?? DEFAULT_DETAIL_QUERY).pageSize,
            total: detailTotal[activeTab] ?? 0,
            loading: tabLoading,
            onPageChange: (page) => updateDetailQuery(activeTab, { page }),
            onPageSizeChange: (pageSize) => updateDetailQuery(activeTab, { pageSize, page: 1 }),
            onSortChange: (sort) => updateDetailQuery(activeTab, { sort, page: 1 }),
            onFiltersChange: (filters) => updateDetailQuery(activeTab, { filters, page: 1 }),
          }}
        />
      )}

      {activeTab === ledgerTabIndex && (
        <div>
          <div className="ar-ledger-toolbar">
            <label className="checkbox-row">
              <input type="checkbox" checked={showRunningBalance} onChange={(e) => setShowRunningBalance(e.target.checked)} />
              مانده در خط
            </label>
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
                    {LEDGER_COLUMNS.map((c) => {
                      const sortDir = ledgerSort?.header === c.header ? ledgerSort.dir : null;
                      const isFilterActive = !!ledgerFilters[c.header];
                      return (
                        <th key={c.header}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <span
                              onClick={() => toggleLedgerSort(c.header)}
                              style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}
                              title="مرتب‌سازی"
                            >
                              {c.header}
                              <SortIcon dir={sortDir} />
                            </span>
                            <button
                              ref={(el) => (ledgerFilterBtnRefs.current[c.header] = el)}
                              type="button"
                              className={`filter-btn ${isFilterActive ? "active" : ""}`}
                              onClick={() => openLedgerFilter(c.header)}
                              title="فیلتر"
                            >
                              <FilterIcon active={isFilterActive} />
                            </button>
                          </div>
                        </th>
                      );
                    })}
                    {showRunningBalance && <th>مانده بدهکار</th>}
                    {showRunningBalance && <th>مانده بستانکار</th>}
                  </tr>
                </thead>
                <tbody>
                  {ledgerRows.length === 0 && (
                    <tr><td colSpan={showRunningBalance ? 11 : 9} className="empty-state" style={{ border: "none" }}>گردشی یافت نشد</td></tr>
                  )}
                  {ledgerRows.map((r, i) => (
                    <tr key={i} onDoubleClick={() => openTab(`/journal-entries/${r.journalEntryId}/edit`)} style={{ cursor: "pointer" }} title="دابل‌کلیک برای باز کردن سند">
                      <td>{toFaDigits(String(r.number))}</td>
                      <td>{toFaDigits(String(r.referenceNumber))}</td>
                      <td>{formatJalaliDate(r.date)}</td>
                      <td>{r.documentType}</td>
                      <td>{ISSUING_SYSTEM_FA[r.issuingSystem] || r.issuingSystem}</td>
                      <td><span className="badge">{STATUS_FA[r.status]}</span></td>
                      <td>{r.description || "—"}</td>
                      <td>{r.debit ? formatAmountFa(r.debit) : "—"}</td>
                      <td>{r.credit ? formatAmountFa(r.credit) : "—"}</td>
                      {showRunningBalance && (
                        <td>{r.runningBalanceNature === "DEBIT" && r.runningBalance ? formatAmountFa(r.runningBalance) : "—"}</td>
                      )}
                      {showRunningBalance && (
                        <td>{r.runningBalanceNature === "CREDIT" && r.runningBalance ? formatAmountFa(r.runningBalance) : "—"}</td>
                      )}
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
                <span className="grid-page-indicator">
                  صفحه {toFaDigits(String(ledgerPage))} از {toFaDigits(String(ledgerTotalPages))}
                </span>
                <button type="button" className="btn secondary" disabled={ledgerPage >= ledgerTotalPages || ledgerLoading} onClick={() => loadLedger(ledgerPage + 1)}>بعدی</button>
                <button type="button" className="btn secondary" disabled={ledgerPage >= ledgerTotalPages || ledgerLoading} onClick={() => loadLedger(ledgerTotalPages)}>انتها</button>
              </div>
            </div>
          </div>
          </div>
        </div>
      )}

      {openLedgerFilterFor &&
        LEDGER_COLUMNS.map(
          (c) =>
            c.header === openLedgerFilterFor && (
              <FilterPopover
                key={c.header}
                type={c.filterType}
                active={ledgerFilters[c.header] ?? null}
                position={ledgerPopoverPos}
                onApply={(f) => applyLedgerFilter(c.header, f)}
                onClear={() => clearLedgerFilter(c.header)}
                onClose={() => setOpenLedgerFilterFor(null)}
              />
            )
        )}
    </div>
  );
}
