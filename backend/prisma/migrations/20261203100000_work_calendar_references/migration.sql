-- ارجاع دیتابیسی فرم‌های حقوق به ردیف «تقویم کاری»:
--  • روش محاسبه عامل: سال/ماه صدور و اجرا حذف و فقط ارجاع (FK) به ردیف تقویم می‌ماند؛
--  • مقدار پارامتر مبنا: ارجاع ماه اجرا به ردیف تقویم؛
--  • فیش و ورودی ماهانه: FK روی (سال، ماه) به ردیف تقویم.
-- همه Restrict: ماه/تقویمِ استفاده‌شده حذف نمی‌شود. داده‌ی قدیمیِ بدون تقویم: ارجاع NULL (روش/مقدار) یا معاف (فیش/ورودی؛ FK از نوع NOT VALID).

-- ۱) سال در ردیف ماه (برای ارجاع طبیعی سال+ماه)
ALTER TABLE "WorkCalendarMonth" ADD COLUMN "year" INTEGER;
UPDATE "WorkCalendarMonth" m SET "year" = c."year" FROM "WorkCalendar" c WHERE c."id" = m."calendarId";
ALTER TABLE "WorkCalendarMonth" ALTER COLUMN "year" SET NOT NULL;
CREATE UNIQUE INDEX "WorkCalendarMonth_year_month_key" ON "WorkCalendarMonth"("year", "month");

-- ۲) روش محاسبه عامل
ALTER TABLE "PayrollFactorMethod" ADD COLUMN "issueCalendarMonthId" INTEGER, ADD COLUMN "execCalendarMonthId" INTEGER;
UPDATE "PayrollFactorMethod" m SET "issueCalendarMonthId" = cm."id" FROM "WorkCalendarMonth" cm WHERE cm."year" = m."issueYear" AND cm."month" = m."issueMonth";
UPDATE "PayrollFactorMethod" m SET "execCalendarMonthId" = cm."id" FROM "WorkCalendarMonth" cm WHERE cm."year" = m."execYear" AND cm."month" = m."execMonth";
ALTER TABLE "PayrollFactorMethod" DROP COLUMN "issueYear", DROP COLUMN "issueMonth", DROP COLUMN "execYear", DROP COLUMN "execMonth";
CREATE INDEX "PayrollFactorMethod_issueCalendarMonthId_idx" ON "PayrollFactorMethod"("issueCalendarMonthId");
CREATE INDEX "PayrollFactorMethod_execCalendarMonthId_idx" ON "PayrollFactorMethod"("execCalendarMonthId");
ALTER TABLE "PayrollFactorMethod" ADD CONSTRAINT "PayrollFactorMethod_issueCalendarMonthId_fkey" FOREIGN KEY ("issueCalendarMonthId") REFERENCES "WorkCalendarMonth"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollFactorMethod" ADD CONSTRAINT "PayrollFactorMethod_execCalendarMonthId_fkey" FOREIGN KEY ("execCalendarMonthId") REFERENCES "WorkCalendarMonth"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ۳) مقدار پارامتر مبنا (effectiveDate = اول همان ماه)
ALTER TABLE "PayrollParameterValue" ADD COLUMN "execCalendarMonthId" INTEGER;
UPDATE "PayrollParameterValue" v SET "execCalendarMonthId" = cm."id" FROM "WorkCalendarMonth" cm WHERE cm."startDate" = v."effectiveDate";
CREATE INDEX "PayrollParameterValue_execCalendarMonthId_idx" ON "PayrollParameterValue"("execCalendarMonthId");
ALTER TABLE "PayrollParameterValue" ADD CONSTRAINT "PayrollParameterValue_execCalendarMonthId_fkey" FOREIGN KEY ("execCalendarMonthId") REFERENCES "WorkCalendarMonth"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ۴) فیش و ورودی ماهانه: ارجاع طبیعی (سال، ماه)؛ NOT VALID = ردیف‌های قدیمیِ بدون تقویم بررسی نمی‌شوند ولی هر ردیف جدید باید ماهِ تقویم داشته باشد
ALTER TABLE "PayrollSlip" ADD CONSTRAINT "PayrollSlip_year_month_fkey" FOREIGN KEY ("year", "month") REFERENCES "WorkCalendarMonth"("year", "month") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "PayrollFactorInput" ADD CONSTRAINT "PayrollFactorInput_year_month_fkey" FOREIGN KEY ("year", "month") REFERENCES "WorkCalendarMonth"("year", "month") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
