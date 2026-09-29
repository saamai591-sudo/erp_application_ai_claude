import { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal";
import { usePickerKeyboard } from "./pickerKeyboard";

export interface PickerColumn<T> {
  header: string;
  render: (row: T) => any;
  filterValue: (row: T) => string;
  width?: string;
}

export function RecordPickerField<T extends { id: number | string }>({
  displayValue,
  rows,
  columns,
  onSelect,
  onSelectMultiple,
  multiSelect,
  resultInDisplayOrder,
  onOpen,
  placeholder,
  disabled,
  title,
  onClear,
}: {
  /** مقداری که در فیلد بسته (کد) نمایش داده می‌شود */
  displayValue: string;
  rows: T[];
  columns: PickerColumn<T>[];
  onSelect?: (row: T) => void;
  /** فقط در حالت multiSelect استفاده می‌شود — با تایید دیالوگ، همه‌ی ردیف‌های تیک‌خورده یک‌جا برگردانده
   * می‌شوند (طبق تصمیم صریح کاربر: «انتخابگرهای سطح ردیف» باید امکان انتخاب چندتایی و افزودن یک‌جا به
   * گرید را داشته باشند) */
  onSelectMultiple?: (rows: T[]) => void;
  /** اگر true باشد، دیالوگ به‌جای انتخاب تک‌ردیفی (کلیک=انتخاب، دابل‌کلیک=تایید فوری)، هر ردیف را با
   * چک‌باکس تیک می‌زند و «تایید» همه‌ی ردیف‌های تیک‌خورده را با onSelectMultiple برمی‌گرداند */
  multiSelect?: boolean;
  /** فقط در حالت multiSelect: ردیف‌های تیک‌خورده به همان ترتیبی که در دیالوگ (مرتب‌سازی فعلی) نمایش داده می‌شوند
   * برگردانده شوند. پیش‌فرض (false): به ترتیب خودِ rows — مناسب انتخابگر ردیف‌های سند مبنا که rows از قبل
   * به ترتیب ردیف‌های همان سند است. برای فهرست‌هایی مثل کالا که «سند مبنا» ندارند و ترتیب rows دلخواه/نزولی است. */
  resultInDisplayOrder?: boolean;
  /** اگر مقدار بازگشتی دقیقاً false باشد، دیالوگ باز نمی‌شود (برای گیت کردن باز شدن انتخابگر پشتِ یک
   * پیش‌شرط، مثل الزامی‌بودن فیلدهای سرصفحه — نگاه کنید به guardRowEntry در فرم‌های مبنادار) */
  onOpen?: () => void | boolean;
  placeholder?: string;
  disabled?: boolean;
  title: string;
  /** اگر داده شود و فیلد مقداری داشته باشد، دکمه‌ی کوچک «پاک کردن» کنار فیلد نمایش داده می‌شود (برای فیلدهای اختیاری) */
  onClear?: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="picker-field-wrap">
        <button
          type="button"
          className="picker-field"
          disabled={disabled}
          onClick={() => {
            if (onOpen?.() === false) return;
            setOpen(true);
          }}
        >
          <span>{displayValue || <span className="picker-placeholder">{placeholder || "انتخاب کنید"}</span>}</span>
          <SearchIcon />
        </button>
        {onClear && displayValue && !disabled && (
          <button type="button" className="picker-clear-btn" title="پاک کردن" onClick={onClear}>
            <ClearIcon />
          </button>
        )}
      </div>
      {open && (
        <RecordPickerDialog
          title={title}
          rows={rows}
          columns={columns}
          multiSelect={multiSelect}
          resultInDisplayOrder={resultInDisplayOrder}
          onSelect={(row) => {
            onSelect?.(row);
            setOpen(false);
          }}
          onSelectMultiple={(selectedRows) => {
            onSelectMultiple?.(selectedRows);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

export function RecordPickerDialog<T extends { id: number | string }>({
  title,
  rows,
  columns,
  multiSelect,
  resultInDisplayOrder,
  onSelect,
  onSelectMultiple,
  onClose,
}: {
  title: string;
  rows: T[];
  columns: PickerColumn<T>[];
  multiSelect?: boolean;
  resultInDisplayOrder?: boolean;
  onSelect: (row: T) => void;
  onSelectMultiple?: (rows: T[]) => void;
  onClose: () => void;
}) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [sort, setSort] = useState<{ header: string; dir: "asc" | "desc" } | null>(
    columns[0] ? { header: columns[0].header, dir: "asc" } : null
  );

  // همه‌ی ردیف‌ها با مرتب‌سازی فعلی (بدون فیلتر) — filteredRows و ترتیب خروجی انتخاب چندتایی از همین می‌آید
  const sortedRows = useMemo(() => {
    const result = [...rows];
    if (sort) {
      const col = columns.find((c) => c.header === sort.header);
      if (col) {
        result.sort((a, b) => {
          const cmp = col.filterValue(a).localeCompare(col.filterValue(b), "fa");
          return sort.dir === "asc" ? cmp : -cmp;
        });
      }
    }
    return result;
  }, [rows, columns, sort]);

  const filteredRows = useMemo(
    () =>
      sortedRows.filter((row) =>
        columns.every((col) => {
          const f = (filters[col.header] || "").trim().toLowerCase();
          if (!f) return true;
          return col.filterValue(row).toLowerCase().includes(f);
        })
      ),
    [sortedRows, columns, filters]
  );

  function toggleSort(header: string) {
    setSort((prev) => {
      if (!prev || prev.header !== header) return { header, dir: "asc" };
      if (prev.dir === "asc") return { header, dir: "desc" };
      return null;
    });
  }

  function toggleRowSelection(id: string | number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const allVisibleSelected = filteredRows.length > 0 && filteredRows.every((r) => selectedIds.has(r.id));
  function toggleAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) filteredRows.forEach((r) => next.delete(r.id));
      else filteredRows.forEach((r) => next.add(r.id));
      return next;
    });
  }

  function confirm() {
    if (multiSelect) {
      // طبق تصمیم صریح کاربر: انتخاب چندتایی روی همه‌ی rows (نه فقط filteredRows) کار می‌کند تا اگر
      // کاربر بعد از تیک‌زدن چند ردیف، فیلتر را عوض کند، ردیف‌های قبلاً تیک‌خورده که موقتاً از دید فیلتر
      // پنهان شده‌اند هم در نتیجه‌ی نهایی حفظ شوند.
      // ترتیب خروجی: پیش‌فرض ترتیب rows (ترتیب سند مبنا)، یا (resultInDisplayOrder) ترتیب نمایش فعلی دیالوگ
      const selectedRows = (resultInDisplayOrder ? sortedRows : rows).filter((r) => selectedIds.has(r.id));
      if (selectedRows.length > 0) onSelectMultiple?.(selectedRows);
      return;
    }
    const row = filteredRows.find((r) => r.id === selectedId);
    if (row) onSelect(row);
  }

  const kb = usePickerKeyboard({
    count: filteredRows.length,
    resetKey: JSON.stringify([filters, sort]),
    onEnter: (i) => {
      const row = filteredRows[i];
      if (!row) return;
      if (multiSelect) toggleRowSelection(row.id);
      else onSelect(row);
    },
    onConfirmAll: multiSelect ? confirm : undefined,
    onEscape: onClose,
  });
  // تک‌انتخابی: ردیف فعال همان ردیف انتخاب‌شده است (دکمه‌ی «تایید» هم به آن وابسته است)
  useEffect(() => {
    if (!multiSelect) setSelectedId(filteredRows[kb.activeIndex]?.id ?? null);
  }, [kb.activeIndex, filteredRows, multiSelect]);

  return (
    <Modal title={title} onClose={onClose}>
      <div className="picker-table-wrap" ref={kb.wrapRef}>
        <table className="picker-table">
          <thead>
            <tr>
              {multiSelect && (
                <th style={{ width: 34 }}>
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} />
                </th>
              )}
              {columns.map((c) => {
                const dir = sort?.header === c.header ? sort.dir : null;
                return (
                  <th key={c.header} style={{ width: c.width }}>
                    <span onClick={() => toggleSort(c.header)} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 }} title="مرتب‌سازی">
                      {c.header}
                      <PickerSortIcon dir={dir} />
                    </span>
                  </th>
                );
              })}
            </tr>
            <tr>
              {multiSelect && <th style={{ width: 34 }}></th>}
              {columns.map((c, ci) => (
                <th key={c.header} style={{ width: c.width }}>
                  <input
                    className="picker-filter-input"
                    autoFocus={ci === 0}
                    placeholder="فیلتر..."
                    value={filters[c.header] || ""}
                    onChange={(e) => setFilters((prev) => ({ ...prev, [c.header]: e.target.value }))}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={columns.length + (multiSelect ? 1 : 0)} className="empty-state" style={{ border: "none" }}>موردی یافت نشد</td>
              </tr>
            )}
            {filteredRows.map((row, idx) =>
              multiSelect ? (
                <tr
                  key={row.id}
                  data-row-index={idx}
                  className={`${selectedIds.has(row.id) ? "active-list" : ""} ${kb.activeIndex === idx ? "picker-cursor" : ""}`}
                  onClick={() => {
                    kb.setActiveIndex(idx);
                    toggleRowSelection(row.id);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <td>
                    <input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => toggleRowSelection(row.id)} onClick={(e) => e.stopPropagation()} />
                  </td>
                  {columns.map((c) => (
                    <td key={c.header}>{c.render(row)}</td>
                  ))}
                </tr>
              ) : (
                <tr
                  key={row.id}
                  data-row-index={idx}
                  className={kb.activeIndex === idx ? "active-list" : ""}
                  onClick={() => kb.setActiveIndex(idx)}
                  onDoubleClick={() => onSelect(row)}
                  style={{ cursor: "pointer" }}
                >
                  {columns.map((c) => (
                    <td key={c.header}>{c.render(row)}</td>
                  ))}
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
      <div className="actions">
        <span style={{ marginInlineEnd: "auto", alignSelf: "center", fontSize: 11, color: "var(--ink-soft)" }}>{multiSelect ? "↑↓ حرکت · Enter تیک‌زدن · Ctrl+Enter تایید · Esc بستن" : "↑↓ حرکت · Enter انتخاب · Esc بستن"}</span>
        <button type="button" className="btn" disabled={multiSelect ? selectedIds.size === 0 : selectedId === null} onClick={confirm}>
          {multiSelect && selectedIds.size > 0 ? `تایید (${selectedIds.size})` : "تایید"}
        </button>
        <button type="button" className="btn secondary" onClick={onClose}>انصراف</button>
      </div>
    </Modal>
  );
}

function PickerSortIcon({ dir }: { dir: "asc" | "desc" | null }) {
  if (!dir) {
    return (
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.35 }}>
        <path d="M7 9l5-5 5 5M7 15l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
      {dir === "asc" ? (
        <path d="M6 15l6-6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M20 20l-4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
