-- CreateEnum
CREATE TYPE "ReceiptNature" AS ENUM ('CUSTOMER_RECEIPT', 'ADVANCE_RECEIPT', 'SUPPLIER_RECEIPT', 'OTHER_RECEIPT', 'SALES_VAT', 'PURCHASE_VAT');

-- CreateEnum
CREATE TYPE "ReceiptBasisType" AS ENUM ('NONE', 'SALES_INVOICE', 'PURCHASE_INVOICE', 'SALES_ORDER', 'PROFORMA_INVOICE');

-- DropForeignKey
ALTER TABLE "GoodsServiceAccountingSetting" DROP CONSTRAINT "GoodsServiceAccountingSetting_accountingGroupId_fkey";

-- CreateTable
CREATE TABLE "ReceiptType" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "nature" "ReceiptNature" NOT NULL,
    "basisType" "ReceiptBasisType" NOT NULL,
    "accountId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hasTransactions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceiptType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptType_code_key" ON "ReceiptType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptType_title_key" ON "ReceiptType"("title");

-- AddForeignKey
ALTER TABLE "GoodsServiceAccountingSetting" ADD CONSTRAINT "GoodsServiceAccountingSetting_accountingGroupId_fkey" FOREIGN KEY ("accountingGroupId") REFERENCES "AccountingGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptType" ADD CONSTRAINT "ReceiptType_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

