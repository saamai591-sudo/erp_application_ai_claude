-- AlterEnum
ALTER TYPE "TreasuryAccountType" ADD VALUE 'PETTY_CASH';

-- AlterTable
ALTER TABLE "TreasuryAccountSetting" ADD COLUMN "pettyCashId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "TreasuryAccountSetting_accountType_pettyCashId_key" ON "TreasuryAccountSetting"("accountType", "pettyCashId");

-- AddForeignKey
ALTER TABLE "TreasuryAccountSetting" ADD CONSTRAINT "TreasuryAccountSetting_pettyCashId_fkey" FOREIGN KEY ("pettyCashId") REFERENCES "PettyCash"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "PettyCashSummary" (
    "id" SERIAL NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "custodianId" INTEGER NOT NULL,
    "fxRate" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "description" TEXT,
    "status" "TreasuryDocStatus" NOT NULL DEFAULT 'DRAFT',
    "journalEntryId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PettyCashSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PettyCashSummary_journalEntryId_key" ON "PettyCashSummary"("journalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "PettyCashSummary_fiscalPeriodId_number_key" ON "PettyCashSummary"("fiscalPeriodId", "number");

-- AddForeignKey
ALTER TABLE "PettyCashSummary" ADD CONSTRAINT "PettyCashSummary_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashSummary" ADD CONSTRAINT "PettyCashSummary_custodianId_fkey" FOREIGN KEY ("custodianId") REFERENCES "PettyCashCustodian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashSummary" ADD CONSTRAINT "PettyCashSummary_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "PettyCashSummaryLine" (
    "id" SERIAL NOT NULL,
    "summaryId" INTEGER NOT NULL,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,
    "pettyCashPaymentId" INTEGER NOT NULL,
    "paymentTypeId" INTEGER NOT NULL,
    "purchaseInvoiceId" INTEGER,
    "salesInvoiceId" INTEGER,
    "purchaseOrderId" INTEGER,
    "detail1Code" TEXT,
    "detail2Code" TEXT,
    "detail3Code" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "exchangeGainLoss" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "description" TEXT,

    CONSTRAINT "PettyCashSummaryLine_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PettyCashSummaryLine" ADD CONSTRAINT "PettyCashSummaryLine_summaryId_fkey" FOREIGN KEY ("summaryId") REFERENCES "PettyCashSummary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashSummaryLine" ADD CONSTRAINT "PettyCashSummaryLine_pettyCashPaymentId_fkey" FOREIGN KEY ("pettyCashPaymentId") REFERENCES "PettyCashPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashSummaryLine" ADD CONSTRAINT "PettyCashSummaryLine_paymentTypeId_fkey" FOREIGN KEY ("paymentTypeId") REFERENCES "PaymentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashSummaryLine" ADD CONSTRAINT "PettyCashSummaryLine_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashSummaryLine" ADD CONSTRAINT "PettyCashSummaryLine_salesInvoiceId_fkey" FOREIGN KEY ("salesInvoiceId") REFERENCES "SalesInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashSummaryLine" ADD CONSTRAINT "PettyCashSummaryLine_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- نوع سند سیستمی «خلاصه تنخواه» (هم‌راستا با seed.ts) — فقط اگر هنوز وجود ندارد و عنوان آن برای رکورد دیگری گرفته نشده باشد
INSERT INTO "DocumentType" ("code", "title", "isSystem", "systemKey")
SELECT COALESCE(MAX("code"), 0) + 1, 'خلاصه تنخواه', true, 'PETTY_CASH_SUMMARY'
FROM "DocumentType"
WHERE NOT EXISTS (SELECT 1 FROM "DocumentType" WHERE "systemKey" = 'PETTY_CASH_SUMMARY')
  AND NOT EXISTS (SELECT 1 FROM "DocumentType" WHERE "title" = 'خلاصه تنخواه');
