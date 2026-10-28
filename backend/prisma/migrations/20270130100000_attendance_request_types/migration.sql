-- «نوع درخواست» (مرخصی/ماموریت × روزانه/ساعتی) برای مدیریت تردد.
-- درخواست‌ها و گزارش‌های ماموریت و درخواست‌های مرخصی تا الان در هیچ نصبی ثبت نشده‌اند؛ اگر چنین ردیفی وجود داشته باشد این migration عمداً متوقف می‌شود
-- (ستون‌های جدید الزامی‌اند و نوع درخواستی برای وصل‌کردن آن‌ها ساخته نمی‌شود).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "AttendanceMissionRequest") OR EXISTS (SELECT 1 FROM "AttendanceMissionReport") OR EXISTS (SELECT 1 FROM "AttendanceLeaveRequest") THEN
    RAISE EXCEPTION 'درخواست مرخصی/ماموریت یا گزارش ماموریت ثبت شده است؛ پیش از این migration باید آن‌ها حذف شوند (نوع درخواست باید دستی تعریف و به آن‌ها وصل شود)';
  END IF;
END $$;

-- نوع ماموریتِ پایه‌ی قبلی («خشکی») دیگر معنا ندارد: هیچ نوع ماموریتی نمی‌ماند تا کاربر نوع درخواست و نوع ماموریت را خودش تعریف کند
DELETE FROM "AttendanceMissionType";
DROP INDEX IF EXISTS "AttendanceMissionType_one_base_key";

-- CreateEnum
CREATE TYPE "AttendanceRequestNature" AS ENUM ('LEAVE', 'MISSION');

-- CreateEnum
CREATE TYPE "AttendanceRequestUnit" AS ENUM ('DAILY', 'HOURLY');

-- CreateTable
CREATE TABLE "AttendanceRequestType" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "nature" "AttendanceRequestNature" NOT NULL,
    "unit" "AttendanceRequestUnit" NOT NULL,
    "leaveTypeId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRequestType_pkey" PRIMARY KEY ("id"),
    -- ماهیت مرخصی ⇔ نوع مرخصی دارد؛ ماهیت ماموریت نوع مرخصی ندارد
    CONSTRAINT "AttendanceRequestType_nature_leave_check" CHECK (("nature" = 'LEAVE') = ("leaveTypeId" IS NOT NULL))
);

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRequestType_title_key" ON "AttendanceRequestType"("title");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRequestType_id_leaveTypeId_key" ON "AttendanceRequestType"("id", "leaveTypeId");

-- AlterTable
ALTER TABLE "AttendanceLeaveRequest" ADD COLUMN "requestTypeId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "AttendanceMissionRequest" DROP CONSTRAINT "AttendanceMissionRequest_typeId_fkey";
ALTER TABLE "AttendanceMissionRequest" DROP COLUMN "typeId",
ADD COLUMN "requestTypeId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "AttendanceMissionType" DROP COLUMN "isBase",
ADD COLUMN "requestTypeId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "AttendanceRequestType" ADD CONSTRAINT "AttendanceRequestType_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "AttendanceLeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (قید ترکیبی: نوع مرخصیِ درخواست همیشه همان نوع مرخصیِ نوع درخواست است)
ALTER TABLE "AttendanceLeaveRequest" ADD CONSTRAINT "AttendanceLeaveRequest_requestTypeId_leaveTypeId_fkey" FOREIGN KEY ("requestTypeId", "leaveTypeId") REFERENCES "AttendanceRequestType"("id", "leaveTypeId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceMissionType" ADD CONSTRAINT "AttendanceMissionType_requestTypeId_fkey" FOREIGN KEY ("requestTypeId") REFERENCES "AttendanceRequestType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceMissionRequest" ADD CONSTRAINT "AttendanceMissionRequest_requestTypeId_fkey" FOREIGN KEY ("requestTypeId") REFERENCES "AttendanceRequestType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
