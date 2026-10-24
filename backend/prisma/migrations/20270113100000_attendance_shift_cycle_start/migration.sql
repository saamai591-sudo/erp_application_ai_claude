-- مدیریت تردد: تاریخ «روز ۱ چرخه» در تعریف شیفت (مرجع واحد تشخیص روز چرخه)
ALTER TABLE "AttendanceShift" ADD COLUMN "cycleStartDate" DATE;
-- شیفت هفتگی: یک شنبه‌ی ثابت (۲۰۰۰/۰۱/۰۱ میلادی شنبه بود) ⇒ همان نتیجه‌ی «هم‌تراز هفته» با فرمول واحد
UPDATE "AttendanceShift" SET "cycleStartDate" = DATE '2000-01-01' WHERE "cycleType" = 'WEEKLY';
