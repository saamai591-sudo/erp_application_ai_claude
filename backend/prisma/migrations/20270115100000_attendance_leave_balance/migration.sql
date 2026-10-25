-- مدیریت تردد: مانده‌ی مرخصی (مانده‌ی دستی، قاعده‌ی استحقاق، اجازه‌ی مرخصی منفی)
-- «فقط ساعتی» حذف شد: نوع‌های ساعتیِ قبلی به «روزانه و ساعتی» تبدیل می‌شوند
UPDATE "AttendanceLeaveType" SET "unit" = 'BOTH' WHERE "unit" = 'HOUR';

CREATE TYPE "AttendanceEntitlementBasis" AS ENUM ('NONE', 'STANDARD', 'ACTUAL');
CREATE TYPE "AttendanceEntitlementTiming" AS ENUM ('START_OF_MONTH', 'END_OF_MONTH');

CREATE TABLE "AttendanceLeaveBalanceEntry" (
  "id" SERIAL PRIMARY KEY,
  "employeeId" INTEGER NOT NULL,
  "leaveTypeId" INTEGER NOT NULL,
  "date" DATE NOT NULL,
  "amount" DECIMAL(12,4) NOT NULL,
  "reason" TEXT NOT NULL,
  "createdById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttendanceLeaveBalanceEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AttendanceLeaveBalanceEntry_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "AttendanceLeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "AttendanceLeaveBalanceEntry_employeeId_leaveTypeId_date_idx" ON "AttendanceLeaveBalanceEntry"("employeeId", "leaveTypeId", "date");

CREATE TABLE "AttendanceLeaveEntitlement" (
  "id" SERIAL PRIMARY KEY,
  "leaveTypeId" INTEGER NOT NULL,
  "shiftId" INTEGER NOT NULL,
  "execMonthId" INTEGER NOT NULL,
  "amount" DECIMAL(12,4) NOT NULL,
  "basis" "AttendanceEntitlementBasis" NOT NULL DEFAULT 'NONE',
  "timing" "AttendanceEntitlementTiming" NOT NULL DEFAULT 'END_OF_MONTH',
  "createdById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttendanceLeaveEntitlement_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "AttendanceLeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AttendanceLeaveEntitlement_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "AttendanceShift"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AttendanceLeaveEntitlement_execMonthId_fkey" FOREIGN KEY ("execMonthId") REFERENCES "WorkCalendarMonth"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AttendanceLeaveEntitlement_leaveTypeId_shiftId_execMonthId_key" ON "AttendanceLeaveEntitlement"("leaveTypeId", "shiftId", "execMonthId");

CREATE TABLE "AttendanceLeaveNegativePolicy" (
  "id" SERIAL PRIMARY KEY,
  "leaveTypeId" INTEGER NOT NULL,
  "shiftId" INTEGER NOT NULL,
  "fromDate" DATE NOT NULL,
  "allowed" BOOLEAN NOT NULL,
  "createdById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttendanceLeaveNegativePolicy_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "AttendanceLeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AttendanceLeaveNegativePolicy_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "AttendanceShift"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AttendanceLeaveNegativePolicy_leaveTypeId_shiftId_fromDate_key" ON "AttendanceLeaveNegativePolicy"("leaveTypeId", "shiftId", "fromDate");
