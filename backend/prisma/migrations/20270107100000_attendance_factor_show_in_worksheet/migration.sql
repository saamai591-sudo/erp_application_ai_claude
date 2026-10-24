-- مدیریت تردد: «نمایش در گزارش کارکرد» برای عامل‌های روزانه
ALTER TABLE "AttendanceFactor" ADD COLUMN "showInWorksheet" BOOLEAN NOT NULL DEFAULT false;
