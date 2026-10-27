-- مدیریت تردد: جدول «محاسبات تردد» (یک رکورد برای هر کارمند در هر ماه؛ وجودش = قفل اطلاعات تردد آن ماه برای آن کارمند)
CREATE TABLE "AttendanceCalculation" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "calendarMonthId" INTEGER NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calculatedById" INTEGER,
    "days" INTEGER NOT NULL,
    "incompleteDays" INTEGER NOT NULL DEFAULT 0,
    "factorErrors" INTEGER NOT NULL DEFAULT 0,
    "hasErrors" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "AttendanceCalculation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AttendanceCalculation_employeeId_calendarMonthId_key" ON "AttendanceCalculation"("employeeId", "calendarMonthId");
CREATE INDEX "AttendanceCalculation_calendarMonthId_idx" ON "AttendanceCalculation"("calendarMonthId");
ALTER TABLE "AttendanceCalculation" ADD CONSTRAINT "AttendanceCalculation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceCalculation" ADD CONSTRAINT "AttendanceCalculation_calendarMonthId_fkey" FOREIGN KEY ("calendarMonthId") REFERENCES "WorkCalendarMonth"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
