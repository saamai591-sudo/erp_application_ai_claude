-- مدیریت تردد: فرم «روش محاسبه» — روش‌ها از فرم عامل بیرون می‌آیند و سه هدف دارند:
--   عامل روزانه (تاریخ شروع اثر)، عامل ماهانه (ماه اجرا) و عامل حقوق با روش «ورود از تردد» (ماه اجرا).
ALTER TABLE "AttendanceFactorMethod" ALTER COLUMN "factorId" DROP NOT NULL;
ALTER TABLE "AttendanceFactorMethod" ALTER COLUMN "execCalendarMonthId" DROP NOT NULL;
ALTER TABLE "AttendanceFactorMethod" ADD COLUMN "payrollComponentId" INTEGER;
ALTER TABLE "AttendanceFactorMethod" ADD COLUMN "effectiveDate" DATE;

-- روش‌های عامل روزانه تا اینجا «ماه‌اجرا» داشتند؛ از ابتدای بازه‌ی تردد همان ماه اثر می‌گیرند (رفتار محاسبه‌ی همان ماه تغییر نمی‌کند)
UPDATE "AttendanceFactorMethod" m
SET "effectiveDate" = COALESCE(c."trafficStartDate", c."startDate"), "execCalendarMonthId" = NULL
FROM "AttendanceFactor" f, "WorkCalendarMonth" c
WHERE m."factorId" = f."id" AND f."level" = 'DAY' AND c."id" = m."execCalendarMonthId";

ALTER TABLE "AttendanceFactorMethod" ADD CONSTRAINT "AttendanceFactorMethod_target_xor" CHECK (("factorId" IS NOT NULL) <> ("payrollComponentId" IS NOT NULL));
ALTER TABLE "AttendanceFactorMethod" ADD CONSTRAINT "AttendanceFactorMethod_when_xor" CHECK (("execCalendarMonthId" IS NOT NULL) <> ("effectiveDate" IS NOT NULL));
-- عامل حقوق همیشه ماه اجرا دارد
ALTER TABLE "AttendanceFactorMethod" ADD CONSTRAINT "AttendanceFactorMethod_payroll_month" CHECK ("payrollComponentId" IS NULL OR "execCalendarMonthId" IS NOT NULL);

CREATE UNIQUE INDEX "AttendanceFactorMethod_factorId_effectiveDate_key" ON "AttendanceFactorMethod"("factorId", "effectiveDate");
CREATE UNIQUE INDEX "AttendanceFactorMethod_payrollComponentId_execCalendarMonthId_key" ON "AttendanceFactorMethod"("payrollComponentId", "execCalendarMonthId");
ALTER TABLE "AttendanceFactorMethod" ADD CONSTRAINT "AttendanceFactorMethod_payrollComponentId_fkey" FOREIGN KEY ("payrollComponentId") REFERENCES "PayrollComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
