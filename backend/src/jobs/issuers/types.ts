// «صادرکننده‌ی سند» = آداپتور یک فرم برای کار زمان‌بندی‌شده‌ی «صدور سند حسابداری» (jobs/journalEntries.ts).
// هر آداپتور فقط می‌گوید (۱) کدام رکوردهای فرم منتظر سند هستند، (۲) چطور پیش‌بینی/تایید حسابداری/صدور انجام می‌شود — خودِ صدور همان تابعی است
// که دکمه‌ی دستی فرم صدا می‌زند، پس سند حاصل با صدور دستی یکی است. افزودن فرم جدید = یک آداپتور در jobs/issuers/index.ts.

export interface IssuerCandidate {
  /** شناسه‌ای که issue/approve/preview با آن صدا زده می‌شود (معمولاً شناسه‌ی سند؛ برای استهلاک/بیمه شناسه‌ی دوره‌ی گزارشگری) */
  id: number;
  number: number;
  date: Date;
  fiscalPeriodId: number;
  /** شرح خوانا برای تاریخچه‌ی اجرا */
  label: string;
  /** هنوز «تایید حسابداری» نشده (فقط برای فرم‌هایی که این مرحله را دارند) */
  needsApprove: boolean;
}

export interface IssuerRange {
  from: Date | null;
  to: Date | null;
}

export interface IssueOutcome {
  /** شماره‌ی سند در دوره‌ی مالی (اگر تابع صدور برنگرداند null) */
  number: number | null;
  referenceNumber: number | null;
}

export interface JournalIssuer {
  /** کلید یکتا و ثابت — در تنظیمات کار ذخیره می‌شود؛ بعد از ایجاد عوض نشود */
  key: string;
  title: string;
  /** عنوان گروه (ماژول) برای دسته‌بندی در فرم تنظیمات */
  group: string;
  /** کلید فرم در Registry دسترسی‌ها (برای ساخت کلیدهای issueJournalEntry/accountingApprove) */
  form: string;
  /** فرم مرحله‌ی جداگانه‌ی «تایید حسابداری» دارد */
  accountingApprove: boolean;
  /** رکوردهای بدون سند در بازه، به ترتیب تاریخ ← شماره (حداکثر take مورد) */
  find(range: IssuerRange, take: number): Promise<IssuerCandidate[]>;
  /** پیش‌بینی فقط‌خواندنیِ «تایید حسابداری + صدور» برای سندِ هنوز تایید‌نشده؛ فهرست موانع (خالی = موفق می‌شود) */
  preview?(c: IssuerCandidate): Promise<string[]>;
  approve?(c: IssuerCandidate, userId: number | null): Promise<void>;
  /** بازگرداندن تاییدِ حسابداریِ همین اجرا وقتی صدور بعد از آن شکست خورد */
  unapprove?(c: IssuerCandidate): Promise<void>;
  issue(c: IssuerCandidate): Promise<IssueOutcome>;
}
