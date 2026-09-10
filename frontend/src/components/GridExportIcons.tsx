// آیکن‌های «خروجی اکسل»/«چاپ» — دقیقاً همان SVGهای DataTable.tsx/SelectableBalanceTable.tsx (که هرکدام
// نسخه‌ی محلی خودشان را دارند)، اینجا به‌صورت مشترک برای گزارش‌های Review (مرور حسابها/انبار/فروش) که
// این دو اکشن را برای تب «گردش» به‌جای ردیف مستقل، داخل نوار تب‌ها (کنار بقیه‌ی اکشن‌های گرید) نشان می‌دهند.
export function ExcelExportIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8.5 13.5 12 18M12 13.5l-3.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function PrintIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M6 9V3h12v6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <rect x="4" y="9" width="16" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6 14h12v7H6z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
