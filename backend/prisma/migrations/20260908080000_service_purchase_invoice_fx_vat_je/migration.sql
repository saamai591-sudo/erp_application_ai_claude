-- AlterTable: ServicePurchaseInvoice — purchaseTypeId/fxRate/journalEntryId, هم‌الگوی PurchaseInvoice.
-- جدول در حال حاضر خالی است، پس ستون‌های NOT NULL بدون backfill اضافه می‌شوند.
ALTER TABLE "ServicePurchaseInvoice" ADD COLUMN     "purchaseTypeId" INTEGER NOT NULL;
ALTER TABLE "ServicePurchaseInvoice" ADD COLUMN     "fxRate" DECIMAL(18,6) NOT NULL DEFAULT 1;
ALTER TABLE "ServicePurchaseInvoice" ADD COLUMN     "journalEntryId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "ServicePurchaseInvoice_journalEntryId_key" ON "ServicePurchaseInvoice"("journalEntryId");

-- AddForeignKey
ALTER TABLE "ServicePurchaseInvoice" ADD CONSTRAINT "ServicePurchaseInvoice_purchaseTypeId_fkey" FOREIGN KEY ("purchaseTypeId") REFERENCES "PurchaseType"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServicePurchaseInvoice" ADD CONSTRAINT "ServicePurchaseInvoice_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: ServicePurchaseInvoiceLine — discount/baseAmount/baseDiscount/vatAmount، هم‌الگوی
-- PurchaseInvoiceLine. جدول هم خالی است (چون والدش خالی است)، پس baseAmount مستقیم NOT NULL می‌شود.
ALTER TABLE "ServicePurchaseInvoiceLine" ADD COLUMN     "discount" DECIMAL(36,10) NOT NULL DEFAULT 0;
ALTER TABLE "ServicePurchaseInvoiceLine" ADD COLUMN     "baseAmount" DECIMAL(36,10) NOT NULL;
ALTER TABLE "ServicePurchaseInvoiceLine" ADD COLUMN     "baseDiscount" DECIMAL(36,10) NOT NULL DEFAULT 0;
ALTER TABLE "ServicePurchaseInvoiceLine" ADD COLUMN     "vatAmount" DECIMAL(36,10) NOT NULL DEFAULT 0;
