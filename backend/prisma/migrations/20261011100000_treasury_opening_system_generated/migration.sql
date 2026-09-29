-- AlterTable
ALTER TABLE "TreasuryOpeningBankAccount" ADD COLUMN     "isSystemGenerated" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TreasuryOpeningCashBox" ADD COLUMN     "isSystemGenerated" BOOLEAN NOT NULL DEFAULT false;


-- ردیف‌های افتتاحیه‌ای که پیش از این تغییر توسط «بستن سال» ساخته شده‌اند: هر ردیف حساب بانکی/صندوقِ افتتاحیه‌ی دوره‌ای که بخش متناظرش
-- در دوره‌ی قبل بسته شده است، «ساخته‌شده توسط بستن سال» علامت می‌خورد (همان دوره‌ی قبلی که routes/treasuryOpenings.ts هم هنگام حذف
-- افتتاحیه پیدا می‌کند: آخرین دوره‌ای که تاریخ پایانش قبل از شروع این دوره است).
UPDATE "TreasuryOpeningBankAccount" l SET "isSystemGenerated" = true
FROM "TreasuryOpening" o
JOIN "FiscalPeriod" np ON np.id = o."fiscalPeriodId"
JOIN "FiscalPeriod" pp ON pp."toDate" = (SELECT MAX(x."toDate") FROM "FiscalPeriod" x WHERE x."toDate" < np."fromDate")
JOIN "TreasuryYearClose" c ON c."fiscalPeriodId" = pp.id AND c.section = 'BANK_ACCOUNTS'
WHERE l."openingId" = o.id;

UPDATE "TreasuryOpeningCashBox" l SET "isSystemGenerated" = true
FROM "TreasuryOpening" o
JOIN "FiscalPeriod" np ON np.id = o."fiscalPeriodId"
JOIN "FiscalPeriod" pp ON pp."toDate" = (SELECT MAX(x."toDate") FROM "FiscalPeriod" x WHERE x."toDate" < np."fromDate")
JOIN "TreasuryYearClose" c ON c."fiscalPeriodId" = pp.id AND c.section = 'CASH_BOXES'
WHERE l."openingId" = o.id;
