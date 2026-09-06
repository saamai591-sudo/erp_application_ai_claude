import { useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { SelectId } from "../lib/useChainedMultiSelect";
import { toFaDigits } from "../lib/formatAmount";
import { exportGridToCsv, printGrid, deriveGridName, ExportColumn } from "../lib/gridExport";
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

export function SelectableBalanceTable<T extends { id: SelectId }>({
  rows,
  columns,
  selected,
  onToggle,
  loading,
  emptyText,
  serverPaging,
  selectAll,
}: {
  rows: T[];
  columns: BalanceTableColumn<T>[];
  selected: Set<SelectId>;
  onToggle: (id: SelectId) => void;
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
          <th style={{ width: 34 }}>
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
          <th style={{ width: 44 }}>ردیف</th>
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
            <td colSpan={columns.length + 2} className="empty-state" style={{ border: "none" }}>
              {emptyText || "رکوردی یافت نشد"}
            </td>
          </tr>
        )}
        {sortedRows.map((row, idx) => (
          <tr
            key={row.id}
            className={selected.has(row.id) ? "active-list" : ""}
            style={{ cursor: "pointer" }}
            onClick={() => onToggle(row.id)}
          >
            <td onClick={(e) => e.stopPropagation()} style={{ textAlign: "center" }}>
              <input type="checkbox" checked={selected.has(row.id)} onChange={() => onToggle(row.id)} />
            </td>
            <td>{toFaDigits(String(pageStart + idx + 1))}</td>
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
  const exportToolbar = (
    <div className="bulk-toolbar">
      <span className="bulk-toolbar-info">{" "}</span>
      <div className="bulk-toolbar-actions">
        <button type="button" className="toolbar-icon-btn" onClick={() => exportGridToCsv(exportColumns, exportRows, gridName)} title="خروجی اکسل">
          <ExcelExportIcon />
        </button>
        <button type="button" className="toolbar-icon-btn" onClick={() => printGrid(exportColumns, exportRows, gridName)} title="چاپ">
          <PrintIcon />
        </button>
      </div>
    </div>
  );

  if (!serverPaging) {
    return (
      <>
        {exportToolbar}
        <div className="card grid-scroll-area" style={{ overflowX: "auto", overflowY: "auto" }}>
          {table}
        </div>
        {filterPopover}
      </>
    );
  }

  return (
    <div className="grid-wrap">
      {exportToolbar}
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
