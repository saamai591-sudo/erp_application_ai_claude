import type { ScheduleSpec } from "./schedule";

// تعریف یک «کار زمان‌بندی‌شده». برای افزودن کار جدید: یک فایل در backend/src/jobs با defineJob({...}) و یک خط در jobs/index.ts.
// فرم تنظیمات پارامترها در صفحه‌ی «کارهای زمان‌بندی‌شده» خودکار از روی `params` ساخته می‌شود؛ پس هیچ کد فرانت‌اندی لازم نیست.

/** مقدار پارامتر «بازه‌ی نسبی تاریخ»: [امروز − fromDaysAgo ، امروز − toDaysAgo] (هر دو سر شامل). null = بدون محدودیت آن سر */
export interface DateWindowValue {
  /** سرِ قدیمی‌تر بازه: N روز قبل از امروز (باید ≥ toDaysAgo باشد) */
  fromDaysAgo: number | null;
  /** سرِ جدیدتر بازه: M روز قبل از امروز (۰ = امروز) */
  toDaysAgo: number | null;
}

interface ParamBase {
  key: string;
  label: string;
  help?: string;
  /** برای حالت «واقعی» حتماً باید مقدار داشته باشد (برای dateWindow یعنی سرِ قدیمی‌ترِ بازه تعیین شده باشد) */
  requiredForLive?: boolean;
}

export type ParamDef =
  | (ParamBase & { type: "dateWindow"; default?: DateWindowValue })
  | (ParamBase & { type: "date"; default?: string | null })
  | (ParamBase & { type: "number"; integer?: boolean; min?: number; max?: number; default?: number | null })
  | (ParamBase & { type: "boolean"; default?: boolean })
  | (ParamBase & { type: "select"; options: { value: string; label: string }[]; default?: string | null });

export type JobItemResult = "DONE" | "WOULD_DO" | "SKIPPED" | "FAILED";

export interface JobItem {
  /** شناسه‌ی قابل‌خواندن مورد (مثلاً «فاکتور فروش ۱۲۳») */
  ref: string;
  label?: string;
  result: JobItemResult;
  message?: string;
}

export interface JobContext {
  jobKey: string;
  /** آزمایشی: هیچ تغییری نباید روی داده‌ها داده شود؛ فقط گزارش «چه می‌کرد» (result = WOULD_DO) */
  dryRun: boolean;
  trigger: "SCHEDULE" | "MANUAL";
  /** کاربر اجراکننده (runAsUserId تنظیمات کار)؛ برای ثبت تایید/صدورها به نام او */
  userId: number | null;
  now: Date;
  /** امروز به وقت تهران: YYYY-MM-DD */
  today: string;
  /** پارامترها بعد از محاسبه: dateWindow → {from, to} (YYYY-MM-DD یا null)، date → رشته یا null، بقیه همان مقدار */
  params: Record<string, any>;
  /** ثبت نتیجه‌ی یک مورد در تاریخچه‌ی اجرا */
  item(i: JobItem): void;
  /** خلاصه‌ی دلخواه اجرا (اگر نگویید از شمارش موارد ساخته می‌شود) */
  summary(text: string): void;
  /** اجرای fn با «دوره مالی» مشخص (کار خارج از درخواست کاربر است؛ دوره‌ی «جاری» معنی ندارد و باید صریحاً تعیین شود) */
  withFiscalPeriod<T>(fiscalPeriodId: number, fn: () => Promise<T>): Promise<T>;
  /** اجرای fn بدون محدودسازی خودکار به یک دوره‌ی مالی (کوئری‌هایی که عمداً همه‌ی دوره‌ها را می‌بینند) */
  withoutFiscalScope<T>(fn: () => Promise<T>): Promise<T>;
}

export interface JobDefinition {
  /** کلید یکتا و ثابت (kebab-case) — در دیتابیس به همین کلید ذخیره می‌شود؛ بعد از ایجاد عوض نشود */
  key: string;
  title: string;
  description: string;
  params: ParamDef[];
  /** آیا حالت «واقعی» (با تغییر داده) دارد؟ false ⇒ فقط آزمایشی/خاموش */
  supportsLive: boolean;
  defaultSchedule: ScheduleSpec;
  /**
   * دسترسی‌هایی (کلید Action فرم‌ها، مثل مسیرهای can(...)) که «کاربر اجراکننده» برای انجام عملیات این کار باید داشته باشد؛ بر اساس پارامترهای ذخیره‌شده
   * (مثلاً تایید حسابداری فقط وقتی لازم است که پارامترش روشن باشد). در حالت واقعی نبودِ هر کدام اجرا و ذخیره‌ی تنظیمات را رد می‌کند،
   * در آزمایشی فقط در تاریخچه گزارش می‌شود.
   */
  requiredActions?(params: Record<string, any>): string[];
  /** اجرای کار. در حالت dryRun نباید چیزی نوشته شود. خطای پرتاب‌شده کل اجرا را FAILED می‌کند؛ شکست یک مورد را با item({result:"FAILED"}) ثبت کنید. */
  run(ctx: JobContext): Promise<void>;
}

export function defineJob(def: JobDefinition): JobDefinition {
  return def;
}
