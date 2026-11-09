-- برگشت خرید (سند مالی برگشت از فاکتور خرید بر مبنای برگشت به تامین‌کننده)
-- CreateTable
CREATE TABLE "PurchaseReturn" (
    "id" SERIAL NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "partyId" INTEGER NOT NULL,
    "purchaseInvoiceId" INTEGER NOT NULL,
    "currencyId" INTEGER NOT NULL,
    "fxRate" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "description" TEXT,
    "journalEntryId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseReturnLine" (
    "id" SERIAL NOT NULL,
    "purchaseReturnId" INTEGER NOT NULL,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,
    "sourceInventoryLineId" INTEGER NOT NULL,
    "purchaseInvoiceLineId" INTEGER NOT NULL,
    "goodsItemId" INTEGER NOT NULL,
    "unitId" INTEGER NOT NULL,
    "quantity" DECIMAL(36,10) NOT NULL,
    "unitPrice" DECIMAL(36,10) NOT NULL,
    "amount" DECIMAL(36,10) NOT NULL,
    "discount" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "baseAmount" DECIMAL(36,10) NOT NULL,
    "baseDiscount" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "vatAmount" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "description" TEXT,

    CONSTRAINT "PurchaseReturnLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseReturn_journalEntryId_key" ON "PurchaseReturn"("journalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseReturn_fiscalPeriodId_number_key" ON "PurchaseReturn"("fiscalPeriodId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseReturnLine_sourceInventoryLineId_key" ON "PurchaseReturnLine"("sourceInventoryLineId");

-- AddForeignKey
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturnLine" ADD CONSTRAINT "PurchaseReturnLine_purchaseReturnId_fkey" FOREIGN KEY ("purchaseReturnId") REFERENCES "PurchaseReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturnLine" ADD CONSTRAINT "PurchaseReturnLine_sourceInventoryLineId_fkey" FOREIGN KEY ("sourceInventoryLineId") REFERENCES "InventoryDocumentLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturnLine" ADD CONSTRAINT "PurchaseReturnLine_purchaseInvoiceLineId_fkey" FOREIGN KEY ("purchaseInvoiceLineId") REFERENCES "PurchaseInvoiceLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturnLine" ADD CONSTRAINT "PurchaseReturnLine_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReturnLine" ADD CONSTRAINT "PurchaseReturnLine_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "AttendanceFactorMethod_payrollComponentId_execCalendarMonthId_k" RENAME TO "AttendanceFactorMethod_payrollComponentId_execCalendarMonth_key";

-- RenameIndex
ALTER INDEX "BeneficiaryBranch_organizationId_partyId_fileNumber_contractRow" RENAME TO "BeneficiaryBranch_organizationId_partyId_fileNumber_contrac_key";

-- RenameIndex
ALTER INDEX "PurchaseCostAllocation_purchaseCostLineId_inventoryDocumen_key" RENAME TO "PurchaseCostAllocation_purchaseCostLineId_inventoryDocument_key";

-- RenameIndex
ALTER INDEX "PurchaseInvoiceAdvanceAllocation_purchaseInvoiceId_payment_key" RENAME TO "PurchaseInvoiceAdvanceAllocation_purchaseInvoiceId_paymentS_key";

-- RenameIndex
ALTER INDEX "SalesInvoiceAdvanceAllocation_salesInvoiceId_receiptSettlementL" RENAME TO "SalesInvoiceAdvanceAllocation_salesInvoiceId_receiptSettlem_key";

-- RenameIndex
ALTER INDEX "TreasuryAccountSetting_accountType_bankAccountId_effectiveDate_" RENAME TO "TreasuryAccountSetting_accountType_bankAccountId_effectiveD_key";

-- RenameIndex
ALTER INDEX "TreasuryAccountSetting_accountType_payableChequeTypeId_effectiv" RENAME TO "TreasuryAccountSetting_accountType_payableChequeTypeId_effe_key";

-- RenameIndex
ALTER INDEX "TreasuryAccountSetting_accountType_paymentTypeId_effectiveDate_" RENAME TO "TreasuryAccountSetting_accountType_paymentTypeId_effectiveD_key";

-- RenameIndex
ALTER INDEX "TreasuryAccountSetting_accountType_pettyCashId_effectiveDate_ke" RENAME TO "TreasuryAccountSetting_accountType_pettyCashId_effectiveDat_key";

-- RenameIndex
ALTER INDEX "TreasuryAccountSetting_accountType_receiptTypeId_effectiveDate_" RENAME TO "TreasuryAccountSetting_accountType_receiptTypeId_effectiveD_key";

-- RenameIndex
ALTER INDEX "TreasuryAccountSetting_accountType_receivableChequeTypeId_effec" RENAME TO "TreasuryAccountSetting_accountType_receivableChequeTypeId_e_key";
