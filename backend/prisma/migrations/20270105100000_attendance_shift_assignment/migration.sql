-- مدیریت تردد: انتساب شیفت به کارمند (از تاریخ شروع؛ شیفت چرخشی با نقطه‌ی شروع چرخه)
CREATE TABLE "AttendanceShiftAssignment" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "shiftId" INTEGER NOT NULL,
    "fromDate" DATE NOT NULL,
    "cycleStartDate" DATE,
    "note" TEXT,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AttendanceShiftAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AttendanceShiftAssignment_employeeId_fromDate_key" ON "AttendanceShiftAssignment"("employeeId", "fromDate");
CREATE INDEX "AttendanceShiftAssignment_shiftId_idx" ON "AttendanceShiftAssignment"("shiftId");
ALTER TABLE "AttendanceShiftAssignment" ADD CONSTRAINT "AttendanceShiftAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceShiftAssignment" ADD CONSTRAINT "AttendanceShiftAssignment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "AttendanceShift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
