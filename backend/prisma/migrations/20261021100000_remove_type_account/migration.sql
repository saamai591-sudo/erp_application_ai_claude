-- معین حسابداریِ «نوع دریافت» و «نوع پرداخت» از خودِ نوع حذف می‌شود؛ جای آن «تعیین حسابهای معین» (خزانه‌داری) است.
-- ابتدا معینِ فعلیِ هر نوع (فقط «بدون مبنا» داشت) به همان فرم منتقل می‌شود تا صدور سند اسناد موجود بدون تغییر کار کند؛
-- اگر برای آن نوع قبلاً در «تعیین حسابهای معین» رکوردی ثبت شده باشد، همان نگه داشته می‌شود (ON CONFLICT DO NOTHING).
INSERT INTO "TreasuryAccountSetting" ("accountType", "receiptTypeId", "accountId")
SELECT 'RECEIPT_SUBJECT', "id", "accountId" FROM "ReceiptType" WHERE "accountId" IS NOT NULL
ON CONFLICT ("accountType", "receiptTypeId") DO NOTHING;

INSERT INTO "TreasuryAccountSetting" ("accountType", "paymentTypeId", "accountId")
SELECT 'PAYMENT_SUBJECT', "id", "accountId" FROM "PaymentType" WHERE "accountId" IS NOT NULL
ON CONFLICT ("accountType", "paymentTypeId") DO NOTHING;

ALTER TABLE "ReceiptType" DROP COLUMN "accountId";
ALTER TABLE "PaymentType" DROP COLUMN "accountId";
