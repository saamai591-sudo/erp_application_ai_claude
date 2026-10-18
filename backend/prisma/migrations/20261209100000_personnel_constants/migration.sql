-- مقدار ثابت پرسنلی (منابع انسانی / حقوقی): نوع‌های جدید پارامتر + مقدارهای اختصاصی کارمند

ALTER TYPE "PayrollParamKind" ADD VALUE 'PERSONNEL_HR';

ALTER TYPE "PayrollParamKind" ADD VALUE 'PERSONNEL_PAYROLL';

CREATE TABLE "PayrollEmployeeParameterValue" (
    "id" SERIAL NOT NULL,
    "parameterId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "execCalendarMonthId" INTEGER NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "value" DECIMAL(20,4) NOT NULL,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollEmployeeParameterValue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PayrollEmployeeParameterValue_employeeId_idx" ON "PayrollEmployeeParameterValue"("employeeId");

CREATE UNIQUE INDEX "PayrollEmployeeParameterValue_parameterId_employeeId_execCa_key" ON "PayrollEmployeeParameterValue"("parameterId", "employeeId", "execCalendarMonthId");

ALTER TABLE "PayrollEmployeeParameterValue" ADD CONSTRAINT "PayrollEmployeeParameterValue_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "PayrollParameter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollEmployeeParameterValue" ADD CONSTRAINT "PayrollEmployeeParameterValue_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PayrollEmployeeParameterValue" ADD CONSTRAINT "PayrollEmployeeParameterValue_execCalendarMonthId_fkey" FOREIGN KEY ("execCalendarMonthId") REFERENCES "WorkCalendarMonth"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollEmployeeParameterValue" ADD CONSTRAINT "PayrollEmployeeParameterValue_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
