import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { showError } from "../lib/toast";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { JalaliDatePicker } from "./JalaliDatePicker";
import { toFaDigits, formatAmountFa } from "../lib/formatAmount";
import { useTabs } from "../lib/TabsContext";
import { usePersistedState } from "../lib/usePersistedState";
import { exportGridToCsv, printGrid, deriveGridName, ExportColumn } from "../lib/gridExport";
import { GridSort, nextSort, sortStateOf, makeComparator } from "../lib/gridSort";

/** اعداد و رشته‌های خالص عددی را به ارقام فارسی تبدیل می‌کند؛ JSX و متن‌های ترکیبی دست‌نخورده می‌مانند */
function renderCell(value: any): any {
  if (typeof value === "number") return toFaDigits(String(value));
  if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value.trim())) return toFaDigits(value);
  return value;
}

export type ColumnFilterType = "string" | "number" | "date";

export interface Column<T> {
  header: string;
  render: (row: T) => any;
  width?: string;
  /** اگر مشخص شود، امکان فیلتر روی این ستون فعال می‌شود */
  filterType?: ColumnFilterType;
  /** مقدار خام (نه JSX) برای اعمال فیلتر؛ برای ستون‌های تاریخ باید رشته میلادی YYYY-MM-DD باشد */
  filterValue?: (row: T) => string | number | null | undefined;
  /** مقدار خام برای مرتب‌سازی؛ اگر مشخص نشود از filterValue استفاده می‌شود */
  sortValue?: (row: T) => string | number | null | undefined;
  /**
   * طبق تصمیم صریح کاربر: فقط ستون‌های عددیِ اعشاری/غیرصحیح (مبلغ، فی، تخفیف، مالیات، نرخ، مانده و...)
   * باید در ردیف «جمع» پای گرید جمع زده شوند — نه ستون‌های صحیح مثل شماره سند/کد/شناسه/شماره ردیف/شماره
   * عطف، حتی اگر filterType آن‌ها هم "number" باشد.
   */
  decimal?: boolean;
  /**
   * مقدار خام برای محاسبه‌ی جمع ردیف «جمع» (فقط وقتی decimal=true)؛ اگر مشخص نشود از filterValue استفاده
   * می‌شود. جدا از filterValue تعریف شده چون بعضی ستون‌های محاسبه‌شده (مثلاً جمع بدهکار/بستانکار سند در
   * فهرستی که serverPaging دارد) عمداً filterValue/filterType ندارند — فیلتر/مرتب‌سازی این ستون‌ها سمت
   * سرور پشتیبانی نمی‌شود، اما باید بتوان همچنان جمعشان را روی همان صفحه‌ی فعلی نمایش داد.
   */
  totalValue?: (row: T) => string | number | null | undefined;
}

/**
 * قاعده‌ی پایه: هر فهرستی که سطرهایش فیلد journalEntryReferenceNumber (شماره عطف سند حسابداری صادرشده؛ null اگر هنوز
 * صادر نشده) داشته باشد، به‌صورت خودکار ستون «شماره سند حسابداری» را (آخرین ستون) می‌گیرد — لازم نیست هر فرم جداگانه تعریف کند.
 * فقط کافی است API فهرستِ فرمی که سند حسابداری صادر می‌کند این فیلد را برگرداند.
 */
export const JOURNAL_ENTRY_COLUMN_HEADER = "شماره سند حسابداری";

function withJournalEntryColumn<T>(columns: Column<T>[], rows: T[]): Column<T>[] {
  if (rows.length === 0 || columns.some((c) => c.header === JOURNAL_ENTRY_COLUMN_HEADER)) return columns;
  if (!("journalEntryReferenceNumber" in (rows[0] as object))) return columns;
  const value = (r: T) => ((r as any).journalEntryReferenceNumber as number | null | undefined) ?? undefined;
  return [
    ...columns,
    {
      header: JOURNAL_ENTRY_COLUMN_HEADER,
      render: (r: T) => (value(r) ? toFaDigits(String(value(r))) : "—"),
      width: "130px",
      filterType: "number",
      filterValue: value,
    },
  ];
}

export interface ActiveFilter {
  operator: string;
  value?: string;
  value2?: string;
}

