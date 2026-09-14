-- AlterTable: accountingGroupId اختیاری می‌شود — دیگر برای SALES_RECEIVABLE/PURCHASE_PAYABLE استفاده نمی‌شود.
ALTER TABLE "GoodsServiceAccountingSetting" ALTER COLUMN "accountingGroupId" DROP NOT NULL;

-- یکتاسازی: قبل از این تغییر، SALES_RECEIVABLE/PURCHASE_PAYABLE به تفکیک گروه حسابداری هم تعریف
-- می‌شدند؛ در داده‌ی واقعی همه‌ی رکوردهای هم‌نوعِ فروش/خرید از قبل روی یک معین مشترک توافق داشتند (تایید
-- شده با بررسی مستقیم قبل از این migration) — پس نگه‌داشتن رکورد با کوچک‌ترین id به‌ازای هر
-- salesTypeId/purchaseTypeId و حذف بقیه، بدون از دست رفتن هیچ اطلاعاتی امن است.
DELETE FROM "GoodsServiceAccountingSetting" a
USING "GoodsServiceAccountingSetting" b
WHERE a."accountType" = 'SALES_RECEIVABLE' AND b."accountType" = 'SALES_RECEIVABLE'
  AND a."salesTypeId" = b."salesTypeId" AND a.id > b.id;

DELETE FROM "GoodsServiceAccountingSetting" a
USING "GoodsServiceAccountingSetting" b
WHERE a."accountType" = 'PURCHASE_PAYABLE' AND b."accountType" = 'PURCHASE_PAYABLE'
  AND a."purchaseTypeId" = b."purchaseTypeId" AND a.id > b.id;

-- رکوردهای باقی‌مانده‌ی SALES_RECEIVABLE/PURCHASE_PAYABLE دیگر به گروه حسابداری وابسته نیستند.
UPDATE "GoodsServiceAccountingSetting" SET "accountingGroupId" = NULL WHERE "accountType" IN ('SALES_RECEIVABLE', 'PURCHASE_PAYABLE');
