import { RecordPickerField, PickerColumn } from "./RecordPicker";

function ChipRemoveIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/** انتخاب چندگانه با استفاده از همان دیالوگ RecordPickerField (تک‌تک اضافه می‌شوند)؛ موارد انتخاب‌شده به‌صورت تراشه (chip) با دکمه‌ی حذف نمایش داده می‌شوند */
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
  const selectedIds = new Set(selected.map((s) => s.id));
  const availableRows = rows.filter((r) => !selectedIds.has(r.id));

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <RecordPickerField
        title={title}
        displayValue=""
        placeholder={placeholder || "افزودن..."}
        rows={availableRows}
        columns={columns}
        onOpen={onOpen}
        onSelect={(row) => onChange([...selected, row])}
      />
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