const OPERATORS: Record<ColumnFilterType, { value: string; label: string }[]> = {
  number: [
    { value: "eq", label: "مساوی" },
    { value: "gt", label: "بزرگتر از" },
    { value: "lt", label: "کوچکتر از" },
  ],
  string: [
    { value: "contains", label: "شامل باشد" },
    { value: "notContains", label: "شامل نباشد" },
    { value: "empty", label: "خالی باشد" },
    { value: "notEmpty", label: "خالی نباشد" },
  ],
  date: [
    { value: "contains", label: "شامل باشد" },
    { value: "notContains", label: "شامل نباشد" },
    { value: "gt", label: "بزرگتر از" },
    { value: "lt", label: "کوچکتر از" },
    { value: "between", label: "بین مقادیر زیر باشد" },
    { value: "empty", label: "خالی باشد" },
    { value: "notEmpty", label: "خالی نباشد" },
  ],
};

function needsNoValue(op: string) {
  return op === "empty" || op === "notEmpty";
}
function needsTwoValues(op: string) {
  return op === "between";
}

export function matchesFilter(raw: string | number | null | undefined, type: ColumnFilterType, filter: ActiveFilter): boolean {
  if (type === "number") {
    const num = raw === null || raw === undefined || raw === "" ? null : Number(raw);
    if (num === null || Number.isNaN(num)) return false;
    const target = Number(filter.value);
    if (filter.value === undefined || filter.value === "" || Number.isNaN(target)) return true;
    if (filter.operator === "eq") return num === target;
    if (filter.operator === "gt") return num > target;
    if (filter.operator === "lt") return num < target;
    return true;
  }
  if (type === "string") {
    const str = (raw ?? "").toString();
    if (filter.operator === "empty") return str.trim() === "";
    if (filter.operator === "notEmpty") return str.trim() !== "";
    const needle = (filter.value ?? "").toString().trim().toLowerCase();
    if (!needle) return true;
    if (filter.operator === "contains") return str.toLowerCase().includes(needle);
    if (filter.operator === "notContains") return !str.toLowerCase().includes(needle);
    return true;
  }
  // date — raw همیشه رشته میلادی YYYY-MM-DD است
  const str = (raw ?? "").toString();
  if (filter.operator === "empty") return str.trim() === "";
  if (filter.operator === "notEmpty") return str.trim() !== "";
  if (!str) return false;
  if (filter.operator === "contains" || filter.operator === "notContains") {
    const needle = (filter.value ?? "").trim();
    if (!needle) return true;
    const has = str.includes(needle);
    return filter.operator === "contains" ? has : !has;
  }
  if (filter.operator === "gt") return filter.value ? str > filter.value : true;
  if (filter.operator === "lt") return filter.value ? str < filter.value : true;
  if (filter.operator === "between") {
    if (!filter.value || !filter.value2) return true;
    return str >= filter.value && str <= filter.value2;
  }
  return true;
}

