// صفحه‌ی خانه: بنر خوش‌آمدگویی با تاریخ امروز (طرح erp_dashboard_preview). عمداً کارت ماژول‌ها و هیچ داده‌ی نمایشی ندارد.
export default function Welcome() {
  const today = (() => {
    try {
      // «شنبه، ۱۸ مهر ۱۴۰۵» (ترتیب اجزا در قالب‌بندی پیش‌فرض مرورگر نامناسب است؛ از اجزا می‌سازیم)
      const p = Object.fromEntries(
        new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", year: "numeric", month: "long", day: "numeric" }).formatToParts(new Date()).map((x) => [x.type, x.value])
      );
      return `${p.weekday}، ${p.day} ${p.month} ${p.year}`;
    } catch {
      return "";
    }
  })();

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
          <p>از منوی سمت راست، ماژول مورد نظر را انتخاب کنید؛ روی آیکن پوشه‌ی هر فرم کلیک کنید تا فهرست آن باز شود، یا روی عنوان فرم کلیک کنید تا فرم «جدید» باز شود.</p>
          {today && <div className="dash-hero-date">{today}</div>}
        </div>
      </section>
    </div>
  );
}
