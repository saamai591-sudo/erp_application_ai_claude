-- قاعده‌ی تفصیل برای رکوردهای «تعیین حسابهای معین» (دریافت/پرداخت) برداشته شد؛ تفصیل‌های دریافت و پرداخت را حسابدار خودش پر می‌کند.
-- (مقدار enum «FROM_BASE_DOCUMENT» می‌ماند: PostgreSQL حذف مقدار enum را پشتیبانی نمی‌کند و دیگر هیچ‌جا استفاده نمی‌شود.)
DELETE FROM "DetailRuleHeader" WHERE "treasurySettingId" IS NOT NULL;
-- قاعده‌ی کالا و خدمتی که منبع «از سند مبنا» (ویژه‌ی خزانه) داشته باشد کامل حذف می‌شود (ردیف‌هایش با cascade)
DELETE FROM "DetailRuleHeader" WHERE id IN (SELECT "headerId" FROM "DetailRuleRow" WHERE "slot1Source" = 'FROM_BASE_DOCUMENT' OR "slot2Source" = 'FROM_BASE_DOCUMENT' OR "slot3Source" = 'FROM_BASE_DOCUMENT');

ALTER TABLE "DetailRuleHeader" DROP CONSTRAINT IF EXISTS "DetailRuleHeader_treasurySettingId_fkey";
DROP INDEX IF EXISTS "DetailRuleHeader_treasurySettingId_effectiveDate_key";
ALTER TABLE "DetailRuleHeader" DROP COLUMN "treasurySettingId";
ALTER TABLE "DetailRuleHeader" ALTER COLUMN "settingId" SET NOT NULL;
