-- مدیریت تردد: استثنای روز (اصلاح ساعت شروع/پایان یا تعطیلی برای یک تاریخ)
CREATE TABLE "AttendanceDayException" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "allShifts" BOOLEAN NOT NULL DEFAULT false,
    "newStartMinute" INTEGER,
    "newEndMinute" INTEGER,
    "dayType" "AttendanceDayType",
    "description" TEXT,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AttendanceDayException_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AttendanceDayException_fromDate_toDate_idx" ON "AttendanceDayException"("fromDate", "toDate");

CREATE TABLE "AttendanceDayExceptionShift" (
    "id" SERIAL NOT NULL,
    "exceptionId" INTEGER NOT NULL,
    "shiftId" INTEGER NOT NULL,
    CONSTRAINT "AttendanceDayExceptionShift_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AttendanceDayExceptionShift_exceptionId_shiftId_key" ON "AttendanceDayExceptionShift"("exceptionId", "shiftId");
ALTER TABLE "AttendanceDayExceptionShift" ADD CONSTRAINT "AttendanceDayExceptionShift_exceptionId_fkey" FOREIGN KEY ("exceptionId") REFERENCES "AttendanceDayException"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceDayExceptionShift" ADD CONSTRAINT "AttendanceDayExceptionShift_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "AttendanceShift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
