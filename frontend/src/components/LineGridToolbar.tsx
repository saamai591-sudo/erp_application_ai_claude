import { ReactNode, useState } from "react";
import { exportGridToCsv, type ExportColumn } from "../lib/gridExport";

// نوار ابزار پایه‌ی گریدهای ردیفی اسناد (طبق تصمیم صریح کاربر: «در base انجام بده، در هر فرم می‌گویم
// کدام لازم نیست») — افزودن/حذف/جابه‌جایی بالا-پایین/فیلتر/خروجی اکسل به‌صورت پیش‌فرض فعال، «بارگذاری»
// پیش‌فرض غیرفعال (هر فرم که لازم دارد، مثل خلاصه‌ی تنخواه، صریحاً روشن می‌کند). هر فرم جدید فقط کافی
// است این کامپوننت را با callbackهای خودش صدا بزند؛ چیدمان/آیکن‌ها یک‌بار همین‌جا پیاده‌سازی شده‌اند.

export type LineGridActionKey = "add" | "delete" | "moveUp" | "moveDown" | "filter" | "excel" | "load";

const DEFAULT_SHOW: Record<LineGridActionKey, boolean> = {
  add: true,
  delete: true,
  moveUp: true,
  moveDown: true,
  filter: true,
  excel: true,
  load: false,
};

export interface LineGridToolbarProps<T> {
  title: string;
  show?: Partial<Record<LineGridActionKey, boolean>>;
  disabled?: boolean;

  onAdd?: () => void;

  onDelete?: () => void;
  canDelete?: boolean;

  onMoveUp?: () => void;
  canMoveUp?: boolean;
  onMoveDown?: () => void;
  canMoveDown?: boolean;

  filterValue?: string;
  onFilterChange?: (value: string) => void;

  exportColumns?: ExportColumn<T>[];
  exportRows?: T[];
  exportFileName?: string;

  loadLabel?: string;
  onLoad?: () => void;
  loadDisabled?: boolean;

  /** آیکن‌های اضافیِ مخصوصِ همین فرم (مثل «تغییر نوع پرداخت» در خلاصه تنخواه) — طبق تصمیم صریح کاربر
   * («base فقط اکشن‌های مشترک را بدهد، هر فرم فقط استثنا/اضافه‌ی خودش را») در همین نوار ابزار مشترک،
   * کنار آیکن‌های پایه، رندر می‌شود؛ نه یک نوار ابزار جدا در خودِ صفحه */
  children?: ReactNode;
}

export function LineGridToolbar<T>({
  title,
  show,
  disabled,
  onAdd,
  onDelete,
  canDelete = true,
  onMoveUp,
  canMoveUp = true,
  onMoveDown,
  canMoveDown = true,
  filterValue,
  onFilterChange,
  exportColumns,
  exportRows,
  exportFileName,
  loadLabel = "بارگذاری",
  onLoad,
  loadDisabled,
  children,
}: LineGridToolbarProps<T>) {
  const effective = { ...DEFAULT_SHOW, ...show };
  const [filterOpen, setFilterOpen] = useState(!!filterValue);

  return (
    <div className="je-lines-toolbar line-grid-toolbar">
      <span className="je-lines-title">{title}</span>
      <div className="line-grid-toolbar-icons">
        {effective.add && onAdd && (
          <button type="button" className="toolbar-icon-btn primary" onClick={onAdd} disabled={disabled} title="ردیف جدید">
            <PlusIcon />
          </button>
        )}
        {effective.load && onLoad && (
          <button type="button" className="toolbar-icon-btn" onClick={onLoad} disabled={disabled || loadDisabled} title={loadLabel}>
            <LoadIcon />
          </button>
        )}
        {effective.delete && onDelete && (
          <button type="button" className="toolbar-icon-btn danger" onClick={onDelete} disabled={disabled || !canDelete} title="حذف ردیف">
            <TrashIcon />
          </button>
        )}
        {effective.moveUp && onMoveUp && (
          <button type="button" className="toolbar-icon-btn" onClick={onMoveUp} disabled={disabled || !canMoveUp} title="جابه‌جایی به بالا">
            <ChevronUpIcon />
          </button>
        )}
        {effective.moveDown && onMoveDown && (
          <button type="button" className="toolbar-icon-btn" onClick={onMoveDown} disabled={disabled || !canMoveDown} title="جابه‌جایی به پایین">
            <ChevronDownIcon />
          </button>
        )}
        {effective.filter && onFilterChange && (
          <button
            type="button"
            className={`toolbar-icon-btn${filterValue ? " active" : ""}`}
            onClick={() => setFilterOpen((v) => !v)}
            disabled={disabled}
            title="فیلتر ردیف‌ها"
          >
            <FilterIcon active={!!filterValue} />
          </button>
        )}
        {effective.excel && exportColumns && exportRows && (
          <button
            type="button"
            className="toolbar-icon-btn"
            onClick={() => exportGridToCsv(exportColumns, exportRows, exportFileName || title)}
            title="خروجی اکسل"
          >
            <ExcelExportIcon />
          </button>
        )}
        {children}
      </div>
      {effective.filter && filterOpen && onFilterChange && (
        <input
          className="line-grid-filter-input"
          value={filterValue || ""}
          onChange={(e) => onFilterChange(e.target.value)}
          placeholder="جستجو در ردیف‌ها..."
          disabled={disabled}
        />
      )}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-1 13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 7h12ZM10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M6 15l6-6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FilterIcon({ active }: { active: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"}>
      <path d="M4 5h16l-6 8v6l-4-2v-4L4 5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
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

function LoadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M12 4v10m0 0 4-4m-4 4-4-4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
