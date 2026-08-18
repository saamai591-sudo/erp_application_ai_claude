import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { JalaliDatePicker } from "./JalaliDatePicker";
import { toFaDigits } from "../lib/formatAmount";

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

function matchesFilter(raw: string | number | null | undefined, type: ColumnFilterType, filter: ActiveFilter): boolean {
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

function FilterIcon({ active }: { active: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"}>
      <path d="M4 5h16l-6 8v6l-4-2v-4L4 5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function FilterPopover({
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
  onSortChange?: (sort: { header: string; dir: "asc" | "desc" } | null) => void;
}

export function DataTable<T extends { id: number | string }>({
  columns,
  rows,
  onEdit,
  onDelete,
  onBulkDelete,
  bulkActions,
  emptyText,
  bulkActionsContainer,
  serverPaging,
}: {
  columns: Column<T>[];
  rows: T[];
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  /** اگر مشخص نشود ولی onDelete موجود باشد، حذف گروهی با فراخوانی onDelete برای هر ردیف انجام می‌شود */
  onBulkDelete?: (rows: T[]) => void | Promise<void>;
  /** عملیات گروهی سفارشی دیگر (مثل بررسی/برگشت از بررسی) که در همان منوی «عملیات» نمایش داده می‌شوند */
  bulkActions?: { label: (count: number) => string; icon?: any; onClick: (rows: T[]) => void | Promise<void>; danger?: boolean }[];
  emptyText?: string;
  /** اگر داده شود، نوار عملیات گروهی به‌جای بالای جدول، در این عنصر (معمولاً سرصفحه‌ی صفحه) نمایش داده می‌شود */
  bulkActionsContainer?: HTMLElement | null;
  /** اگر داده شود، صفحه‌بندی/فیلتر/مرتب‌سازی سمت سرور انجام می‌شود (به‌جای پردازش کل rows در مرورگر) */
  serverPaging?: ServerPaging;
}) {
  const [filters, setFilters] = useState<Record<string, ActiveFilter>>({});
  const [openFilterFor, setOpenFilterFor] = useState<string | null>(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const [selected, setSelected] = useState<Set<number | string>>(new Set());
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [sort, setSort] = useState<{ header: string; dir: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const filterBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

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
        if (!sort) return filteredRows;
        const col = columns.find((c) => c.header === sort.header);
        const accessor = col?.sortValue || col?.filterValue;
        if (!accessor) return filteredRows;
        const withKey = filteredRows.map((row) => ({ row, key: accessor(row) }));
        withKey.sort((a, b) => {
          const av = a.key, bv = b.key;
          if (av === null || av === undefined) return 1;
          if (bv === null || bv === undefined) return -1;
          let cmp: number;
          if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
          else cmp = String(av).localeCompare(String(bv), "fa");
          return sort.dir === "asc" ? cmp : -cmp;
        });
        return withKey.map((x) => x.row);
      })();

  function toggleSort(col: Column<T>) {
    const accessor = col.sortValue || col.filterValue;
    if (!accessor) return;
    setSort((prev) => {
      const next: { header: string; dir: "asc" | "desc" } | null =
        !prev || prev.header !== col.header ? { header: col.header, dir: "asc" } : prev.dir === "asc" ? { header: col.header, dir: "desc" } : null;
      serverPaging?.onSortChange?.(next);
      return next;
    });
  }

  // با تغییر فیلتر یا مرتب‌سازی، صفحه‌بندی از ابتدا (صفحه ۱) شروع می‌شود (فقط در حالت کلاینتی؛
  // در حالت سرور، صفحه توسط parent در onFiltersChange/onSortChange مدیریت می‌شود)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!serverPaging) setPage(1);
  }, [filters, sort, rows.length, pageSize]);

  const totalRows = serverPaging ? serverPaging.total : sortedRows.length;
  const effectivePageSize = serverPaging ? serverPaging.pageSize : pageSize;
  const totalPages = Math.max(1, Math.ceil(totalRows / effectivePageSize));
  const currentPage = serverPaging ? serverPaging.page : Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * effectivePageSize;
  const pageRows = serverPaging ? sortedRows : sortedRows.slice(pageStart, pageStart + pageSize);

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

  async function handleCustomBulkAction(action: { onClick: (rows: T[]) => void | Promise<void> }) {
    setBulkMenuOpen(false);
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

  const noRowsAtAll = serverPaging ? !serverPaging.loading && serverPaging.total === 0 : !rows.length;
  if (noRowsAtAll) {
    return <div className="card empty-state">{emptyText || "هنوز رکوردی ثبت نشده است"}</div>;
  }

  const bulkToolbar = (
    <div className={`bulk-toolbar ${selected.size > 0 ? "active" : ""} ${bulkActionsContainer ? "in-header" : ""}`}>
      <span className="bulk-toolbar-info">
        {selected.size > 0 ? `${toFaDigits(String(selected.size))} ردیف انتخاب شده` : "\u00A0"}
      </span>
      <div className="bulk-toolbar-actions">
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
                    disabled={selected.size === 0}
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
    <div className="datatable-root">
      {bulkActionsContainer ? createPortal(bulkToolbar, bulkActionsContainer) : bulkToolbar}
      <div className="grid-wrap">
      <div className="card grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 34 }}>
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} />
              </th>
              {columns.map((c) => {
                const hasFilter = !!c.filterType && !!c.filterValue;
                const isActive = !!filters[c.header];
                const canSort = !!(c.sortValue || c.filterValue);
                const sortDir = sort?.header === c.header ? sort.dir : null;
                return (
                  <th key={c.header} style={{ width: c.width }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span
                        onClick={canSort ? () => toggleSort(c) : undefined}
                        style={canSort ? { cursor: "pointer", display: "flex", alignItems: "center", gap: 3 } : undefined}
                        title={canSort ? "مرتب‌سازی" : undefined}
                      >
                        {c.header}
                        {canSort && <SortIcon dir={sortDir} />}
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
              {(onEdit || onDelete) && <th style={{ width: onEdit && onDelete ? 130 : 70 }}></th>}
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} className="empty-state" style={{ border: "none" }}>
                  رکوردی مطابق فیلترهای اعمال‌شده یافت نشد
                </td>
              </tr>
            )}
            {pageRows.map((row) => (
              <tr key={row.id}>
                <td>
                  <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleRow(row.id)} />
                </td>
                {columns.map((c) => (
                  <td key={c.header}>{renderCell(c.render(row))}</td>
                ))}
                {(onEdit || onDelete) && (
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      {onEdit && (
                        <button className="btn secondary" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => onEdit(row)}>
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
