# کارهای زمان‌بندی‌شده — راهنمای افزودن کار جدید

زیرساخت: `registry.ts` (فهرست کارها)، `runner.ts` (اجرا + قفل + تاریخچه)، `scheduler.ts` (حلقه‌ی هر‌دقیقه)، `schedule.ts` (محاسبه‌ی زمان اجرا به وقت تهران)،
`params.ts` (پارامترها و بازه‌های نسبی)، `routes/scheduledJobs.ts` (API)، `frontend/src/pages/ScheduledJobs.tsx` (صفحه‌ی مدیریت — تنظیمات › عملیات).
کار نمونه‌ی مرجع: `taxInvoiceReadiness.ts` (فقط گزارش).

## افزودن یک کار

۱) یک فایل در همین پوشه بسازید (مثلاً `paymentJournalEntries.ts`) و با `defineJob({...})` تعریف کنید:

```ts
import { defineJob } from "./types";

export default defineJob({
  key: "payment-journal-entries",          // یکتا و ثابت؛ بعد از ایجاد عوض نشود
  title: "صدور سند اعلامیه‌های پرداخت",
  description: "…",
  supportsLive: true,                       // false = فقط خاموش/آزمایشی
  defaultSchedule: { type: "DAILY", timeOfDay: "20:00" },   // INTERVAL | DAILY | WEEKLY (weekdays: ۰=شنبه … ۶=جمعه)
  params: [
    // بازه‌ی نسبی: «از N روز قبل تا M روز قبل» (هر سر اختیاری). فرم تنظیمات خودکار ساخته می‌شود.
    { key: "paymentDate", type: "dateWindow", label: "تاریخ اعلامیه", default: { fromDaysAgo: null, toDaysAgo: 7 }, requiredForLive: true },
    { key: "minDate", type: "date", label: "حداقل تاریخ", requiredForLive: true },
  ],
  async run(ctx) {
    const { from, to } = ctx.params.paymentDate;       // YYYY-MM-DD یا null؛ هر اجرا نسبت به همان روز محاسبه می‌شود
    // … موارد را پیدا کنید؛ برای هر مورد:
    //   dryRun  ⇒ هیچ تغییری ندهید: ctx.item({ ref, label, result: "WOULD_DO", message })
    //   واقعی   ⇒ انجام دهید و ثبت کنید: result: "DONE" | "SKIPPED" (با دلیل) | "FAILED" (با پیام خطا)
    ctx.summary("…");                                   // اختیاری؛ وگرنه از شمارش موارد ساخته می‌شود
  },
});
```

۲) آن را در آرایه‌ی `JOBS` در `registry.ts` اضافه کنید. همین — ردیف تنظیمات (خاموش) خودکار ساخته می‌شود و کار در صفحه‌ی «کارهای زمان‌بندی‌شده» دیده می‌شود.

## قواعد

- **آزمایشی هرگز نمی‌نویسد.** `ctx.dryRun === true` ⇒ فقط `WOULD_DO` ثبت کنید. حالت «واقعی» فقط وقتی مجاز است که `supportsLive` باشد.
- **تکرارناپذیر (idempotent) باشد.** اجراها ممکن است هم‌پوشانی داشته باشند (بازه‌ی تاریخ بزرگ‌تر از فاصله‌ی اجراها عمداً تشویق می‌شود تا شکاف نماند)؛ مواردی که قبلاً انجام شده‌اند باید از شرط خودِ کار حذف شوند (مثلاً «سند ندارد»)، نه از پارامتر کاربر.
- **شکست یک مورد کل کار را نمی‌خواباند:** `ctx.item({ result: "FAILED", message })` و ادامه. فقط خطای غیرقابل ادامه را `throw` کنید (کل اجرا FAILED می‌شود).
- **دوره‌ی مالی را صریح تعیین کنید.** کار خارج از درخواست کاربر اجرا می‌شود؛ پیش‌فرض «آخرین دوره‌ی مالی» است. برای کوئری‌های سرتاسری `ctx.withoutFiscalScope(fn)`، برای ثبت‌ها در یک دوره‌ی مشخص `ctx.withFiscalPeriod(id, fn)`.
- **کاربر اجراکننده:** `ctx.userId` (در تنظیمات کار انتخاب می‌شود؛ برای حالت واقعی الزامی است) — برای فیلدهایی مثل تاییدکننده.
- **پارامتر لازم برای حالت واقعی:** `requiredForLive: true` (برای `dateWindow` یعنی سرِ قدیمی‌ترِ بازه حتماً مشخص باشد) — از اجرای بی‌حدِ پایین روی اسناد قدیمی جلوگیری می‌کند.
- **ریز موارد** تا ۲۰۰۰ مورد در تاریخچه ذخیره می‌شود (شمارش کل همیشه دقیق است).
- کلید `SCHEDULER_ENABLED=true` فقط زمان‌بند خودکار را روشن می‌کند؛ اجرای دستی از صفحه همیشه ممکن است.
