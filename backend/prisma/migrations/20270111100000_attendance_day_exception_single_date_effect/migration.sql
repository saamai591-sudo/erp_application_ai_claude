-- استثنای روز: فقط یک تاریخ (نه بازه) و «اثر» پنج‌حالته (شروع / پایان / شروع و پایان / تعطیلی شیفت / تعطیلی رسمی)
CREATE TYPE "AttendanceDayExceptionEffect" AS ENUM ('START', 'END', 'START_END', 'SHIFT_OFF', 'OFFICIAL_HOLIDAY');
ALTER TABLE "AttendanceDayException" ADD COLUMN "effect" "AttendanceDayExceptionEffect";
UPDATE "AttendanceDayException" SET "effect" = CASE
  WHEN "dayType" = 'OFFICIAL_HOLIDAY' THEN 'OFFICIAL_HOLIDAY'::"AttendanceDayExceptionEffect"
  WHEN "dayType" IS NOT NULL THEN 'SHIFT_OFF'::"AttendanceDayExceptionEffect"
  WHEN "newStartMinute" IS NOT NULL AND "newEndMinute" IS NOT NULL THEN 'START_END'::"AttendanceDayExceptionEffect"
  WHEN "newStartMinute" IS NOT NULL THEN 'START'::"AttendanceDayExceptionEffect"
  ELSE 'END'::"AttendanceDayExceptionEffect" END;
ALTER TABLE "AttendanceDayException" ALTER COLUMN "effect" SET NOT NULL;
ALTER TABLE "AttendanceDayException" DROP COLUMN "dayType";
-- تاریخ: اگر رکوردی بازه‌ی چندروزه داشته باشد به روز اولش تبدیل می‌شود (در زمان این تغییر رکوردی وجود نداشت)
ALTER TABLE "AttendanceDayException" RENAME COLUMN "fromDate" TO "date";
ALTER TABLE "AttendanceDayException" DROP COLUMN "toDate";
DROP INDEX IF EXISTS "AttendanceDayException_fromDate_toDate_idx";
CREATE INDEX "AttendanceDayException_date_idx" ON "AttendanceDayException"("date");
