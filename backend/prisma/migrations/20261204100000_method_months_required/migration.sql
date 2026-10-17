-- «روش محاسبه عامل»: ماه صدور و ماه اجرا اجباری‌اند (ارجاع به ردیف تقویم کاری) و ستون effectiveDate حذف می‌شود؛
-- روش مؤثر هر ماه با join روی WorkCalendarMonth.startDate (ماه اجرا) پیدا می‌شود. یکتایی «یک روش برای هر عامل در هر ماه اجرا» روی ارجاع ماه اجراست.
-- روش‌هایی که ماهشان به ردیف تقویم وصل نبود (روش‌های قدیمیِ بدون تقویم، مثلاً پیش‌فرض‌های seed) حذف می‌شوند.
DELETE FROM "PayrollFactorMethod" WHERE "issueCalendarMonthId" IS NULL OR "execCalendarMonthId" IS NULL;
ALTER TABLE "PayrollFactorMethod" ALTER COLUMN "issueCalendarMonthId" SET NOT NULL;
ALTER TABLE "PayrollFactorMethod" ALTER COLUMN "execCalendarMonthId" SET NOT NULL;

DROP INDEX "PayrollFactorMethod_decreeComponentId_effectiveDate_key";
DROP INDEX "PayrollFactorMethod_payrollComponentId_effectiveDate_key";
CREATE UNIQUE INDEX "PayrollFactorMethod_decreeComponentId_execCalendarMonthId_key" ON "PayrollFactorMethod"("decreeComponentId", "execCalendarMonthId");
CREATE UNIQUE INDEX "PayrollFactorMethod_payrollComponentId_execCalendarMonthId_key" ON "PayrollFactorMethod"("payrollComponentId", "execCalendarMonthId");

ALTER TABLE "PayrollFactorMethod" DROP COLUMN "effectiveDate";
