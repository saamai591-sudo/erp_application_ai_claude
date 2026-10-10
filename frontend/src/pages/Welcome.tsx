import { useMemo } from "react";
import { filterModulesByAccess } from "../navConfig";
import { usePermissions } from "../lib/usePermissions";
import { MODULE_ICON, NavIcon } from "../components/Layout";

// صفحه‌ی خانه (داشبورد): بنر خوش‌آمدگویی + کارت‌های «دسترسی سریع به ماژول‌ها» (طرح erp_dashboard_preview). کارت‌ها همان ماژول‌هایی هستند که
// کاربر به فرمشان دسترسی دارد (همان فیلتر منوی کناری) و با کلیک، ماژول در منوی کناری باز می‌شود. عمداً هیچ داده‌ی نمایشیِ ساختگی
// (سندهای اخیر، اعلان‌ها…) ندارد.

/** توضیح کوتاه هر ماژول زیر عنوانش (بر اساس عنوان ماژول در navConfig) */
const MODULE_HINT: Record<string, string> = {
  "تنظیمات": "ارز، دوره مالی و الگوها",
  "اطلاعات پایه": "اشخاص، بانک و صندوق",
  "حسابداری": "ثبت و گزارش اسناد",
  "کالا و خدمت": "کالا، گروه‌ها و قیمت‌گذاری",
  "مدیریت موجودی و انبار": "رسید، حواله و موجودی",
  "زنجیره تامین": "خرید و تامین‌کننده",
  "فروش": "پیش‌فاکتور و فاکتور",
  "مدیریت خزانه": "دریافت و پرداخت",
  "امور مالیاتی": "حافظه و ارسال به مودیان",
};

function openModuleInSidebar(title: string) {
  window.dispatchEvent(new CustomEvent("erp:open-module", { detail: title }));
}

export default function Welcome() {
  const { hasFormView, loading } = usePermissions();
  const modules = useMemo(() => (loading ? [] : filterModulesByAccess(hasFormView)), [loading, hasFormView]);
  const today = useMemo(() => {
    try {
      // «شنبه، ۱۸ مهر ۱۴۰۵» (ترتیب اجزا در قالب‌بندی پیش‌فرض مرورگر نامناسب است؛ از اجزا می‌سازیم)
      const p = Object.fromEntries(
        new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", year: "numeric", month: "long", day: "numeric" }).formatToParts(new Date()).map((x) => [x.type, x.value])
      );
      return `${p.weekday}، ${p.day} ${p.month} ${p.year}`;
    } catch {
      return "";
    }
  }, []);

  return (
    <div className="dash">
      <section className="dash-hero">
        <div className="dash-hero-art" aria-hidden="true">
          <span className="dash-hero-leaf" />
          <span className="dash-hero-chart">
            <i /><i /><i /><i />
          </span>
          <span className="dash-hero-pie">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12A9 9 0 1 1 12 3v9h9Z" />
              <path d="M15 3.5A9 9 0 0 1 20.5 9H15V3.5Z" />
            </svg>
          </span>
        </div>
        <div className="dash-hero-text">
          <h1>به نرم‌افزار حسابداری خوش آمدید</h1>
          <p>از طریق دسترسی‌های سریع زیر به ماژول‌های مختلف سیستم دسترسی پیدا کنید.</p>
          {today && <div className="dash-hero-date">{today}</div>}
        </div>
      </section>

      <section className="dash-section">
        <div className="dash-section-head">
          <h2>دسترسی سریع به ماژول‌ها</h2>
          <span className="dash-hint">برای ورود، یک ماژول را انتخاب کنید</span>
        </div>
        {modules.length === 0 ? (
          <div className="dash-empty">{loading ? "در حال بارگذاری…" : "ماژولی برای شما فعال نیست؛ با مدیر سیستم تماس بگیرید."}</div>
        ) : (
          <div className="dash-grid">
            {modules.map((mod) => {
              const icon = MODULE_ICON[mod.title] || "layers";
              return (
                <button key={mod.title} type="button" className={`dash-card mod-ic-${icon}`} onClick={() => openModuleInSidebar(mod.title)}>
                  <span className="dash-card-icon">
                    <NavIcon name={icon} />
                  </span>
                  <strong>{mod.title}</strong>
                  {MODULE_HINT[mod.title] && <small>{MODULE_HINT[mod.title]}</small>}
                  <span className="dash-card-go" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 6l-6 6 6 6" />
                    </svg>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
