-- AlterEnum
ALTER TYPE "IssuingSystem" ADD VALUE 'PURCHASE';

-- AlterTable
ALTER TABLE "PurchaseInvoice" ADD COLUMN     "journalEntryId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseInvoice_journalEntryId_key" ON "PurchaseInvoice"("journalEntryId");

-- AddForeignKey
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
