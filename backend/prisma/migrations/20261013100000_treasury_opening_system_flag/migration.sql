-- «افتتاحیه‌ی ساخته‌شده توسط سیستم» در سطح خودِ افتتاحیه (TreasuryOpening.isSystemGenerated). تا اینجا فقط ردیف‌ها/چک‌ها علامت داشتند.
ALTER TABLE "TreasuryOpening" ADD COLUMN "isSystemGenerated" BOOLEAN NOT NULL DEFAULT false;

-- داده‌ی موجود: افتتاحیه‌ای که «عملیات پایان دوره» ساخته سیستمی است — یعنی ردیف بانک/صندوق علامت‌دار، چک منتقل‌شده (parentChequeId) دارد،
-- یا برای دوره‌ی قبلِ آن «بستن» ثبت شده است (حتی اگر بستن ردیفی نساخته باشد). فقط همین یک ستون نوشته می‌شود.
UPDATE "TreasuryOpening" o
SET "isSystemGenerated" = true
WHERE EXISTS (SELECT 1 FROM "TreasuryOpeningBankAccount" b WHERE b."openingId" = o."id" AND b."isSystemGenerated")
   OR EXISTS (SELECT 1 FROM "TreasuryOpeningCashBox" c WHERE c."openingId" = o."id" AND c."isSystemGenerated")
   OR EXISTS (SELECT 1 FROM "ChequeItem" ch WHERE ch."fiscalPeriodId" = o."fiscalPeriodId" AND ch."isOpening" AND ch."parentChequeId" IS NOT NULL)
   OR EXISTS (
     SELECT 1 FROM "TreasuryYearClose" y
     WHERE y."fiscalPeriodId" = (
       SELECT p."id" FROM "FiscalPeriod" cur
       JOIN "FiscalPeriod" p ON p."toDate" < cur."fromDate"
       WHERE cur."id" = o."fiscalPeriodId"
       ORDER BY p."toDate" DESC LIMIT 1
     )
   );
