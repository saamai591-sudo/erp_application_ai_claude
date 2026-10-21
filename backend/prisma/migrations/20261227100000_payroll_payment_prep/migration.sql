-- حقوق و دستمزد › عملیات › آماده‌سازی پرداخت

CREATE TYPE "PayrollPrepStatus" AS ENUM ('DRAFT', 'APPROVED');
CREATE TYPE "PayrollPrepItemKind" AS ENUM ('PAYROLL_FACTOR', 'LOAN_TYPE', 'NET_PAY');

CREATE TABLE "PayrollPaymentPrep" (
    "id" SERIAL NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "paymentTypeId" INTEGER NOT NULL,
    "branchId" INTEGER,
    "fileStructureId" INTEGER,
    "status" "PayrollPrepStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedAt" TIMESTAMP(3),
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollPaymentPrep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollPaymentPrepLine" (
    "id" SERIAL NOT NULL,
    "prepId" INTEGER NOT NULL,
    "slipId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "kind" "PayrollPrepItemKind" NOT NULL,
    "payrollComponentId" INTEGER,
    "loanTypeId" INTEGER,
    "amount" DECIMAL(20,4) NOT NULL,
    "payableAmount" DECIMAL(20,4) NOT NULL,

    CONSTRAINT "PayrollPaymentPrepLine_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PayrollPaymentPrepLine_ref_check" CHECK (
      ("kind" = 'PAYROLL_FACTOR' AND "payrollComponentId" IS NOT NULL AND "loanTypeId" IS NULL) OR
      ("kind" = 'LOAN_TYPE' AND "loanTypeId" IS NOT NULL AND "payrollComponentId" IS NULL) OR
      ("kind" = 'NET_PAY' AND "payrollComponentId" IS NULL AND "loanTypeId" IS NULL)
    ),
    CONSTRAINT "PayrollPaymentPrepLine_amounts_check" CHECK ("payableAmount" >= 0 AND "amount" >= 0)
);

CREATE UNIQUE INDEX "PayrollPaymentPrep_number_key" ON "PayrollPaymentPrep"("number");
CREATE INDEX "PayrollPaymentPrep_year_month_idx" ON "PayrollPaymentPrep"("year", "month");
CREATE INDEX "PayrollPaymentPrepLine_prepId_idx" ON "PayrollPaymentPrepLine"("prepId");
CREATE INDEX "PayrollPaymentPrepLine_slipId_idx" ON "PayrollPaymentPrepLine"("slipId");
-- هر آیتمِ هر فیش در یک سند فقط یک بار (ایندکس یکتای جزئی با COALESCE؛ Prisma نمی‌تواند مدل کند)
CREATE UNIQUE INDEX "PayrollPaymentPrepLine_unique_item" ON "PayrollPaymentPrepLine"("prepId", "slipId", "kind", COALESCE("payrollComponentId", 0), COALESCE("loanTypeId", 0));

ALTER TABLE "PayrollPaymentPrep" ADD CONSTRAINT "PayrollPaymentPrep_paymentTypeId_fkey" FOREIGN KEY ("paymentTypeId") REFERENCES "PayrollPaymentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollPaymentPrep" ADD CONSTRAINT "PayrollPaymentPrep_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "BeneficiaryBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollPaymentPrep" ADD CONSTRAINT "PayrollPaymentPrep_fileStructureId_fkey" FOREIGN KEY ("fileStructureId") REFERENCES "FileStructure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollPaymentPrep" ADD CONSTRAINT "PayrollPaymentPrep_year_month_fkey" FOREIGN KEY ("year", "month") REFERENCES "WorkCalendarMonth"("year", "month") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollPaymentPrep" ADD CONSTRAINT "PayrollPaymentPrep_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PayrollPaymentPrepLine" ADD CONSTRAINT "PayrollPaymentPrepLine_prepId_fkey" FOREIGN KEY ("prepId") REFERENCES "PayrollPaymentPrep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollPaymentPrepLine" ADD CONSTRAINT "PayrollPaymentPrepLine_slipId_fkey" FOREIGN KEY ("slipId") REFERENCES "PayrollSlip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollPaymentPrepLine" ADD CONSTRAINT "PayrollPaymentPrepLine_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollPaymentPrepLine" ADD CONSTRAINT "PayrollPaymentPrepLine_payrollComponentId_fkey" FOREIGN KEY ("payrollComponentId") REFERENCES "PayrollComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollPaymentPrepLine" ADD CONSTRAINT "PayrollPaymentPrepLine_loanTypeId_fkey" FOREIGN KEY ("loanTypeId") REFERENCES "LoanType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
