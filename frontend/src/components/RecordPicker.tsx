import { useMemo, useState } from "react";
import { Modal } from "./Modal";

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
  onSelect: (row: T) => void;
  onOpen?: () => void;
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
            onOpen?.();
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
          onSelect={(row) => {
            onSelect(row);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function RecordPickerDialog<T extends { id: number | string }>({
  title,
  rows,
  columns,
  onSelect,
  onClose,
}: {
  title: string;
  rows: T[];
  columns: PickerColumn<T>[];
  onSelect: (row: T) => void;
  onClose: () => void;
}) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [sort, setSort] = useState<{ header: string; dir: "asc" | "desc" } | null>(
    columns[0] ? { header: columns[0].header, dir: "asc" } : null
  );

  const filteredRows = useMemo(() => {
    const result = rows.filter((row) =>
      columns.every((col) => {
        const f = (filters[col.header] || "").trim().toLowerCase();
        if (!f) return true;
        return col.filterValue(row).toLowerCase().includes(f);
      })
    );
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
  }, [rows, columns, filters, sort]);

  function toggleSort(header: string) {
    setSort((prev) => {
      if (!prev || prev.header !== header) return { header, dir: "asc" };
      if (prev.dir === "asc") return { header, dir: "desc" };
      return null;
    });
  }

  function confirm() {
    const row = filteredRows.find((r) => r.id === selectedId);
    if (row) onSelect(row);
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="picker-table-wrap">
        <table className="picker-table">
          <thead>
            <tr>
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
              {columns.map((c) => (
                <th key={c.header} style={{ width: c.width }}>
                  <input
                    className="picker-filter-input"
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
                <td colSpan={columns.length} className="empty-state" style={{ border: "none" }}>موردی یافت نشد</td>
              </tr>
            )}
            {filteredRows.map((row) => (
              <tr
                key={row.id}
                className={selectedId === row.id ? "active-list" : ""}
                onClick={() => setSelectedId(row.id)}
                onDoubleClick={() => onSelect(row)}
                style={{ cursor: "pointer" }}
              >
                {columns.map((c) => (
                  <td key={c.header}>{c.render(row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="actions">
        <button type="button" className="btn" disabled={selectedId === null} onClick={confirm}>تایید</button>
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
