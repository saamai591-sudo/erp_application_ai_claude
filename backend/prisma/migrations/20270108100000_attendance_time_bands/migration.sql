-- مدیریت تردد: بازه‌های زمانی (مثلاً شبکاری) با نسخه‌های تاریخ‌دار؛ متغیر روز «حضور در بازه» از آن‌ها ساخته می‌شود
CREATE TABLE "AttendanceTimeBand" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AttendanceTimeBand_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AttendanceTimeBand_key_key" ON "AttendanceTimeBand"("key");
CREATE UNIQUE INDEX "AttendanceTimeBand_title_key" ON "AttendanceTimeBand"("title");

CREATE TABLE "AttendanceTimeBandVersion" (
    "id" SERIAL NOT NULL,
    "bandId" INTEGER NOT NULL,
    "execCalendarMonthId" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AttendanceTimeBandVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AttendanceTimeBandVersion_bandId_execCalendarMonthId_key" ON "AttendanceTimeBandVersion"("bandId", "execCalendarMonthId");
ALTER TABLE "AttendanceTimeBandVersion" ADD CONSTRAINT "AttendanceTimeBandVersion_bandId_fkey" FOREIGN KEY ("bandId") REFERENCES "AttendanceTimeBand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceTimeBandVersion" ADD CONSTRAINT "AttendanceTimeBandVersion_execCalendarMonthId_fkey" FOREIGN KEY ("execCalendarMonthId") REFERENCES "WorkCalendarMonth"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
