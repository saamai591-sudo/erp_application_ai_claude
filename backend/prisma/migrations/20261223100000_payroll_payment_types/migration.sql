-- حقوق و دستمزد › تنظیمات › نوع پرداخت حقوق

CREATE TYPE "PayrollPayTo" AS ENUM ('EMPLOYEE', 'FACTOR_ORG');

CREATE TABLE "PayrollPaymentType" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "payTo" "PayrollPayTo" NOT NULL,
    "beneficiaryOrgId" INTEGER,
    "hasFile" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollPaymentType_pkey" PRIMARY KEY ("id"),
    -- سازمان فقط برای «پرداخت به سازمان مرتبط با عامل» و در آن حالت الزامی است
    CONSTRAINT "PayrollPaymentType_org_when_factor_org" CHECK (("payTo" = 'FACTOR_ORG') = ("beneficiaryOrgId" IS NOT NULL))
);
CREATE UNIQUE INDEX "PayrollPaymentType_code_key" ON "PayrollPaymentType"("code");
CREATE UNIQUE INDEX "PayrollPaymentType_title_key" ON "PayrollPaymentType"("title");
ALTER TABLE "PayrollPaymentType" ADD CONSTRAINT "PayrollPaymentType_beneficiaryOrgId_fkey" FOREIGN KEY ("beneficiaryOrgId") REFERENCES "BeneficiaryOrg"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PayrollPaymentTypeItem" (
    "id" SERIAL NOT NULL,
    "paymentTypeId" INTEGER NOT NULL,
    "payrollComponentId" INTEGER,
    "loanTypeId" INTEGER,
    "netCalcTypeId" INTEGER,

    CONSTRAINT "PayrollPaymentTypeItem_pkey" PRIMARY KEY ("id"),
    -- مرجع دقیقاً یکی از سه مورد است
    CONSTRAINT "PayrollPaymentTypeItem_one_ref" CHECK (
      (("payrollComponentId" IS NOT NULL)::int + ("loanTypeId" IS NOT NULL)::int + ("netCalcTypeId" IS NOT NULL)::int) = 1
    )
);
CREATE INDEX "PayrollPaymentTypeItem_paymentTypeId_idx" ON "PayrollPaymentTypeItem"("paymentTypeId");
CREATE UNIQUE INDEX "PayrollPaymentTypeItem_paymentTypeId_payrollComponentId_key" ON "PayrollPaymentTypeItem"("paymentTypeId", "payrollComponentId");
CREATE UNIQUE INDEX "PayrollPaymentTypeItem_paymentTypeId_loanTypeId_key" ON "PayrollPaymentTypeItem"("paymentTypeId", "loanTypeId");
CREATE UNIQUE INDEX "PayrollPaymentTypeItem_paymentTypeId_netCalcTypeId_key" ON "PayrollPaymentTypeItem"("paymentTypeId", "netCalcTypeId");
ALTER TABLE "PayrollPaymentTypeItem" ADD CONSTRAINT "PayrollPaymentTypeItem_paymentTypeId_fkey" FOREIGN KEY ("paymentTypeId") REFERENCES "PayrollPaymentType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollPaymentTypeItem" ADD CONSTRAINT "PayrollPaymentTypeItem_payrollComponentId_fkey" FOREIGN KEY ("payrollComponentId") REFERENCES "PayrollComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollPaymentTypeItem" ADD CONSTRAINT "PayrollPaymentTypeItem_loanTypeId_fkey" FOREIGN KEY ("loanTypeId") REFERENCES "LoanType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollPaymentTypeItem" ADD CONSTRAINT "PayrollPaymentTypeItem_netCalcTypeId_fkey" FOREIGN KEY ("netCalcTypeId") REFERENCES "PayrollCalcType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
