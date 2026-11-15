import { RecordPickerField } from "./RecordPicker";
import { toFaDigits } from "../lib/formatAmount";

// انتخابگر استاندارد انبار (دیالوگ جدول با فیلتر/مرتب‌سازی/کلید ↑↓ Enter) به‌جای <select> — همه‌ی فرم‌ها از همین استفاده می‌کنند.
// فقط انبارهای فعال + انبار فعلیِ خودِ سند (حتی اگر بعداً غیرفعال شده باشد، با برچسب «غیرفعال») قابل انتخاب‌اند؛ مثل lib/typeOptions.

export interface WarehouseRow { id: number; code?: number; title: string; isActive?: boolean }

export function WarehousePickerField<T extends WarehouseRow>({
  warehouses,
  value,
  onChange,
  disabled,
  onClear,
  title = "انتخاب انبار",
  placeholder,
}: {
  warehouses: T[];
  /** شناسه‌ی انبار انتخاب‌شده (رشته/عدد) یا "" */
  value: string | number | null | undefined;
  onChange: (id: string) => void;
  disabled?: boolean;
  /** اگر داده شود، دکمه‌ی پاک‌کردن نمایش داده می‌شود (فیلدهای اختیاری) */
  onClear?: () => void;
  title?: string;
  placeholder?: string;
}) {
  const cur = String(value ?? "");
  const rows = warehouses.filter((w) => w.isActive !== false || String(w.id) === cur);
  const current = warehouses.find((w) => String(w.id) === cur);
  const label = (w: T) => `${w.title}${w.isActive === false ? " (غیرفعال)" : ""}`;
  return (
    <RecordPickerField<T>
      title={title}
      disabled={disabled}
      placeholder={placeholder}
      displayValue={current ? label(current) : ""}
      rows={rows}
      columns={[
        ...(rows.some((w) => w.code != null)
          ? [{ header: "کد", render: (w: T) => (w.code != null ? toFaDigits(String(w.code)) : ""), filterValue: (w: T) => String(w.code ?? ""), width: "90px" }]
          : []),
        { header: "عنوان", render: label, filterValue: (w: T) => w.title },
      ]}
      onSelect={(w) => onChange(String(w.id))}
      onClear={onClear}
    />
  );
}
