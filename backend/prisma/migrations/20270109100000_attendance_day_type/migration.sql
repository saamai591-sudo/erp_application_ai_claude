-- مدیریت تردد: «روز استراحت» (تیک) → نوع روز (کاری / تعطیلی شیفت / تعطیلی رسمی)
CREATE TYPE "AttendanceDayType" AS ENUM ('WORK', 'SHIFT_OFF', 'OFFICIAL_HOLIDAY');
ALTER TABLE "AttendanceShiftDay" ADD COLUMN "dayType" "AttendanceDayType" NOT NULL DEFAULT 'WORK';
UPDATE "AttendanceShiftDay" SET "dayType" = 'SHIFT_OFF' WHERE "isWorkDay" = false;
ALTER TABLE "AttendanceShiftDay" DROP COLUMN "isWorkDay";
