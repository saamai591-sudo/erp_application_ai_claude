-- افتتاحیه‌ی تنخواه از سطح «تنخواه» به سطح «تنخواه‌دار» می‌رود: هر ردیف TreasuryOpeningPettyCash به یک تنخواه‌دار (PettyCashCustodian) وابسته می‌شود
-- (تنخواه از روی تنخواه‌دار معلوم است و pettyCashId برای سادگی کوئری نگه داشته می‌شود). یکتایی از (افتتاحیه، تنخواه) به (افتتاحیه، تنخواه‌دار) تغییر می‌کند.

ALTER TABLE "TreasuryOpeningPettyCash" ADD COLUMN "custodianId" INTEGER;

-- ردیف‌های موجود (سطح تنخواه): به تنخواه‌دارِ اول (کمترین شناسه) همان تنخواه نسبت داده می‌شوند. مانده‌ی کل تنخواه تغییر نمی‌کند (مانده‌ی تنخواه بین
-- تنخواه‌دارهایش مشترک است)؛ در صورت نیاز، ردیف دستی را در فرم افتتاحیه به تنخواه‌دار درست منتقل کنید و ردیف سیستمی را با «برگشت» بستن تنخواه‌ها بازسازی کنید.
UPDATE "TreasuryOpeningPettyCash" o
SET "custodianId" = (
  SELECT c."id" FROM "PettyCashCustodian" c WHERE c."pettyCashId" = o."pettyCashId" ORDER BY c."id" ASC LIMIT 1
);

-- تنخواهِ بدون هیچ تنخواه‌دار (نه گردشی داشته نه می‌تواند داشته باشد): ردیف افتتاحیه‌اش نمی‌تواند به تنخواه‌دار وصل شود و حذف می‌شود
DO $$
DECLARE n INTEGER;
BEGIN
  SELECT COUNT(*) INTO n FROM "TreasuryOpeningPettyCash" WHERE "custodianId" IS NULL;
  IF n > 0 THEN
    RAISE NOTICE 'TreasuryOpeningPettyCash: % ردیف بدون تنخواه‌دار حذف شد', n;
    DELETE FROM "TreasuryOpeningPettyCash" WHERE "custodianId" IS NULL;
  END IF;
END $$;

ALTER TABLE "TreasuryOpeningPettyCash" ALTER COLUMN "custodianId" SET NOT NULL;

ALTER TABLE "TreasuryOpeningPettyCash"
  ADD CONSTRAINT "TreasuryOpeningPettyCash_custodianId_fkey" FOREIGN KEY ("custodianId") REFERENCES "PettyCashCustodian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX IF EXISTS "TreasuryOpeningPettyCash_openingId_pettyCashId_key";
CREATE UNIQUE INDEX "TreasuryOpeningPettyCash_openingId_custodianId_key" ON "TreasuryOpeningPettyCash"("openingId", "custodianId");
