import { ReactNode } from "react";
import { Modal } from "./Modal";

export function AdvancedFilterDialog({
  title = "فیلترهای بیشتر",
  onApply,
  onClear,
  onClose,
  children,
}: {
  title?: string;
  onApply: () => void;
  onClear: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      {children}
      <div className="actions">
        <button
          type="button"
          className="btn"
          onClick={() => {
            onApply();
            onClose();
          }}
        >
          اعمال فیلتر
        </button>
        <button type="button" className="btn secondary" onClick={onClear}>
          پاک کردن
        </button>
      </div>
    </Modal>
  );
}

function FilterIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M4 5h16l-6 8v6l-4-2v-4L4 5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
function toFaDigits(value: string): string {
  return value.replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

export function AdvancedFilterButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button type="button" className="btn secondary ar-filter-btn" onClick={onClick}>
      <FilterIcon />
      فیلترهای بیشتر
      {count > 0 && <span className="badge">{toFaDigits(String(count))}</span>}
    </button>
  );
}
