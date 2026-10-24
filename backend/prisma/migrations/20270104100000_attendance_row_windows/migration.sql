-- مدیریت تردد: پنجره‌ی حضور برای هر ردیف شیفت (هر بازه‌ی کاری؛ روز استراحت = یک ردیف) و اختصاص دستیِ تردد به «روز کاری + ردیف»
ALTER TABLE "AttendanceShiftSegment" ADD COLUMN "windowStartMinute" INTEGER NOT NULL DEFAULT 0;
UPDATE "AttendanceShiftSegment" s SET "windowStartMinute" = d."windowStartMinute" FROM "AttendanceShiftDay" d WHERE d."id" = s."dayId" AND s."seq" = 1;
UPDATE "AttendanceShiftSegment" SET "windowStartMinute" = "startMinute" - 240 WHERE "seq" > 1;
ALTER TABLE "AttendancePunch" ADD COLUMN "workRowNo" INTEGER;
UPDATE "AttendancePunch" SET "workRowNo" = 1 WHERE "workDate" IS NOT NULL;
