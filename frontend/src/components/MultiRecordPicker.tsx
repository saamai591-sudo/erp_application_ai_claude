import { useMemo, useState } from "react";
import { Modal } from "./Modal";
import { PickerColumn } from "./RecordPicker";
import { SortIcon } from "./DataTable";

function ChipRemoveIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function AddIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MultiPickerDialog<T extends { id: number | string }>({
  title,
  rows,
  columns,
  initialChecked,
  onConfirm,
  onClose,
}: {
  title: string;
  rows: T[];
  columns: PickerColumn<T>[];
  initialChecked: Set<T["id"]>;
  onConfirm: (checked: Set<T["id"]>) => void;
  onClose: () => void;
}) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ header: string; dir: "asc" | "desc" } | null>(
    columns[0] ? { header: columns[0].header, dir: "asc" } : null
  );
  const [checked, setChecked] = useState<Set<T["id"]>>(new Set(initialChecked));

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

  function toggleRow(id: T["id"]) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const allVisibleChecked = filteredRows.length > 0 && filteredRows.every((r) => checked.has(r.id));
  function toggleAllVisible() {
    setChecked((prev) => {
      const next = new Set(prev);
      filteredRows.forEach((r) => (allVisibleChecked ? next.delete(r.id) : next.add(r.id)));
      return next;
    });
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="picker-table-wrap">
        <table className="picker-table">
          <thead>
            <tr>
              <th style={{ width: 30 }}>
                <input type="checkbox" checked={allVisibleChecked} onChange={toggleAllVisible} />
              </th>
              {columns.map((c) => {
                const dir = sort?.header === c.header ? sort.dir : null;
                return (
                  <th key={c.header} style={{ width: c.width }}>
                    <span onClick={() => toggleSort(c.header)} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 }} title="مرتب‌سازی">
                      {c.header}
                      <SortIcon dir={dir} />
                    </span>
                  </th>
                );
              })}
            </tr>
            <tr>
              <th></th>
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
                <td colSpan={columns.length + 1} className="empty-state" style={{ border: "none" }}>موردی یافت نشد</td>
              </tr>
            )}
            {filteredRows.map((row) => (
              <tr key={row.id} className={checked.has(row.id) ? "active-list" : ""} onClick={() => toggleRow(row.id)} style={{ cursor: "pointer" }}>
                <td onClick={(e) => e.stopPropagation()} style={{ textAlign: "center" }}>
                  <input type="checkbox" checked={checked.has(row.id)} onChange={() => toggleRow(row.id)} />
                </td>
                {columns.map((c) => (
                  <td key={c.header}>{c.render(row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="actions">
        <button type="button" className="btn" onClick={() => { onConfirm(checked); onClose(); }}>
          افزودن ({checked.size})
        </button>
        <button type="button" className="btn secondary" onClick={onClose}>انصراف</button>
      </div>
    </Modal>
  );
}

/** انتخاب چندگانه با یک دیالوگ چک‌باکسی (به‌جای باز/بسته کردن مکرر برای هر مورد) — موارد انتخاب‌شده در دیالوگ از قبل تیک‌خورده‌اند
 * تا هم افزودن و هم حذف در همان یک بار باز شدن دیالوگ ممکن باشد؛ علاوه‌بر آن، هر مورد به‌صورت تراشه (chip) با دکمه‌ی حذف سریع هم نمایش داده می‌شود */
export function MultiRecordPickerField<T extends { id: number | string }>({
  title,
  rows,
  columns,
  selected,
  onChange,
  getLabel,
  placeholder,
  onOpen,
}: {
  title: string;
  rows: T[];
  columns: PickerColumn<T>[];
  selected: T[];
  onChange: (rows: T[]) => void;
  getLabel: (row: T) => string;
  placeholder?: string;
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <button
        type="button"
        className="picker-field"
        onClick={() => {
          onOpen?.();
          setOpen(true);
        }}
      >
        <span>{selected.length ? `${selected.length} مورد انتخاب‌شده` : <span className="picker-placeholder">{placeholder || "افزودن..."}</span>}</span>
        <AddIcon />
      </button>
      {open && (
        <MultiPickerDialog
          title={title}
          rows={rows}
          columns={columns}
          initialChecked={new Set(selected.map((s) => s.id))}
          onConfirm={(checked) => onChange(rows.filter((r) => checked.has(r.id)))}
          onClose={() => setOpen(false)}
        />
      )}
      {selected.length > 0 && (
        <div className="chip-list">
          {selected.map((s) => (
            <span key={s.id} className="chip">
              {getLabel(s)}
              <button type="button" onClick={() => onChange(selected.filter((x) => x.id !== s.id))}>
                <ChipRemoveIcon />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
