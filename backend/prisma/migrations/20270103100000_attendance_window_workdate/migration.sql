-- مدیریت تردد: پنجره‌ی حضور هر روز شیفت (شروع؛ پایان = شروع روز بعد) و اختصاص دستی تردد به روز کاری
ALTER TABLE "AttendanceShiftDay" ADD COLUMN "windowStartMinute" INTEGER NOT NULL DEFAULT 240;
ALTER TABLE "AttendancePunch" ADD COLUMN "workDate" DATE;
