-- مدیریت تردد: «عامل مجوز» (منبع مقدار = مجوز) و مقدار مجوز هر کارمند (روزانه برای یک تاریخ / ماهانه از یک ماه به بعد)
CREATE TYPE "AttendanceFactorSource" AS ENUM ('COMPUTED', 'PERMIT');
ALTER TABLE "AttendanceFactor" ADD COLUMN "source" "AttendanceFactorSource" NOT NULL DEFAULT 'COMPUTED';

CREATE TABLE "AttendancePermitValue" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "factorId" INTEGER NOT NULL,
    "date" DATE,
    "calendarMonthId" INTEGER,
    "value" DECIMAL(14,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AttendancePermitValue_pkey" PRIMARY KEY ("id"),
    -- دقیقاً یکی از «تاریخ» (عامل روزانه) یا «ماه» (عامل ماهانه)
    CONSTRAINT "AttendancePermitValue_date_xor_month" CHECK (("date" IS NOT NULL) <> ("calendarMonthId" IS NOT NULL))
);
CREATE UNIQUE INDEX "AttendancePermitValue_employeeId_factorId_date_key" ON "AttendancePermitValue"("employeeId", "factorId", "date");
CREATE UNIQUE INDEX "AttendancePermitValue_employeeId_factorId_calendarMonthId_key" ON "AttendancePermitValue"("employeeId", "factorId", "calendarMonthId");
CREATE INDEX "AttendancePermitValue_factorId_idx" ON "AttendancePermitValue"("factorId");
ALTER TABLE "AttendancePermitValue" ADD CONSTRAINT "AttendancePermitValue_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendancePermitValue" ADD CONSTRAINT "AttendancePermitValue_factorId_fkey" FOREIGN KEY ("factorId") REFERENCES "AttendanceFactor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendancePermitValue" ADD CONSTRAINT "AttendancePermitValue_calendarMonthId_fkey" FOREIGN KEY ("calendarMonthId") REFERENCES "WorkCalendarMonth"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
