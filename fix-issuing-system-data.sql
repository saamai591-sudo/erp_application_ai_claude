-- تبدیل ایمن مقادیر فعلی (فارسی) به مقادیر جدید enum (انگلیسی) پیش از migrate
UPDATE "JournalEntry" SET "issuingSystem" = 'ACCOUNTING' WHERE "issuingSystem" = 'حسابداری';
UPDATE "JournalEntry" SET "issuingSystem" = 'ACCOUNTING_EXCEL_IMPORT' WHERE "issuingSystem" = 'حسابداری (ورود از اکسل)';
UPDATE "JournalEntry" SET "issuingSystem" = 'ACCOUNT_CLOSING' WHERE "issuingSystem" = 'بستن حسابها';
UPDATE "JournalEntry" SET "issuingSystem" = 'OPENING_CLOSING' WHERE "issuingSystem" = 'افتتاحیه و اختتامیه';
-- احتیاطاً: هر مقدار دیگری (پیش‌بینی‌نشده) هم به «حسابداری» تبدیل شود تا migrate شکست نخورد
UPDATE "JournalEntry" SET "issuingSystem" = 'ACCOUNTING'
  WHERE "issuingSystem" NOT IN ('ACCOUNTING','ACCOUNTING_EXCEL_IMPORT','ACCOUNT_CLOSING','OPENING_CLOSING');
