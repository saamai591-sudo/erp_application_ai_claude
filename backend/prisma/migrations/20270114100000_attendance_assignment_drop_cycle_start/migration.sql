-- مدیریت تردد: تاریخ «روز ۱ چرخه» فقط در تعریف شیفت است؛ از انتساب حذف می‌شود
-- (کمکِ داده‌ی توسعه: شیفت چرخشیِ بدون تاریخ، تاریخ را از اولین انتسابِ دارای تاریخ می‌گیرد)
UPDATE "AttendanceShift" s SET "cycleStartDate" = (
  SELECT a."cycleStartDate" FROM "AttendanceShiftAssignment" a WHERE a."shiftId" = s."id" AND a."cycleStartDate" IS NOT NULL ORDER BY a."fromDate" LIMIT 1
) WHERE s."cycleType" = 'ROTATING' AND s."cycleStartDate" IS NULL;
ALTER TABLE "AttendanceShiftAssignment" DROP COLUMN "cycleStartDate";