export function FilterIcon({ active }: { active: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"}>
      <path d="M4 5h16l-6 8v6l-4-2v-4L4 5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

export function FilterPopover({
  type,
  active,
  position,
  onApply,
  onClear,
  onClose,
}: {
  type: ColumnFilterType;
  active: ActiveFilter | null;
  position: { top: number; left: number };
  onApply: (f: ActiveFilter) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const ops = OPERATORS[type];
  const [operator, setOperator] = useState(active?.operator ?? ops[0].value);
  const [value, setValue] = useState(active?.value ?? "");
  const [value2, setValue2] = useState(active?.value2 ?? "");

  function apply() {
    onApply({ operator, value, value2 });
    onClose();
  }

  return createPortal(
    <>
      <div className="filter-backdrop" onClick={onClose} />
      <div className="filter-popover" style={{ position: "fixed", top: position.top, left: position.left }} onClick={(e) => e.stopPropagation()}>
        <select value={operator} onChange={(e) => setOperator(e.target.value)} className="filter-op-select">
          {ops.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {!needsNoValue(operator) && type === "date" && (operator === "contains" || operator === "notContains") && (
          <input className="filter-value-input" value={value} onChange={(e) => setValue(e.target.value)} placeholder="متن جستجو" />
        )}
        {!needsNoValue(operator) && type === "date" && operator !== "contains" && operator !== "notContains" && (
          <div style={{ marginBottom: 6 }}>
            <JalaliDatePicker value={value} onChange={setValue} placeholder="تاریخ" />
          </div>
        )}
        {!needsNoValue(operator) && needsTwoValues(operator) && type === "date" && (
          <div style={{ marginBottom: 6 }}>
            <JalaliDatePicker value={value2} onChange={setValue2} placeholder="تا تاریخ" />
          </div>
        )}
        {!needsNoValue(operator) && type !== "date" && (
          <input
            className="filter-value-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="مقدار"
            dir={type === "number" ? "ltr" : "rtl"}
          />
        )}

        <div className="filter-actions">
          <button type="button" className="btn" style={{ padding: "4px 10px", fontSize: 11.5 }} onClick={apply}>اعمال</button>
          <button
            type="button"
            className="btn secondary"
            style={{ padding: "4px 10px", fontSize: 11.5 }}
            onClick={() => {
              onClear();
              onClose();
            }}
          >
            پاک کردن
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-1 13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 7h12ZM10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SortIcon({ dir }: { dir: "asc" | "desc" | null }) {
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

function ChevronDownIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function OperationsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CancelSelectionIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
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

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;

/**
 * وقتی به DataTable داده شود، صفحه‌بندی/فیلتر/مرتب‌سازی به‌جای اجرا روی کل rows (سمت کلاینت)،
 * از طریق این callbackها به سرور واگذار می‌شود؛ در این حالت prop مربوط به rows باید همیشه
 * دقیقاً «همان صفحه‌ای» باشد که از سرور برگشته (نه کل دیتاست).
 */
export interface ServerPaging {
  page: number;
  pageSize: number;
  total: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onFiltersChange?: (filters: Record<string, ActiveFilter>) => void;
  onSortChange?: (sort: GridSort | null) => void;
}

export interface EditAction<T> {
  /** مسیری که با کلیک «ویرایش» در یک تب جدید (نه بازنویسی تب فهرست) باز می‌شود — نگاه کنید به useTabs().openTab */
  path: (row: T) => string;
  /** اگر مشخص شود و برای یک ردیف چیزی غیر از true برگرداند، به‌جای باز کردن تب، همان مقدار به‌عنوان پیام alert نمایش داده می‌شود */
  guard?: (row: T) => true | string;
}

export function DataTable<T extends { id: number | string }>({
  columns: columnsProp,
  rows,
  edit,
  onDelete,
  onBulkDelete,
  bulkActions,
  emptyText,
  bulkActionsContainer,
  serverPaging,
  stateKey,
}: {
  columns: Column<T>[];
  rows: T[];
  /** اگر مشخص شود، دکمه‌ی «ویرایش» نمایش داده می‌شود و همیشه فرم را در یک تب جدید باز می‌کند (هرگز تب فهرست را بازنویسی نمی‌کند) */
  edit?: EditAction<T>;
  onDelete?: (row: T) => void;
  /** اگر مشخص نشود ولی onDelete موجود باشد، حذف گروهی با فراخوانی onDelete برای هر ردیف انجام می‌شود */
  onBulkDelete?: (rows: T[]) => void | Promise<void>;
  /** عملیات گروهی سفارشی دیگر (مثل بررسی/برگشت از بررسی) که در همان منوی «عملیات» نمایش داده می‌شوند */
  bulkActions?: { label: (count: number) => string; icon?: any; onClick: (rows: T[]) => void | Promise<void>; danger?: boolean;
    /** عملیات سراسری فهرست (مثل «شماره‌گذاری مجدد») که به انتخاب ردیف نیاز ندارد: همیشه فعال است و انتخاب را پاک نمی‌کند */
    noSelection?: boolean }[];
  emptyText?: string;
  /** اگر داده شود، نوار عملیات گروهی به‌جای بالای جدول، در این عنصر (معمولاً سرصفحه‌ی صفحه) نمایش داده می‌شود.
   * اگر داده نشود، خودِ DataTable به‌صورت خودکار نزدیک‌ترین «.header-toolbar» هم‌سطح (زیرِ همان ریشه‌ی
   * صفحه) را پیدا و در آن ادغام می‌کند — نیازی به سیم‌کشی دستی bulkSlot در هر صفحه نیست؛ فقط اگر صفحه
   * اصلاً چنین نواری نداشته باشد (پس‌زمینه به حالت قبلی، نوار مستقل بالای گرید) برمی‌گردد. */
  bulkActionsContainer?: HTMLElement | null;
  /** اگر داده شود، صفحه‌بندی/فیلتر/مرتب‌سازی سمت سرور انجام می‌شود (به‌جای پردازش کل rows در مرورگر) */
  serverPaging?: ServerPaging;
  /** فقط برای صفحاتی که بیش از یک DataTable هم‌زمان با ستون‌های یکسان در یک مسیر دارند (مثلاً «بستن
   * حسابها»: گرید «حسابهای قابل انتخاب» و «حسابهای انتخاب‌شده» با یک لیست ستون مشترک) لازم است — تا
   * وضعیت (فیلتر/مرتب‌سازی/صفحه/انتخاب) دو گرید با هم قاطی نشود. در نبود آن، پیش‌فرض خودِ مسیر صفحه
   * است که برای اکثریت قریب‌به‌اتفاق صفحات (یک گرید در هر مسیر) کافی است. */
  stateKey?: string;
}) {
  const { openTab } = useTabs();
  const columns = withJournalEntryColumn(columnsProp, rows);
  const location = useLocation();
  const gridName = deriveGridName(location.pathname);
  // کلید پایه‌ی وضعیتِ همین گرید — با پیشوند مسیر صفحه، تا هم با clearPersistedStateByPrefix(مسیر) در
  // openTab/closeAllTabs (باز کردن یک تب واقعاً جدید) پاک شود، هم توسط clearPersistedState(مسیر) در
  // refreshTabIfStale (رفرش خودکار به‌خاطر کهنه‌شدن) دست‌نخورده بماند — چون آن فقط دقیقاً همان کلید
  // بدون این پسوند را پاک می‌کند، نه هر کلیدی که با آن شروع شود.
  const gridStateBase = `${location.pathname}${stateKey ? `:${stateKey}` : ""}:grid`;

  // فیلتر/مرتب‌سازی/صفحه/تعداد-در-صفحه/انتخاب — دقیقاً همان چیزی که کاربر آخرین بار در همین گرید دیده،
  // با سوییچ بین تب‌ها (unmount/remount کامل کامپوننت طبق TabsContext) یا رفرش خودکار به‌خاطر کهنه‌شدن
  // باید دست‌نخورده بماند؛ فقط خودِ rows (که از بیرون داده می‌شود) ممکن است تازه‌سازی شود. طبق تصمیم
  // صریح کاربر، این یک ویژگی پایه است، نه چیزی که هر صفحه باید جداگانه سیم‌کشی کند.
  const [filters, setFilters] = usePersistedState<Record<string, ActiveFilter>>(`${gridStateBase}:filters`, {});
  const [sort, setSort] = usePersistedState<GridSort | null>(`${gridStateBase}:sort`, null);
  const [page, setPage] = usePersistedState<number>(`${gridStateBase}:page`, 1);
  const [pageSize, setPageSize] = usePersistedState<number>(`${gridStateBase}:pageSize`, DEFAULT_PAGE_SIZE);
  const [selected, setSelected] = usePersistedState<Set<number | string>>(`${gridStateBase}:selected`, () => new Set());

  const [openFilterFor, setOpenFilterFor] = useState<string | null>(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const filterBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // اگر صفحه صریحاً bulkActionsContainer نداده باشد، خودمان نزدیک‌ترین «.header-toolbar» را که هم‌سطحِ
  // ریشه‌ی این DataTable (زیرِ همان div ریشه‌ی صفحه) است پیدا می‌کنیم — طبق قرارداد یکنواخت صفحات فهرست
  // (<div><div className="page-header"><div className="header-toolbar">...</div></div>{error}<DataTable/></div>)،
  // این یعنی هر صفحه‌ی جدیدی که همین قرارداد را رعایت کند، بدون هیچ سیم‌کشی دستی (bulkSlot/useState/ref)
  // به‌صورت خودکار یک نوار ابزار یکپارچه می‌گیرد؛ صفحاتی که این قرارداد را ندارند (یا صریحاً
  // bulkActionsContainer دیگری داده‌اند) دست‌نخورده می‌مانند.
  // ref معمولی + useEffect این‌جا کافی نیست: تا وقتی rows خالی است (noRowsAtAll پایین‌تر) اصلاً این div
  // رندر نمی‌شود، پس اولین بار که بعد از لود داده واقعاً ظاهر می‌شود، وابستگی‌های useEffect عوض نشده‌اند
  // و دوباره اجرا نمی‌شود. callback ref دقیقاً همان لحظه‌ای که خودِ گره DOM متصل می‌شود فراخوانی می‌شود —
  // مستقل از این‌که رندر قبلی‌اش اصلاً وجود داشته یا نه.
  const [autoBulkContainer, setAutoBulkContainer] = useState<HTMLElement | null>(null);
  const setRootRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || bulkActionsContainer !== undefined) return;
      const found = node.parentElement?.querySelector<HTMLElement>(".header-toolbar") ?? null;
      setAutoBulkContainer(found);
    },
    [bulkActionsContainer]
  );
  const effectiveBulkContainer = bulkActionsContainer !== undefined ? bulkActionsContainer : autoBulkContainer;

  // ویرایش همیشه در یک تب جدید باز می‌شود، نه با بازنویسی تب فهرست جاری — این تنها مسیر ویرایش در کل
  // برنامه است، پس این قاعده برای هر فرمی که از DataTable استفاده می‌کند به‌صورت خودکار برقرار است
  function handleEdit(row: T) {
    if (!edit) return;
    if (edit.guard) {
      const result = edit.guard(row);
      if (result !== true) {
        showError(result);
        return;
      }
    }
    openTab(edit.path(row));
  }

  // در حالت serverPaging، rows همان صفحه‌ی از قبل فیلترشده/مرتب‌شده/صفحه‌بندی‌شده از سرور است؛
  // پردازش محلی فیلتر/مرتب‌سازی/صفحه‌بندی صرفاً برای حالت کلاینتی (بدون serverPaging) اجرا می‌شود
  const filteredRows = serverPaging
    ? rows
    : rows.filter((row) =>
        columns.every((col) => {
          const filter = filters[col.header];
          if (!filter || !col.filterType || !col.filterValue) return true;
          return matchesFilter(col.filterValue(row), col.filterType, filter);
        })
      );

  const sortedRows = serverPaging
    ? filteredRows
    : (() => {
        // مرتب‌سازی چندستونه (Ctrl/Shift + کلیک): کلیدها به ترتیب اولویت — lib/gridSort.ts
        const cmp = makeComparator<T>(sort, (h) => {
          const col = columns.find((c) => c.header === h);
          return col?.sortValue || col?.filterValue;
        });
        return cmp ? [...filteredRows].sort(cmp) : filteredRows;
      })();

  function toggleSort(col: Column<T>, multi = false) {
    const accessor = col.sortValue || col.filterValue;
    if (!accessor) return;
    setSort((prev) => {
      const next = nextSort(prev, col.header, multi);
      serverPaging?.onSortChange?.(next);
      return next;
    });
  }

  // با تغییر فیلتر/مرتب‌سازی/تعداد-در-صفحه توسط خودِ کاربر (نه با mount شدنِ کامپوننت — که به‌خاطر
  // بازیابی وضعیت قبلی از usePersistedState، فیلتر/مرتب‌سازی از همان ابتدا مقدار دارند)، صفحه‌بندی از
  // ابتدا (صفحه ۱) شروع می‌شود؛ فقط در حالت کلاینتی (در حالت سرور، صفحه توسط parent در
  // onFiltersChange/onSortChange مدیریت می‌شود). عمداً rows.length از وابستگی‌ها حذف شده: یک رفرش
  // داده (حذف/ویرایش/سند جدید) نباید کاربر را به صفحه‌ی ۱ برگرداند — اگر صفحه‌ی فعلی از تعداد صفحات
  // جدید بیشتر شود، همان clamp موجود (Math.min(page, totalPages)) به‌تنهایی کافی است.
  const skipNextPageReset = useRef(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (skipNextPageReset.current) {
      skipNextPageReset.current = false;
      return;
    }
    if (!serverPaging) setPage(1);
  }, [filters, sort, pageSize]);

  const totalRows = serverPaging ? serverPaging.total : sortedRows.length;
  const effectivePageSize = serverPaging ? serverPaging.pageSize : pageSize;
  const totalPages = Math.max(1, Math.ceil(totalRows / effectivePageSize));
  const currentPage = serverPaging ? serverPaging.page : Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * effectivePageSize;
  const pageRows = serverPaging ? sortedRows : sortedRows.slice(pageStart, pageStart + pageSize);

  // جمع ستون‌های decimal روی «صفحه‌ی جاری» (pageRows) — نه کل دیتاست — طبق تصمیم صریح کاربر؛ با تغییر
  // rows/فیلتر/صفحه/تعداد-در-صفحه، pageRows خودش دوباره محاسبه می‌شود، پس این جمع هم خودکار به‌روز است.
  const columnTotals: (number | null)[] = columns.map((c) => {
    const accessor = c.totalValue || c.filterValue;
    if (!c.decimal || !accessor) return null;
    let sum = 0;
    for (const row of pageRows) {
      const raw = accessor(row);
      const n = Number(raw);
      if (!Number.isNaN(n)) sum += n;
    }
    return Math.round(sum * 1e6) / 1e6;
  });
  const hasColumnTotals = columnTotals.some((t) => t !== null);

  // ردیف «جمع» دقیقاً مثل گرید «مرور مبلغی انبار» (SelectableBalanceTable): یک جدول مجزا بیرون از ناحیه‌ی اسکرول‌شونده، زیر هر ستون (نه لیست برچسب:مقدار)، همیشه
  // ته گرید و بالای صفحه‌بندی؛ عرض هر ستونش از عرض واقعی <th>های جدول اصلی اندازه‌گیری می‌شود و اسکرول افقی‌اش با گرید هم‌گام است. یک پیاده‌سازی برای همه‌ی فهرست‌ها.
  const theadRowRef = useRef<HTMLTableRowElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const footerScrollRef = useRef<HTMLDivElement>(null);
  const [colWidths, setColWidths] = useState<number[]>([]);
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
  }, [columns, sort, filters, rows, selected.size]);
  function syncFooterScroll() {
    if (scrollAreaRef.current && footerScrollRef.current) footerScrollRef.current.scrollLeft = scrollAreaRef.current.scrollLeft;
  }

  function goToPage(p: number) {
    const clamped = Math.max(1, Math.min(p, totalPages));
    if (serverPaging) serverPaging.onPageChange(clamped);
    else setPage(clamped);
  }

  const canBulkDelete = !!(onBulkDelete || onDelete);
  const selectedRows = sortedRows.filter((r) => selected.has(r.id));
  const allVisibleSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));

  function toggleRow(id: number | string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev);
        pageRows.forEach((r) => next.delete(r.id));
        return next;
      }
      const next = new Set(prev);
      pageRows.forEach((r) => next.add(r.id));
      return next;
    });
  }

  async function handleBulkDelete() {
    setBulkMenuOpen(false);
    if (selectedRows.length === 0) return;
    if (!window.confirm(`${toFaDigits(String(selectedRows.length))} ردیف انتخاب‌شده حذف شود؟`)) return;
    if (onBulkDelete) {
      await onBulkDelete(selectedRows);
    } else if (onDelete) {
      for (const row of selectedRows) {
        // eslint-disable-next-line no-await-in-loop
        await onDelete(row);
      }
    }
    setSelected(new Set());
  }

  async function handleCustomBulkAction(action: { onClick: (rows: T[]) => void | Promise<void>; noSelection?: boolean }) {
    setBulkMenuOpen(false);
    if (action.noSelection) {
      await action.onClick(selectedRows);
      return;
    }
    if (selectedRows.length === 0) return;
    await action.onClick(selectedRows);
    setSelected(new Set());
  }

  function openFilter(header: string) {
    const btn = filterBtnRefs.current[header];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setPopoverPos({ top: rect.bottom + 4, left: Math.max(8, rect.right - 220) });
    }
    setOpenFilterFor(openFilterFor === header ? null : header);
  }

  // قاعده‌ی پایه: سرستون‌های گرید همیشه نمایش داده می‌شوند، حتی وقتی هیچ رکوردی نیست (پیام «خالی» داخل خودِ جدول می‌آید)
  const noRowsAtAll = serverPaging ? !serverPaging.loading && serverPaging.total === 0 : !rows.length;

  // خروجی اکسل/چاپ همیشه روی داده‌ی «در دسترس» فعلی اجرا می‌شوند: در حالت کلاینتی یعنی کل نتیجه‌ی
  // فیلترشده/مرتب‌شده (sortedRows، نه فقط صفحه‌ی جاری)، در حالت serverPaging یعنی همان صفحه‌ی جاری از
  // سرور (rows) — چون این تابع صفحه‌بندی را مدیریت نمی‌کند و فچ «همه‌ی صفحات» را نمی‌داند
  const exportRows = serverPaging ? rows : sortedRows;
  // ستون «ردیف» طبق درخواست کاربر پایه/base است (همه‌ی گریدها، از جمله گریدهای آینده، خودکار دارند) —
  // در حالت کلاینتی exportRows همان کل دیتاست مرتب‌شده است، پس شماره‌گذاری ۱..N ساده کافی است؛ در حالت
  // serverPaging، exportRows فقط صفحه‌ی جاری است، پس باید از pageStart ادامه پیدا کند تا با شماره‌ی
  // نمایش‌داده‌شده روی صفحه یکی باشد.
  const exportRowIndexBase = serverPaging ? pageStart : 0;
  const rowIndexById = new Map(exportRows.map((r, i) => [r.id, exportRowIndexBase + i + 1]));
  const exportColumns: ExportColumn<T>[] = [{ header: "ردیف", render: (row: T) => rowIndexById.get(row.id) ?? "" }, ...columns];

  const bulkToolbar = (
    <div className={`bulk-toolbar ${selected.size > 0 ? "active" : ""} ${effectiveBulkContainer ? "in-header" : ""}`}>
      <span className="bulk-toolbar-info">
        {selected.size > 0 ? `${toFaDigits(String(selected.size))} ردیف انتخاب شده` : "\u00A0"}
      </span>
      <div className="bulk-toolbar-actions">
        <button type="button" className="toolbar-icon-btn" onClick={() => exportGridToCsv(exportColumns, exportRows, gridName)} title="خروجی اکسل">
          <ExcelExportIcon />
        </button>
        <button type="button" className="toolbar-icon-btn" onClick={() => printGrid(exportColumns, exportRows, gridName)} title="چاپ">
          <PrintIcon />
        </button>
        {selected.size > 0 && (
          <button type="button" className="toolbar-icon-btn" onClick={() => setSelected(new Set())} title="لغو انتخاب">
            <CancelSelectionIcon />
          </button>
        )}
        <div className="toolbar-menu-wrap">
          <button
            type="button"
            className="toolbar-icon-btn"
            onClick={() => setBulkMenuOpen((v) => !v)}
            title="عملیات"
          >
            <OperationsIcon />
          </button>
          {bulkMenuOpen && (
            <>
              <div className="filter-backdrop" onClick={() => setBulkMenuOpen(false)} />
              <div className="toolbar-menu">
                {bulkActions?.map((action, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`toolbar-menu-item ${action.danger ? "danger" : ""}`}
                    disabled={selected.size === 0 && !action.noSelection}
                    onClick={() => handleCustomBulkAction(action)}
                  >
                    {action.icon}
                    {action.label(selected.size)}
                  </button>
                ))}
                <button
                  type="button"
                  className="toolbar-menu-item danger"
                  disabled={!canBulkDelete || selected.size === 0}
                  onClick={handleBulkDelete}
                >
                  <TrashIcon />
                  حذف {selected.size > 0 ? `(${toFaDigits(String(selected.size))})` : ""}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="datatable-root" ref={setRootRef}>
      {effectiveBulkContainer ? createPortal(bulkToolbar, effectiveBulkContainer) : bulkToolbar}
      <div className="grid-wrap">
      <div ref={scrollAreaRef} className="card grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }} onScroll={syncFooterScroll}>
        <table>
          <thead>
            <tr ref={theadRowRef}>
              <th style={{ width: 34 }}>
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} />
              </th>
              <th style={{ width: 44 }}>ردیف</th>
              {columns.map((c) => {
                const hasFilter = !!c.filterType && !!c.filterValue;
                const isActive = !!filters[c.header];
                const canSort = !!(c.sortValue || c.filterValue);
                const sortState = sortStateOf(sort, c.header);
                return (
                  <th key={c.header} style={{ width: c.width }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span
                        onClick={canSort ? (e) => toggleSort(c, e.ctrlKey || e.shiftKey || e.metaKey) : undefined}
                        style={canSort ? { cursor: "pointer", display: "flex", alignItems: "center", gap: 3 } : undefined}
                        title={canSort ? "مرتب‌سازی (Ctrl/Shift + کلیک برای مرتب‌سازی چندستونه)" : undefined}
                      >
                        {c.header}
                        {canSort && <SortIcon dir={sortState?.dir ?? null} />}
                        {sortState?.priority && <span className="sort-priority">{toFaDigits(String(sortState.priority))}</span>}
                      </span>
                      {hasFilter && (
                        <button
                          ref={(el) => (filterBtnRefs.current[c.header] = el)}
                          type="button"
                          className={`filter-btn ${isActive ? "active" : ""}`}
                          onClick={() => openFilter(c.header)}
                          title="فیلتر"
                        >
                          <FilterIcon active={isActive} />
                        </button>
                      )}
                    </div>
                  </th>
                );
              })}
              {(edit || onDelete) && <th style={{ width: edit && onDelete ? 130 : 70 }}></th>}
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 3} className="empty-state" style={{ border: "none" }}>
                  {noRowsAtAll ? emptyText || "هنوز رکوردی ثبت نشده است" : "رکوردی مطابق فیلترهای اعمال‌شده یافت نشد"}
                </td>
              </tr>
            )}
            {pageRows.map((row, idx) => (
              <tr key={row.id}>
                <td>
                  <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleRow(row.id)} />
                </td>
                <td>{toFaDigits(String(pageStart + idx + 1))}</td>
                {columns.map((c) => (
                  <td key={c.header}>{renderCell(c.render(row))}</td>
                ))}
                {(edit || onDelete) && (
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      {edit && (
                        <button className="btn secondary" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => handleEdit(row)}>
                          ویرایش
                        </button>
                      )}
                      {onDelete && (
                        <button className="btn danger" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => onDelete(row)}>
                          حذف
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hasColumnTotals && sortedRows.length > 0 && (
        <div className="grid-footer-totals">
          <div className="grid-footer-totals-scroll" ref={footerScrollRef}>
            <table style={{ tableLayout: "fixed", width: colWidths.length ? colWidths.reduce((a, w) => a + w, 0) : undefined }}>
              <tbody>
                <tr>
                  <td style={{ width: colWidths[0] }} />
                  <td style={{ width: colWidths[1] }}>جمع</td>
                  {columns.map((c, i) => (
                    <td key={c.header} style={{ width: colWidths[i + 2] }}>
                      {columnTotals[i] !== null ? formatAmountFa(columnTotals[i]!) : ""}
                    </td>
                  ))}
                  {colWidths.slice(columns.length + 2).map((w, k) => (
                    <td key={`x${k}`} style={{ width: w }} />
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="grid-footer">
        <span className="grid-footer-info">
          {serverPaging?.loading
            ? "در حال بارگذاری..."
            : totalRows === 0
            ? "بدون رکورد"
            : `نمایش ${toFaDigits(String(pageStart + 1))} تا ${toFaDigits(String(Math.min(pageStart + effectivePageSize, totalRows)))} از ${toFaDigits(String(totalRows))} رکورد`}
        </span>
        <div className="grid-footer-controls">
          <label className="grid-page-size">
            تعداد در صفحه
            <select
              value={effectivePageSize}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (serverPaging) serverPaging.onPageSizeChange(n);
                else setPageSize(n);
              }}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>{toFaDigits(String(n))}</option>
              ))}
            </select>
          </label>
          <div className="grid-page-nav">
            <button type="button" className="btn secondary" disabled={currentPage <= 1} onClick={() => goToPage(currentPage - 1)}>
              قبلی
            </button>
            <span className="grid-page-indicator">
              صفحه {toFaDigits(String(currentPage))} از {toFaDigits(String(totalPages))}
            </span>
            <button type="button" className="btn secondary" disabled={currentPage >= totalPages} onClick={() => goToPage(currentPage + 1)}>
              بعدی
            </button>
          </div>
        </div>
      </div>
      </div>

      {openFilterFor &&
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
                    return next;
                  })
                }
                onClear={() =>
                  setFilters((prev) => {
                    const next = { ...prev };
                    delete next[c.header];
                    serverPaging?.onFiltersChange?.(next);
                    return next;
                  })
                }
                onClose={() => setOpenFilterFor(null)}
              />
            )
        )}
    </div>
  );
}
