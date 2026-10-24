-- مدیریت تردد: جهت (ورود/خروج) ذخیره نمی‌شود؛ بعداً با جفت‌سازی ترددهای روز تشخیص داده می‌شود
ALTER TABLE "AttendancePunch" DROP COLUMN "direction";
ALTER TABLE "AttendanceCorrectionLine" DROP COLUMN "direction";
DROP TYPE "AttendancePunchDirection";
