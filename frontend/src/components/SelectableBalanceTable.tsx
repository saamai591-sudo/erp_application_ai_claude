import { useRef, useState } from "react";
import { SelectId } from "../lib/useChainedMultiSelect";
import { toFaDigits } from "../lib/formatAmount";
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

export function SelectableBalanceTable<T extends { id: SelectId }>({
  rows,
  columns,
  selected,
  onToggle,
  loading,
  emptyText,
  serverPaging,
}: {
  rows: T[];
  columns: BalanceTableColumn<T>[];
  selected: Set<SelectId>;
  onToggle: (id: SelectId) => void;
  loading?: boolean;
  emptyText?: string;
  /** اگر داده شود، مرتب‌سازی/صفحه‌بندی سمت سرور انجام می‌شود (به‌جای پردازش کل rows در مرورگر) */
  serverPaging?: BalanceTableServerPaging;
}) {
  const [sort, setSort] = useState<{ header: string; dir: "asc" | "desc" } | null>(null);
  const [filters, setFilters] = useState<Record<string, ActiveFilter>>({});
  const [openFilterFor, setOpenFilterFor] = useState<string | null>(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const filterBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function toggleSort(col: BalanceTableColumn<T>) {
    if (!col.sortValue) return;
    setSort((prev) => {
      const next: { header: string; dir: "asc" | "desc" } | null =
        !prev || prev.header !== col.header ? { header: col.header, dir: "asc" } : prev.dir === "asc" ? { header: col.header, dir: "desc" } : null;
      serverPaging?.onSortChange?.(next);
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
    const col = columns.find((c) => c.header === sort.header);
    if (col?.sortValue) {
      sortedRows = [...filteredRows].sort((a, b) => {
        const av = col.sortValue!(a);
        const bv = col.sortValue!(b);
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "fa");
        return sort.dir === "asc" ? cmp : -cmp;
      });
    }
  }

  // در حالت کلاینتی، دقیقاً رفتار قبلی حفظ می‌شود (نمایش کامل پیام بارگذاری)؛
  // در حالت سرور، اگر داده‌ی صفحه‌ی قبلی موجود باشد، حین لود صفحه‌ی جدید همچنان نمایش داده می‌شود (بدون پرش/خالی شدن ناگهانی)
  const showLoadingState = serverPaging ? loading && rows.length === 0 : !!loading;
  const totalRows = serverPaging ? serverPaging.total : sortedRows.length;
  const pageSize = serverPaging?.pageSize ?? 0;
  const pageStart = serverPaging ? (serverPaging.page - 1) * pageSize : 0;
  const totalPages = serverPaging ? Math.max(1, Math.ceil(serverPaging.total / serverPaging.pageSize)) : 1;

  const table = showLoadingState ? (
    <div className="empty-state">در حال بارگذاری...</div>
  ) : (
    <table>
      <thead>
        <tr>
          <th style={{ width: 34 }}></th>
          {columns.map((c) => {
            const dir = sort?.header === c.header ? sort.dir : null;
            const hasFilter = !!c.filterType && !!c.filterValue;
            const isFilterActive = !!filters[c.header];
            return (
              <th key={c.header} style={{ width: c.width }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  {c.sortValue ? (
                    <span onClick={() => toggleSort(c)} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }} title="مرتب‌سازی">
                      {c.header}
                      <SortIcon dir={dir} />
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
        {sortedRows.length === 0 && (
          <tr>
            <td colSpan={columns.length + 1} className="empty-state" style={{ border: "none" }}>
              {emptyText || "رکوردی یافت نشد"}
            </td>
          </tr>
        )}
        {sortedRows.map((row) => (
          <tr
            key={row.id}
            className={selected.has(row.id) ? "active-list" : ""}
            style={{ cursor: "pointer" }}
            onClick={() => onToggle(row.id)}
          >
            <td onClick={(e) => e.stopPropagation()} style={{ textAlign: "center" }}>
              <input type="checkbox" checked={selected.has(row.id)} onChange={() => onToggle(row.id)} />
            </td>
            {columns.map((c) => (
              <td key={c.header}>{c.render(row)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );

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
    );

  if (!serverPaging) {
    return (
      <>
        <div className="card grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }}>
          {table}
        </div>
        {filterPopover}
      </>
    );
  }

  return (
    <div className="grid-wrap">
      <div className="card grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }}>
        {table}
      </div>
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
