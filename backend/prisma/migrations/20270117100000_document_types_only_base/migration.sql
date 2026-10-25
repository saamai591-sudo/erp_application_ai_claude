-- نوع سند: فقط انواع پایه‌ی سیستمی (عملیاتی، افتتاحیه، بستن حسابها، اختتامیه) و انواع تعریف‌شده‌ی کاربر می‌مانند.
-- اسناد حسابداری انواعِ سیستمیِ دیگر (انبار، فاکتورها، دریافت/پرداخت، چک، تنخواه، حقوق) به «عملیاتی» تبدیل و آن انواع حذف می‌شوند؛
-- از این پس این اسناد با نوع «عملیاتی» صادر می‌شوند (services/documentTypeService.ts). ستون موقتِ isHidden هم برداشته می‌شود.
-- نوع «عملیاتی» اگر هنوز نیست (دیتابیس تازه، قبل از seed) همین‌جا ساخته می‌شود تا seed همان را پیدا کند.
INSERT INTO "DocumentType" ("code", "title", "isSystem", "systemKey")
SELECT COALESCE(MAX("code"), 0) + 1, 'عملیاتی', true, 'OPERATIONAL' FROM "DocumentType"
WHERE NOT EXISTS (SELECT 1 FROM "DocumentType" WHERE "systemKey" = 'OPERATIONAL')
ON CONFLICT DO NOTHING;

UPDATE "JournalEntry"
SET "documentTypeId" = (SELECT "id" FROM "DocumentType" WHERE "systemKey" = 'OPERATIONAL')
WHERE EXISTS (SELECT 1 FROM "DocumentType" WHERE "systemKey" = 'OPERATIONAL')
  AND "documentTypeId" IN (
    SELECT "id" FROM "DocumentType"
    WHERE "isSystem" = true AND COALESCE("systemKey", '') NOT IN ('OPERATIONAL', 'OPENING', 'CLOSING_ACCOUNTS', 'CLOSING')
  );

DELETE FROM "DocumentType" d
WHERE d."isSystem" = true AND COALESCE(d."systemKey", '') NOT IN ('OPERATIONAL', 'OPENING', 'CLOSING_ACCOUNTS', 'CLOSING')
  AND EXISTS (SELECT 1 FROM "DocumentType" WHERE "systemKey" = 'OPERATIONAL')
  AND NOT EXISTS (SELECT 1 FROM "JournalEntry" j WHERE j."documentTypeId" = d."id");

ALTER TABLE "DocumentType" DROP COLUMN "isHidden";
