-- حساب دریافت حقوق کارمند: تاریخ‌دار (از ماه) و به تفکیک نوع پرداخت حقوق؛ جایگزین ستون Employee.salaryBankAccountId
-- (داده‌ی موجودی نبود؛ مقدار قبلی منتقل نمی‌شود)

ALTER TABLE "Employee" DROP COLUMN "salaryBankAccountId";

CREATE TABLE "EmployeeSalaryAccount" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "paymentTypeId" INTEGER NOT NULL,
    "fromMonthId" INTEGER NOT NULL,
    "bankAccountId" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeSalaryAccount_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmployeeSalaryAccount_employeeId_idx" ON "EmployeeSalaryAccount"("employeeId");
CREATE UNIQUE INDEX "EmployeeSalaryAccount_employeeId_paymentTypeId_fromMonthId_key" ON "EmployeeSalaryAccount"("employeeId", "paymentTypeId", "fromMonthId");

ALTER TABLE "EmployeeSalaryAccount" ADD CONSTRAINT "EmployeeSalaryAccount_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeSalaryAccount" ADD CONSTRAINT "EmployeeSalaryAccount_paymentTypeId_fkey" FOREIGN KEY ("paymentTypeId") REFERENCES "PayrollPaymentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeSalaryAccount" ADD CONSTRAINT "EmployeeSalaryAccount_fromMonthId_fkey" FOREIGN KEY ("fromMonthId") REFERENCES "WorkCalendarMonth"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeSalaryAccount" ADD CONSTRAINT "EmployeeSalaryAccount_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "PartyBankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
