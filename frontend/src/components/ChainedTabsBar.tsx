import { ReactNode } from "react";
import { ClearFiltersButton } from "./ClearFiltersButton";

export interface ChainedTab {
  key: string;
  label: string;
  count?: number;
}

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
function toFaDigits(value: string): string {
  return value.replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

export function ChainedTabsBar({
  tabs,
  activeIndex,
  onChange,
  actions,
  onClearFilters,
}: {
  tabs: ChainedTab[];
  activeIndex: number;
  onChange: (index: number) => void;
  /** طبق تصمیم صریح کاربر: کلیدهای راهنما/ریفرش (که قبلاً هرکدام یک ردیف/نوار جدای بالای صفحه بودند)
   * این‌جا، کنار پرینت/خروجی اکسلِ خودکارِ همین تب (پورتال‌شده — نگاه کنید به «مقصد خودکار» پایین‌تر)،
   * در همین یک ردیف نمایش داده می‌شوند. */
  actions?: ReactNode;
  /** دکمه‌ی مشترک «حذف همه فیلترها» — طبق تصمیم صریح کاربر، همیشه اولین آیکن از سمت چپ در همین نوار
   * (کنار چاپ/اکسل/رفرش) است، صرف‌نظر از این‌که چاپ/اکسل (پورتال‌شده از SelectableBalanceTable) در چه
   * لحظه‌ای DOM را پر می‌کنند — این جایگذاری با CSS `order` (نگاه کنید به `.ar-clear-filters-btn`
   * در styles.css)، نه ترتیب DOM، تضمین می‌شود؛ پس مستقل از تب فعال (حتی تب «گردش» که چاپ/اکسل ندارد)
   * همیشه در همین جایگاه ثابت می‌ماند. */
  onClearFilters?: () => void;
}) {
  return (
    <div className="ar-tabs-row">
      <div className="ar-tabs">
        {tabs.map((tab, idx) => (
          <button key={tab.key} type="button" className={`ar-tab ${activeIndex === idx ? "active" : ""}`} onClick={() => onChange(idx)}>
            {tab.label}
            {tab.count ? <span className="badge">{toFaDigits(String(tab.count))}</span> : null}
          </button>
        ))}
      </div>
      {/* مقصد خودکار پرینت/خروجی اکسل تب جاری (SelectableBalanceTable) — نگاه کنید به
          lib/useAutoPortalTarget.ts — کنار actions صریح بالا نمایش داده می‌شود؛ اگر هیچ‌کدام وجود
          نداشته باشد (نه actions، نه پورتال، نه onClearFilters)، طبق ".ar-tabs-actions:empty" خالی و
          بدون فضای اضافه می‌ماند */}
      <div className="ar-tabs-actions">
        {actions}
        {onClearFilters && <ClearFiltersButton onClick={onClearFilters} />}
      </div>
    </div>
  );
}
