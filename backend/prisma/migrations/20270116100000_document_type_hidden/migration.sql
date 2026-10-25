-- نوع سندهای سیستمیِ «سندهای خودکار» (انبار، فاکتورها، دریافت/پرداخت، چک، تنخواه، حقوق) از فهرست «انواع سند» مخفی می‌شوند؛
-- خودِ رکوردها می‌مانند چون صدور سند آن فرم‌ها با systemKey کار می‌کند و اسناد صادرشده به آن‌ها ارجاع دارند.
-- در فهرست فقط انواع پایه‌ی سیستمی (عملیاتی، افتتاحیه، بستن حسابها، اختتامیه) و انواع تعریف‌شده‌ی کاربر دیده می‌شود.
ALTER TABLE "DocumentType" ADD COLUMN "isHidden" BOOLEAN NOT NULL DEFAULT false;
UPDATE "DocumentType" SET "isHidden" = true
WHERE "isSystem" = true AND COALESCE("systemKey", '') NOT IN ('OPERATIONAL', 'OPENING', 'CLOSING_ACCOUNTS', 'CLOSING');
