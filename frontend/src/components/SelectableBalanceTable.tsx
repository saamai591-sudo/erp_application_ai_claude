import { measureBestFitWidths, sumWidths } from "../lib/bestFit";
import { BestFitIcon, BEST_FIT_TITLE } from "./BestFitIcon";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { SelectId } from "../lib/useChainedMultiSelect";
import { toFaDigits, formatAmountFa } from "../lib/formatAmount";
import { exportGridToCsv, printGrid, deriveGridName, ExportColumn } from "../lib/gridExport";
import { useAutoPortalTarget } from "../lib/useAutoPortalTarget";
import { GridSort, nextSort, sortStateOf, makeComparator } from "../lib/gridSort";
import { ActiveFilter, ColumnFilterType, FilterIcon, FilterPopover, matchesFilter } from "./DataTable";

export interface BalanceTableColumn<T> {
  header: string;
  render: (row: T) => any;
  width?: string;
  /** مقدار خام قابل‌مقایسه برای مرتب‌سازی با کلیک روی هدر؛ اگر ندهید آن ستون قابل‌مرتب‌سازی نیست */
  sortValue?: (row: T) => string | number | null | undefined;
  /** اگر مشخص شود، امکان فیلتر روی این ستون فعال می‌شود (دقیقاً همان قرارداد ستون‌های DataTable) */
  filterType?: ColumnFilterType;
  /** مقدار خام برای اعمال فیلتر؛ اگر ندهید از filterValue استفاده نمی‌شود و آیکن فیلتر نمایش داده نمی‌شود */
  filterValue?: (row: T) => string | number | null | undefined;
  /** طبق تصمیم صریح کاربر: فقط ستون‌های عددیِ اعشاری/غیرصحیح (جمع بدهکار/بستانکار، مانده و...) باید در
   * ردیف «جمع» پای گرید جمع زده شوند — دقیقاً هم‌قرارداد DataTable */
  decimal?: boolean;
  /** مقدار خام برای محاسبه‌ی جمع (فقط وقتی decimal=true)؛ اگر ندهید از filterValue استفاده می‌شود */
  totalValue?: (row: T) => string | number | null | undefined;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/**
 * وقتی داده شود، rows فقط «همان صفحه‌ای» است که از سرور آمده (نه کل نتیجه) — مرتب‌سازی و صفحه‌بندی
 * به‌جای اجرا در مرورگر، از طریق این callbackها به سرور واگذار می‌شود (دقیقاً مشابه حالت serverPaging در DataTable)
 */
export interface BalanceTableServerPaging {
  page: number;
  pageSize: number;
  total: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onSortChange?: (sort: { header: string; dir: "asc" | "desc" } | null) => void;
  /** اگر داده شود، فیلتر ستونی به‌جای پردازش محلی، از طریق این callback به سرور واگذار می‌شود */
  onFiltersChange?: (filters: Record<string, ActiveFilter>) => void;
}

function ExcelExportIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8.5 13.5 12 18M12 13.5l-3.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M6 9V3h12v6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <rect x="4" y="9" width="16" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6 14h12v7H6z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function SortIcon({ dir }: { dir: "asc" | "desc" | null }) {
  if (!dir) {
    return (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.35 }}>
        <path d="M7 9l5-5 5 5M7 15l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
      {dir === "asc" ? (
        <path d="M6 15l6-6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

export interface BalanceTableSelectAll {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  /** برای دیالوگ/راهنمای کوتاه روی چک‌باکس (مثلاً «انتخاب همه») */
  title?: string;
}

const EMPTY_SELECTION = new Set<SelectId>();
function NOOP_TOGGLE() {}

export function SelectableBalanceTable<T extends { id: SelectId }>({
  rows,
  columns,
  selected = EMPTY_SELECTION,
  onToggle = NOOP_TOGGLE,
  selectable = true,
  onRowDoubleClick,
  loading,
  emptyText,
  serverPaging,
  selectAll,
  stateKey,
  restoreFilters,
  restoreSort,
  onFiltersChange,
  onSortChange,
}: {
  rows: T[];
  columns: BalanceTableColumn<T>[];
  /** طبق تصمیم صریح کاربر: تب «گردش» هر سه گزارش Review باید هم‌الگوی بقیه‌ی تب‌ها فیلتر/مرتب‌سازی
   * ستونی داشته باشد، بدون این‌که یک ردیفش قابل «انتخاب زنجیره‌ای» باشد (گردش، برخلاف تب‌های دیگر،
   * روی تب‌های بعدی اثر نمی‌گذارد) — selectable=false ستون چک‌باکس را کلاً از UI حذف می‌کند (نه فقط
   * غیرفعال) و کلیک روی ردیف دیگر چیزی toggle نمی‌کند. پیش‌فرض true تا مصرف‌کننده‌های موجود دست‌نخورده بمانند. */
  selectable?: boolean;
  /** فقط وقتی selectable=false معنا دارد — دابل‌کلیک روی ردیف برای باز کردن سند مبدا (دقیقاً همان
   * رفتار قبلیِ هر سه تب گردش، که قبل از این تغییر با یک <table> دستی پیاده شده بود). */
  onRowDoubleClick?: (row: T) => void;
  selected?: Set<SelectId>;
  onToggle?: (id: SelectId) => void;
  loading?: boolean;
  emptyText?: string;
  /** اگر داده شود، مرتب‌سازی/صفحه‌بندی سمت سرور انجام می‌شود (به‌جای پردازش کل rows در مرورگر) */
  serverPaging?: BalanceTableServerPaging;
  /** چک‌باکس «انتخاب همه» در هدر جدول — طبق تصمیم صریح کاربر، در حالت serverPaging باید کل نتایج
   * مطابق فیلتر جاری را انتخاب کند (نه فقط صفحه‌ی بارگذاری‌شده)؛ چون این تصمیم/واکشی وابسته به
   * فیلترها و اندپوینت هر صفحه است، منطق واقعی آن به‌طور کامل به فراخوان‌کننده واگذار شده (این
   * کامپوننت فقط چک‌باکس را با وضعیت داده‌شده نمایش می‌دهد). اگر داده نشود، آن ستون خالی می‌ماند
   * (رفتار قبلی، بدون تغییر برای مصرف‌کننده‌های دیگر). */
  selectAll?: BalanceTableSelectAll;
  /**
   * طبق تصمیم صریح کاربر: وقتی یک صفحه‌ی Review (مرور حسابها/مرور تعدادی-مبلغی) یک نمونه‌ی واحد از
   * این کامپوننت را برای چند تب زنجیره‌ای مختلف به‌کار می‌برد (تا سوییچ بین تب‌ها remount کامل نشود و
   * موقعیت اسکرول/فوکوس از دست نرود)، فیلتر/مرتب‌سازیِ محلی این کامپوننت (که فقط با نام ستون هدر
   * کلید می‌خورد) نباید بین تب‌هایی که ستون هم‌نامِ معنای متفاوتی دارند نشت کند — مثلاً فیلترِ «عنوان
   * شامل...» روی تب «کالا» (نام کالا) نباید وقتی کاربر به تب «انبار» سوییچ می‌کند هم‌چنان روی «عنوان»
   * (نام انبار) اعمال بماند و آن را به‌اشتباه خالی نشان دهد. با تغییر stateKey (مثلاً شماره‌ی تب جاری)،
   * فیلتر/مرتب‌سازی محلی خودکار پاک می‌شود؛ اگر stateKey ثابت بماند (رندر مجدد همان تب)، دست‌نخورده
   * می‌ماند.
   */
  stateKey?: string | number;
  /** فقط وقتی stateKey عوض شود مصرف می‌شوند — برای تب‌هایی که فیلتر/مرتب‌سازی واقعی‌شان بیرون از این
   * کامپوننت (سمت فراخوان‌کننده، مثل detailQuery[tab] در AccountsReview) نگه‌داری می‌شود، تا برگشتن
   * به آن تب، state محلی (که فقط برای نمایش آیکن فیلتر/جهت مرتب‌سازی است) را با مقدار واقعی هم‌گام
   * کند به‌جای پاک کردن؛ اگر ندهید، با تغییر stateKey خالی می‌شود (تب‌های فیلتر-محلی مثل تب‌های
   * انبار/کالای مرور تعدادی-مبلغی و تب‌های مانده‌ی مرور حسابها). */
  restoreFilters?: Record<string, ActiveFilter>;
  restoreSort?: { header: string; dir: "asc" | "desc" } | null;
  /** طبق تصمیم صریح کاربر: برای تب‌های فیلتر-محلی (بدون serverPaging)، فراخوان‌کننده باید فیلتر/
   * مرتب‌سازیِ هر تب را در حافظه‌ی خودش (کلیدشده با شماره‌ی تب) نگه دارد تا با برگشتن به آن تب،
   * از طریق restoreFilters/restoreSort برگردانده شود — وگرنه با هر سوییچ تب (که stateKey را عوض
   * می‌کند تا نشتِ فیلتر بین تب‌ها جلوگیری شود، طبق stateKey بالا) فیلتر/مرتب‌سازیِ همان تب هم پاک
   * می‌شد. این callbackها مستقل از serverPaging.onFiltersChange/onSortChange هستند (که فقط برای
   * تب‌های سرور-صفحه‌بندی‌شده به‌کار می‌روند) تا تب‌های کاملاً کلاینتی هم بتوانند وضعیتشان را حفظ کنند. */
  onFiltersChange?: (filters: Record<string, ActiveFilter>) => void;
  onSortChange?: (sort: GridSort | null) => void;
}) {
  const [sort, setSort] = useState<GridSort | null>(null);
  const [filters, setFilters] = useState<Record<string, ActiveFilter>>({});
  const [openFilterFor, setOpenFilterFor] = useState<string | null>(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const filterBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // طبق تصمیم صریح کاربر (با دو تصویر مرجع: WareHouseReview.png و lessrowsreview.png): ردیف «جمع»
  // باید (۱) دقیقاً زیر هر ستون بیاید (نه یک لیست افقی برچسب:مقدار)، و هم‌زمان (۲) همیشه بالای
  // صفحه‌بندی/تعداد-در-صفحه بماند — چه گرید اسکرول عمودی داشته باشد چه فقط یک ردیف — یعنی هرگز داخل
  // ناحیه‌ی اسکرول‌شونده نرود و هرگز به وسط صفحه (بلافاصله زیر آخرین ردیف واقعی) نچسبد. یک <tfoot> در
  // خودِ جدول (طبق یک تصمیم قدیمی‌تر که در styles.css مستند است) این دومی را نقض می‌کند: وقتی ردیف‌ها کم
  // باشند، tfoot بلافاصله بعد از آخرین ردیف می‌آید، نه ته کادر گرید. راه‌حل: یک جدول کاملاً جدا و مستقل،
  // بیرون از ناحیه‌ی اسکرول‌شونده (پس همیشه در جریان عادی فلکس، ته کادر می‌ماند)، با ستون‌هایی که
  // عرضشان از روی عرض واقعیِ ستون‌های <thead> جدول اصلی اندازه‌گیری و کپی می‌شود (چون عرض ستون‌ها
  // خودکار/بر مبنای محتواست، نه ثابت) تا زیر هر ستون دقیقاً هم‌ترازش بماند؛ و چون این یک جدول واقعاً
  // مجزاست، اسکرول افقی‌اش با اسکرول افقی ناحیه‌ی اصلی هم‌گام می‌شود (در ادامه، رویداد scroll).
  const theadRowRef = useRef<HTMLTableRowElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const footerScrollRef = useRef<HTMLDivElement>(null);
  const [colWidths, setColWidths] = useState<number[]>([]);
  // «Best Fit»: فقط state همین کامپوننت (نه ذخیره‌شده/بک‌اند)؛ با عوض‌شدن صفحه یا ردیف‌های نمایش‌داده‌شده پاک می‌شود. نگاه کنید به lib/bestFit.ts
  const [bestFit, setBestFit] = useState<number[] | null>(null);
  const bestFitSignature = `${serverPaging?.page ?? 0}|${serverPaging?.pageSize ?? 0}|${rows.map((r) => r.id).join(",")}`;
  useEffect(() => {
    setBestFit(null);
  }, [bestFitSignature]);
  function applyBestFit() {
    const widths = measureBestFitWidths(scrollAreaRef.current?.querySelector("table"));
    setBestFit(widths.length ? widths : null);
  }

  useLayoutEffect(() => {
    function measure() {
      const ths = theadRowRef.current?.querySelectorAll("th");
      if (!ths || ths.length === 0) return;
      const next = Array.from(ths).map((th) => Math.round(th.getBoundingClientRect().width));
      // اگر عرض‌ها تغییری نکرده‌اند همان state قبلی برگردانده می‌شود تا رندر مجدد/حلقه‌ی بی‌نهایت (وقتی columns هر رندر آرایه‌ی تازه است) ایجاد نشود
      setColWidths((prev) => (prev.length === next.length && prev.every((w, i) => w === next[i]) ? prev : next));
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, sort, filters, rows, bestFit]);

  function syncFooterScroll() {
    if (scrollAreaRef.current && footerScrollRef.current) {
      footerScrollRef.current.scrollLeft = scrollAreaRef.current.scrollLeft;
    }
  }

  // طبق تصمیم صریح کاربر: با تغییر stateKey (سوییچ به تب دیگر) فیلتر/مرتب‌سازی محلی این نمونه‌ی
  // مشترک باید هم‌گام شود، نه فقط برای رندر جاری — یک افکت معمولی (نه جهش state حین رندر) عمداً
  // انتخاب شده چون جهش یک ref حین رندر با فراخوانی مضاعف تابع رندر در React StrictMode (که فقط تابع
  // رندر را دوباره صدا می‌زند، نه اثرات را) ناسازگار است: فراخوانی دومِ StrictMode مقدار state هنوز
  // قدیمیِ closure را می‌بیند ولی prevStateKey.current را از قبل جهش‌یافته، پس reset را نادیده
  // می‌گیرد و مقدار قدیمی دوباره ظاهر می‌شود. افکت این مشکل را ندارد چون هر بار کامل (نه نصفه‌کاره)
  // با آخرین state واقعی اجرا می‌شود.
  useEffect(() => {
    setFilters(restoreFilters ?? {});
    setSort(restoreSort ?? null);
    setOpenFilterFor(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateKey]);

  function toggleSort(col: BalanceTableColumn<T>, multi = false) {
    if (!col.sortValue) return;
    setSort((prev) => {
      const next = nextSort(prev, col.header, multi);
      serverPaging?.onSortChange?.(next);
      onSortChange?.(next);
      return next;
    });
  }

  function openFilter(header: string) {
    const btn = filterBtnRefs.current[header];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setPopoverPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 220) });
    }
    setOpenFilterFor(openFilterFor === header ? null : header);
  }

  // در حالت سرور، rows همان صفحه‌ی از قبل فیلترشده از سرور است؛ پردازش محلی فیلتر فقط برای حالت کلاینتی اجرا می‌شود
  const filteredRows = serverPaging
    ? rows
    : rows.filter((row) =>
        columns.every((col) => {
          const filter = filters[col.header];
          if (!filter || !col.filterType || !col.filterValue) return true;
          return matchesFilter(col.filterValue(row), col.filterType, filter);
        })
      );

  let sortedRows = filteredRows;
  if (!serverPaging && sort) {
    // مرتب‌سازی چندستونه (Ctrl/Shift + کلیک) — lib/gridSort.ts
    const cmp = makeComparator<T>(sort, (h) => columns.find((c) => c.header === h)?.sortValue);
    if (cmp) sortedRows = [...filteredRows].sort(cmp);
  }

  // در حالت کلاینتی، دقیقاً رفتار قبلی حفظ می‌شود (نمایش کامل پیام بارگذاری)؛
  // در حالت سرور، اگر داده‌ی صفحه‌ی قبلی موجود باشد، حین لود صفحه‌ی جدید همچنان نمایش داده می‌شود (بدون پرش/خالی شدن ناگهانی)
  const showLoadingState = serverPaging ? loading && rows.length === 0 : !!loading;
  const totalRows = serverPaging ? serverPaging.total : sortedRows.length;
  const pageSize = serverPaging?.pageSize ?? 0;
  const pageStart = serverPaging ? (serverPaging.page - 1) * pageSize : 0;
  const totalPages = serverPaging ? Math.max(1, Math.ceil(serverPaging.total / serverPaging.pageSize)) : 1;

  // جمع ستون‌های decimal روی ردیف‌های «در دسترس/نمایش‌داده‌شده» فعلی (sortedRows) — در حالت سرور همان
  // صفحه‌ی جاری است، در حالت کلاینتی کل نتیجه‌ی فیلترشده (این کامپوننت خودش صفحه‌بندی کلاینتی ندارد)؛
  // دقیقاً هم‌منطق DataTable.
  const columnTotals: (number | null)[] = columns.map((c) => {
    const accessor = c.totalValue || c.filterValue;
    if (!c.decimal || !accessor) return null;
    let sum = 0;
    for (const row of sortedRows) {
      const n = Number(accessor(row));
      if (!Number.isNaN(n)) sum += n;
    }
    return Math.round(sum * 1e6) / 1e6;
  });
  const hasColumnTotals = columnTotals.some((t) => t !== null);

  // قاعده‌ی پایه: سرستون‌ها همیشه نمایش داده می‌شوند (حین بارگذاری و برای گرید خالی هم)؛ پیام داخل بدنه‌ی جدول می‌آید
  const table = (
    <table style={bestFit ? { tableLayout: "fixed", width: sumWidths(bestFit) } : undefined}>
      <thead>
        <tr ref={theadRowRef}>
          {selectable && (
            <th style={{ width: bestFit ? bestFit[0] : 34 }}>
              {selectAll && (
                <input
                  type="checkbox"
                  checked={selectAll.checked}
                  disabled={selectAll.disabled}
                  title={selectAll.title || "انتخاب همه"}
                  onChange={selectAll.onChange}
                />
              )}
            </th>
          )}
          <th style={{ width: bestFit ? bestFit[selectable ? 1 : 0] : 44 }}>ردیف</th>
          {columns.map((c, ci) => {
            const sortState = sortStateOf(sort, c.header);
            const hasFilter = !!c.filterType && !!c.filterValue;
            const isFilterActive = !!filters[c.header];
            return (
              <th key={c.header} style={{ width: bestFit ? bestFit[(selectable ? 2 : 1) + ci] : c.width }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  {c.sortValue ? (
                    <span onClick={(e) => toggleSort(c, e.ctrlKey || e.shiftKey || e.metaKey)} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }} title="مرتب‌سازی (Ctrl/Shift + کلیک برای مرتب‌سازی چندستونه)">
                      {c.header}
                      <SortIcon dir={sortState?.dir ?? null} />
                      {sortState?.priority && <span className="sort-priority">{toFaDigits(String(sortState.priority))}</span>}
                    </span>
                  ) : (
                    c.header
                  )}
                  {hasFilter && (
                    <button
                      ref={(el) => (filterBtnRefs.current[c.header] = el)}
                      type="button"
                      className={`filter-btn ${isFilterActive ? "active" : ""}`}
                      onClick={() => openFilter(c.header)}
                      title="فیلتر"
                    >
                      <FilterIcon active={isFilterActive} />
                    </button>
                  )}
                </div>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {showLoadingState && (
          <tr>
            <td colSpan={columns.length + (selectable ? 2 : 1)} className="empty-state" style={{ border: "none" }}>
              در حال بارگذاری...
            </td>
          </tr>
        )}
        {!showLoadingState && sortedRows.length === 0 && (
          <tr>
            <td colSpan={columns.length + (selectable ? 2 : 1)} className="empty-state" style={{ border: "none" }}>
              {emptyText || "رکوردی یافت نشد"}
            </td>
          </tr>
        )}
        {!showLoadingState && sortedRows.map((row, idx) => (
          <tr
            key={row.id}
            className={selectable && selected.has(row.id) ? "active-list" : ""}
            style={{ cursor: selectable || onRowDoubleClick ? "pointer" : undefined }}
            onClick={selectable ? () => onToggle(row.id) : undefined}
            onDoubleClick={onRowDoubleClick ? () => onRowDoubleClick(row) : undefined}
            title={!selectable && onRowDoubleClick ? "دابل‌کلیک برای باز کردن سند" : undefined}
          >
            {selectable && (
              <td onClick={(e) => e.stopPropagation()} style={{ textAlign: "center" }}>
                <input type="checkbox" checked={selected.has(row.id)} onChange={() => onToggle(row.id)} />
              </td>
            )}
            <td>{toFaDigits(String(pageStart + idx + 1))}</td>
            {columns.map((c) => (
              <td key={c.header}>{c.render(row)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );

  function renderTotalsBar(standalone: boolean) {
    if (!hasColumnTotals || sortedRows.length === 0 || showLoadingState) return null;
    const totalWidth = colWidths.length ? colWidths.reduce((s, w) => s + w, 0) : undefined;
    const base = selectable ? 1 : 0; // اندیس ستون «ردیف» در colWidths
    return (
      <div className={`grid-footer-totals${standalone ? " grid-footer-totals-standalone" : ""}`}>
        <div className="grid-footer-totals-scroll" ref={footerScrollRef}>
          <table style={{ tableLayout: "fixed", width: totalWidth }}>
            <tbody>
              <tr>
                {/* ستون چک‌باکس فقط وقتی هست که گرید selectable باشد؛ بدون آن (مثل تب «گردش»)، شمارنده‌ی ستون‌ها یکی کمتر است — وگرنه جمع‌ها یک ستون جابه‌جا می‌افتادند */}
                {selectable && <td style={{ width: colWidths[0] }} />}
                <td style={{ width: colWidths[base] }}>جمع</td>
                {columns.map((c, i) => (
                  <td key={c.header} style={{ width: colWidths[base + 1 + i] }}>
                    {columnTotals[i] !== null ? formatAmountFa(columnTotals[i]!) : ""}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const filterPopover = openFilterFor &&
    columns.map(
      (c) =>
        c.header === openFilterFor &&
        c.filterType &&
        c.filterValue && (
          <FilterPopover
            key={c.header}
            type={c.filterType}
            active={filters[c.header] ?? null}
            position={popoverPos}
            onApply={(f) =>
              setFilters((prev) => {
                const next = { ...prev, [c.header]: f };
                serverPaging?.onFiltersChange?.(next);
                onFiltersChange?.(next);
                return next;
              })
            }
            onClear={() =>
              setFilters((prev) => {
                const next = { ...prev };
                delete next[c.header];
                serverPaging?.onFiltersChange?.(next);
                onFiltersChange?.(next);
                return next;
              })
            }
            onClose={() => setOpenFilterFor(null)}
          />
        )
    );

  // خروجی اکسل/چاپ روی داده‌ی «در دسترس» فعلی: در حالت کلاینتی کل نتیجه‌ی فیلترشده/مرتب‌شده
  // (sortedRows)، در حالت سرور همان صفحه‌ی جاری (rows) — دقیقاً همان قرارداد DataTable
  const exportRows = serverPaging ? rows : sortedRows;
  // دقیقاً هم‌قرارداد DataTable: در حالت سرور exportRows فقط صفحه‌ی جاری است، پس شماره‌ی ردیف باید از
  // pageStart ادامه پیدا کند تا با شماره‌ی نمایش‌داده‌شده روی صفحه یکی باشد.
  const exportRowIndexBase = serverPaging ? pageStart : 0;
  const rowIndexById = new Map(exportRows.map((r, i) => [r.id, exportRowIndexBase + i + 1]));
  const exportColumns: ExportColumn<T>[] = [{ header: "ردیف", render: (row: T) => rowIndexById.get(row.id) ?? "" }, ...columns];
  const location = useLocation();
  const gridName = deriveGridName(location.pathname);
  // طبق تصمیم صریح کاربر: این آیکن‌ها به‌جای یک ردیف مستقل بالای گرید، در خودِ نوار عنوان تب‌ها
  // (ChainedTabsBar) نمایش داده شوند تا یک ردیف ارتفاع صرفه‌جویی شود — دقیقاً هم‌الگوی مکانیزم موجود
  // «.header-toolbar» در DataTable.tsx، اما مقصدش «.ar-tabs-actions» است؛ نگاه کنید به
  // lib/useAutoPortalTarget.ts. اگر چنین نواری پیدا نشود، به همان رفتار قبلی (ردیف مستقل بالای گرید) برمی‌گردد.
  const { ref: rootRef, target: tabsActionsTarget } = useAutoPortalTarget<HTMLDivElement>(".ar-tabs-actions");
  const exportToolbar = (
    <div className={`bulk-toolbar ${tabsActionsTarget ? "in-tabs" : ""}`}>
      <span className="bulk-toolbar-info">{" "}</span>
      <div className="bulk-toolbar-actions">
        <button type="button" className="toolbar-icon-btn" onClick={applyBestFit} title={BEST_FIT_TITLE}>
          <BestFitIcon />
        </button>
        <button type="button" className="toolbar-icon-btn" onClick={() => exportGridToCsv(exportColumns, exportRows, gridName)} title="خروجی اکسل">
          <ExcelExportIcon />
        </button>
        <button type="button" className="toolbar-icon-btn" onClick={() => printGrid(exportColumns, exportRows, gridName)} title="چاپ">
          <PrintIcon />
        </button>
      </div>
    </div>
  );
  const exportToolbarNode = tabsActionsTarget ? createPortal(exportToolbar, tabsActionsTarget) : exportToolbar;

  if (!serverPaging) {
    return (
      <div ref={rootRef} className="grid-wrap-standalone">
        {exportToolbarNode}
        <div ref={scrollAreaRef} className="card grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }} onScroll={syncFooterScroll}>
          {table}
        </div>
        {renderTotalsBar(true)}
        {filterPopover}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="grid-wrap">
      {exportToolbarNode}
      <div ref={scrollAreaRef} className="card grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }} onScroll={syncFooterScroll}>
        {table}
      </div>
      {renderTotalsBar(false)}
      <div className="grid-footer">
        <span className="grid-footer-info">
          {serverPaging.loading
            ? "در حال بارگذاری..."
            : totalRows === 0
            ? "بدون رکورد"
            : `نمایش ${toFaDigits(String(pageStart + 1))} تا ${toFaDigits(String(Math.min(pageStart + pageSize, totalRows)))} از ${toFaDigits(String(totalRows))} رکورد`}
        </span>
        <div className="grid-footer-controls">
          <label className="grid-page-size">
            تعداد در صفحه
            <select value={serverPaging.pageSize} onChange={(e) => serverPaging.onPageSizeChange(Number(e.target.value))}>
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>{toFaDigits(String(n))}</option>
              ))}
            </select>
          </label>
          <div className="grid-page-nav">
            <button type="button" className="btn secondary" disabled={serverPaging.page <= 1} onClick={() => serverPaging.onPageChange(serverPaging.page - 1)}>
              قبلی
            </button>
            <span className="grid-page-indicator">
              صفحه {toFaDigits(String(serverPaging.page))} از {toFaDigits(String(totalPages))}
            </span>
            <button type="button" className="btn secondary" disabled={serverPaging.page >= totalPages} onClick={() => serverPaging.onPageChange(serverPaging.page + 1)}>
              بعدی
            </button>
          </div>
        </div>
      </div>
      {filterPopover}
    </div>
  );
}
