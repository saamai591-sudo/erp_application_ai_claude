-- CreateEnum
CREATE TYPE "PaymentNature" AS ENUM ('SUPPLIER_PAYMENT', 'ADVANCE_PAYMENT', 'CUSTOMER_PAYMENT', 'OTHER_PAYMENT', 'PURCHASE_VAT', 'SALES_VAT');

-- CreateEnum
CREATE TYPE "PaymentBasisType" AS ENUM ('NONE', 'PURCHASE_INVOICE');

-- CreateTable
CREATE TABLE "PaymentType" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "nature" "PaymentNature" NOT NULL,
    "basisType" "PaymentBasisType" NOT NULL,
    "accountId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hasTransactions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentType_code_key" ON "PaymentType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentType_title_key" ON "PaymentType"("title");

-- AlterTable
ALTER TABLE "PaymentSettlementLine" ADD COLUMN "paymentTypeId" INTEGER;

-- AddForeignKey
ALTER TABLE "PaymentType" ADD CONSTRAINT "PaymentType_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSettlementLine" ADD CONSTRAINT "PaymentSettlementLine_paymentTypeId_fkey" FOREIGN KEY ("paymentTypeId") REFERENCES "PaymentType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
