// دقیقاً هم‌الگوی RefreshButton.tsx — دکمه‌ی مشترک «حذف همه فیلترها» که در Base پیاده شده تا هر گزارش
// Review (مرور حسابها، مرور موجودی انبار، و هر گزارش Review آینده) بدون پیاده‌سازی جداگانه از آن
// استفاده کند؛ نگاه کنید به ChainedTabsBar.tsx (onClearFilters) برای محل قرارگیری در نوار مشترک
// چاپ/اکسل/رفرش.
export function ClearFiltersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M3 5h13M3 12h7M3 19h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17 15l5 5M22 15l-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function ClearFiltersButton({ onClick, title = "حذف همه فیلترها" }: { onClick: () => void; title?: string }) {
  return (
    <button type="button" className="toolbar-icon-btn ar-clear-filters-btn" onClick={onClick} title={title}>
      <ClearFiltersIcon />
    </button>
  );
}
