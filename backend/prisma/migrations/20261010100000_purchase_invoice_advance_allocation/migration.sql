-- AlterTable: فیلدهای سیستمی سهم تسعیر / Cost روی ردیف فاکتور خرید — برای رکوردهای موجود cost = amount (بدون تغییر رفتار قبلی)
ALTER TABLE "PurchaseInvoiceLine" ADD COLUMN "exchangeRateAdjustmentShare" DECIMAL(36,10) NOT NULL DEFAULT 0;
ALTER TABLE "PurchaseInvoiceLine" ADD COLUMN "cost" DECIMAL(36,10) NOT NULL DEFAULT 0;
UPDATE "PurchaseInvoiceLine" SET "cost" = "amount";

-- CreateEnum
CREATE TYPE "AdvancePaymentFxMethod" AS ENUM ('HISTORICAL_RATE', 'TRANSACTION_DATE_RATE');

-- CreateTable
CREATE TABLE "AccountingAdvancePaymentSetting" (
    "id" SERIAL NOT NULL,
    "startDate" DATE NOT NULL,
    "method" "AdvancePaymentFxMethod" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingAdvancePaymentSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountingAdvancePaymentSetting_startDate_key" ON "AccountingAdvancePaymentSetting"("startDate");

-- CreateTable
CREATE TABLE "PurchaseInvoiceAdvanceAllocation" (
    "id" SERIAL NOT NULL,
    "purchaseInvoiceId" INTEGER NOT NULL,
    "paymentSettlementLineId" INTEGER NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseInvoiceAdvanceAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseInvoiceAdvanceAllocation_purchaseInvoiceId_payment_key" ON "PurchaseInvoiceAdvanceAllocation"("purchaseInvoiceId", "paymentSettlementLineId");

-- AddForeignKey
ALTER TABLE "PurchaseInvoiceAdvanceAllocation" ADD CONSTRAINT "PurchaseInvoiceAdvanceAllocation_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoiceAdvanceAllocation" ADD CONSTRAINT "PurchaseInvoiceAdvanceAllocation_paymentSettlementLineId_fkey" FOREIGN KEY ("paymentSettlementLineId") REFERENCES "PaymentSettlementLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
