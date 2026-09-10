/**
 * ثبت‌نام مشترک کش snapshot گزارش‌های Review (مرور حسابها، مرور تعدادی/مبلغی انبار و هر گزارش Review
 * آینده‌ای) — طبق تصمیم صریح کاربر: قبلاً TabsContext.tsx مستقیماً clearAccountsReviewSnapshot را به
 * اسم صدا می‌زد (در openTab/closeTab/closeAllTabs)؛ وقتی warehouseReviewCache.ts بعداً اضافه شد، این
 * سه محل هرگز برای آن هم به‌روزرسانی نشدند — یعنی «تغییر دوره مالی جاری» (closeAllTabs، نگاه کنید به
 * UserSettingsModal.tsx) کش مرور حسابها را پاک می‌کرد ولی کش مرور تعدادی/مبلغی را دست‌نخورده می‌گذاشت،
 * پس بعد از تغییر دوره مالی، بازکردن دوباره‌ی آن گزارش همچنان فیلترهای (از جمله بازه‌ی تاریخ) دوره مالی
 * قبلی را از کش نشان می‌داد. با این ثبت‌نام، هر گزارش Review تازه‌ای که بعداً اضافه شود فقط باید خودش
 * را این‌جا register کند — TabsContext.tsx دیگر هرگز نیازی به دانستن اسم/مسیر هر گزارش ندارد.
 */
interface Registration {
  pathPrefix: string;
  clear: () => void;
}

const registrations: Registration[] = [];

export function registerReviewReportCache(pathPrefix: string, clear: () => void) {
  registrations.push({ pathPrefix, clear });
}

/** فقط کش گزارشی که مسیرش با pathPrefix ثبت‌شده مطابقت دارد را پاک می‌کند — برای «بازکردن یک تب واقعاً
 * تازه» یا «بستن یک تب» که فقط باید کش همان یک گزارش را دست‌نخورده نگذارد، نه بقیه‌ی گزارش‌های Review. */
export function clearReviewReportCacheForPath(path: string) {
  for (const r of registrations) {
    if (path.startsWith(r.pathPrefix)) r.clear();
  }
}

/** کش همه‌ی گزارش‌های Review را پاک می‌کند — برای رویدادهای سراسری که کل زمینه را عوض می‌کنند (مثلاً
 * تغییر دوره مالی جاری در تنظیمات کاربری، جایی که closeAllTabs صدا زده می‌شود). */
export function clearAllReviewReportCaches() {
  registrations.forEach((r) => r.clear());
}
