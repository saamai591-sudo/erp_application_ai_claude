-- حقوق و دستمزد › وام: نوع وام، پرداخت وام، مانده‌ی ماهانه، اصلاح مانده/قسط و تعلیق

CREATE TYPE "LoanRemainderMode" AS ENUM ('WITH_FIRST', 'WITH_LAST', 'EXTRA_LAST');

CREATE TABLE "LoanType" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "institutionPartyId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Loan" (
    "id" SERIAL NOT NULL,
    "number" INTEGER NOT NULL,
    "paymentDate" DATE NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "loanTypeId" INTEGER NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "installmentCount" INTEGER NOT NULL,
    "installmentAmount" DECIMAL(20,4) NOT NULL,
    "startMonthId" INTEGER NOT NULL,
    "remainderMode" "LoanRemainderMode" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoanMonthlyBalance" (
    "id" SERIAL NOT NULL,
    "loanId" INTEGER NOT NULL,
    "slipId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "installment" DECIMAL(20,4) NOT NULL,
    "balanceBefore" DECIMAL(20,4) NOT NULL,
    "balanceAfter" DECIMAL(20,4) NOT NULL,

    CONSTRAINT "LoanMonthlyBalance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoanAdjustment" (
    "id" SERIAL NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "fromMonthId" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoanAdjustmentLine" (
    "id" SERIAL NOT NULL,
    "adjustmentId" INTEGER NOT NULL,
    "loanId" INTEGER NOT NULL,
    "settledAmount" DECIMAL(20,4),
    "newInstallment" DECIMAL(20,4),

    CONSTRAINT "LoanAdjustmentLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoanSuspension" (
    "id" SERIAL NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "fromMonthId" INTEGER NOT NULL,
    "toMonthId" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanSuspension_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoanSuspensionLine" (
    "id" SERIAL NOT NULL,
    "suspensionId" INTEGER NOT NULL,
    "loanId" INTEGER NOT NULL,

    CONSTRAINT "LoanSuspensionLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LoanType_title_key" ON "LoanType"("title");

CREATE UNIQUE INDEX "Loan_number_key" ON "Loan"("number");

CREATE INDEX "Loan_employeeId_idx" ON "Loan"("employeeId");

CREATE INDEX "LoanMonthlyBalance_slipId_idx" ON "LoanMonthlyBalance"("slipId");

CREATE UNIQUE INDEX "LoanMonthlyBalance_loanId_year_month_key" ON "LoanMonthlyBalance"("loanId", "year", "month");

CREATE UNIQUE INDEX "LoanAdjustment_number_key" ON "LoanAdjustment"("number");

CREATE UNIQUE INDEX "LoanAdjustmentLine_adjustmentId_loanId_key" ON "LoanAdjustmentLine"("adjustmentId", "loanId");

CREATE UNIQUE INDEX "LoanSuspension_number_key" ON "LoanSuspension"("number");

CREATE UNIQUE INDEX "LoanSuspensionLine_suspensionId_loanId_key" ON "LoanSuspensionLine"("suspensionId", "loanId");

ALTER TABLE "LoanType" ADD CONSTRAINT "LoanType_institutionPartyId_fkey" FOREIGN KEY ("institutionPartyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Loan" ADD CONSTRAINT "Loan_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Loan" ADD CONSTRAINT "Loan_loanTypeId_fkey" FOREIGN KEY ("loanTypeId") REFERENCES "LoanType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Loan" ADD CONSTRAINT "Loan_startMonthId_fkey" FOREIGN KEY ("startMonthId") REFERENCES "WorkCalendarMonth"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LoanMonthlyBalance" ADD CONSTRAINT "LoanMonthlyBalance_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LoanMonthlyBalance" ADD CONSTRAINT "LoanMonthlyBalance_slipId_fkey" FOREIGN KEY ("slipId") REFERENCES "PayrollSlip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LoanAdjustment" ADD CONSTRAINT "LoanAdjustment_fromMonthId_fkey" FOREIGN KEY ("fromMonthId") REFERENCES "WorkCalendarMonth"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LoanAdjustmentLine" ADD CONSTRAINT "LoanAdjustmentLine_adjustmentId_fkey" FOREIGN KEY ("adjustmentId") REFERENCES "LoanAdjustment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LoanAdjustmentLine" ADD CONSTRAINT "LoanAdjustmentLine_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LoanSuspension" ADD CONSTRAINT "LoanSuspension_fromMonthId_fkey" FOREIGN KEY ("fromMonthId") REFERENCES "WorkCalendarMonth"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LoanSuspension" ADD CONSTRAINT "LoanSuspension_toMonthId_fkey" FOREIGN KEY ("toMonthId") REFERENCES "WorkCalendarMonth"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LoanSuspensionLine" ADD CONSTRAINT "LoanSuspensionLine_suspensionId_fkey" FOREIGN KEY ("suspensionId") REFERENCES "LoanSuspension"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LoanSuspensionLine" ADD CONSTRAINT "LoanSuspensionLine_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
