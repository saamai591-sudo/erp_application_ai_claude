import { api } from "./api";
import { getSavedFiscalPeriodId } from "./userSettings";
import { formatJalaliDate } from "./formatDate";

export interface FiscalPeriodRange {
  id: number;
  title: string;
  fromDate: string;
  toDate: string;
}

/**
 * دوره مالی «انتخاب‌شده» (تنظیمات کاربری، app.fiscalPeriodId) یا در نبود انتخاب، آخرین دوره مالی
 * تعریف‌شده — همان الگوی resolveFiscalPeriod در JournalEntries.tsx / useCurrentFiscalPeriodId در
 * ReportingPeriods.tsx، فقط این‌جا از یک لیست periods از پیش‌خوانده‌شده کار می‌کند (نه خودش fetch
 * می‌کند) تا هر فرم بتواند آن را در همان Promise.all اولیه‌ی خودش (همراه انبار/کالا/طرف‌حساب و...)
 * بخواند، بدون افکت جداگانه و بدون ریسک race بین این افکت و افکت init فرم.
 */
export function resolveSelectedFiscalPeriod(periods: FiscalPeriodRange[]): FiscalPeriodRange | null {
  const savedId = getSavedFiscalPeriodId();
  const bySaved = savedId ? periods.find((p) => String(p.id) === savedId) : null;
  if (bySaved) return bySaved;
  const fallback = [...periods].sort((a, b) => (a.toDate < b.toDate ? 1 : -1))[0];
  return fallback || null;
}

export function fetchSelectedFiscalPeriod(): Promise<FiscalPeriodRange | null> {
  return api.get("/fiscal-periods").then((periods: FiscalPeriodRange[]) => resolveSelectedFiscalPeriod(periods));
}

/**
 * بازه‌ی پیش‌فرض «از تاریخ»/«تا تاریخ» گزارش‌های Review (مرور حسابها، مرور تعدادی/مبلغی انبار و هر
 * گزارش Review آینده‌ای) — تنها محل این محاسبه؛ قبلاً هر گزارش نسخه‌ی محلی خودش را از این تابع داشت که
 * باعث شد یکی (مرور تعدادی/مبلغی) به‌خاطر یک race در بارگذاری تنظیمات کاربر (نگاه کنید به
 * Layout.tsx's preferencesLoading gate) گاهی دوره مالی اشتباه پیش‌فرض بگیرد و دیگری (مرور حسابها) نه —
 * صرفاً به این خاطر که یکی زودتر از resolve شدن تنظیمات مانت می‌شد. حالا که آن race در ریشه (Layout)
 * بسته شده، همه‌ی گزارش‌های Review باید از همین یک تابع استفاده کنند تا رفتارشان هرگز دوباره واگرا نشود.
 */
export function resolveReviewDateRange(periods: FiscalPeriodRange[]): { fromDate: string; toDate: string } {
  const current = resolveSelectedFiscalPeriod(periods);
  return current ? { fromDate: current.fromDate.slice(0, 10), toDate: current.toDate.slice(0, 10) } : { fromDate: "", toDate: "" };
}

/**
 * قانون پیش‌فرض تاریخ سند (طبق تصمیم کاربر): اگر تاریخ امروز (فقط تاریخ، نه ساعت) در بازه‌ی دوره مالی
 * انتخاب‌شده باشد، همان روز به‌عنوان پیش‌فرض تاریخ سند برگردانده می‌شود؛ در غیر این صورت (یا وقتی هیچ
 * دوره مالی‌ای یافت نشد) خالی می‌ماند تا کاربر خودش وارد کند.
 */
export function defaultDocumentDate(period: FiscalPeriodRange | null): string {
  if (!period) return "";
  const today = new Date().toISOString().slice(0, 10);
  const from = period.fromDate.slice(0, 10);
  const to = period.toDate.slice(0, 10);
  return today >= from && today <= to ? today : "";
}

/**
 * تاریخ واردشده توسط کاربر باید در بازه‌ی همین دوره مالی «انتخاب‌شده» باشد؛ در غیر این صورت پیام خطای
 * قابل‌نمایش برمی‌گرداند (و در غیر این صورت null). فیلد خالی/دوره مالی نامشخص اینجا خطا محسوب نمی‌شود —
 * آن کنترل («تاریخ الزامی است») خودِ هر فرم مثل قبل جداگانه انجام می‌دهد.
 */
export function validateDocumentDate(date: string, period: FiscalPeriodRange | null): string | null {
  if (!date || !period) return null;
  const from = period.fromDate.slice(0, 10);
  const to = period.toDate.slice(0, 10);
  if (date < from || date > to) {
    return `تاریخ سند باید در بازه‌ی دوره مالی «${period.title}» (${formatJalaliDate(from)} تا ${formatJalaliDate(to)}) باشد`;
  }
  return null;
}
