-- زمان‌بندی تولید: «دوره‌ی گزارشگری شروع» ← «تاریخ اجرا» (برای هر ردیف آمار، تاریخ آمار با آخرین برگه‌ی ≤ آن وزن می‌گیرد)
ALTER TABLE "ProductionTimeSheet" ADD COLUMN "effectiveDate" DATE;
UPDATE "ProductionTimeSheet" s SET "effectiveDate" = p."fromDate" FROM "ReportingPeriod" p WHERE p."id" = s."fromReportingPeriodId";
ALTER TABLE "ProductionTimeSheet" ALTER COLUMN "effectiveDate" SET NOT NULL;
DROP INDEX "ProductionTimeSheet_costCenterId_fromReportingPeriodId_key";
ALTER TABLE "ProductionTimeSheet" DROP CONSTRAINT "ProductionTimeSheet_fromReportingPeriodId_fkey";
ALTER TABLE "ProductionTimeSheet" DROP COLUMN "fromReportingPeriodId";
CREATE UNIQUE INDEX "ProductionTimeSheet_costCenterId_effectiveDate_key" ON "ProductionTimeSheet"("costCenterId", "effectiveDate");
