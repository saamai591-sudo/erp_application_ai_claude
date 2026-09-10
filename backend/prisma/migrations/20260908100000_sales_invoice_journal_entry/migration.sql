-- AlterEnum
ALTER TYPE "IssuingSystem" ADD VALUE 'SALES';

-- AlterTable: SalesInvoice — journalEntryId، هم‌الگوی PurchaseInvoice
ALTER TABLE "SalesInvoice" ADD COLUMN     "journalEntryId" INTEGER;
CREATE UNIQUE INDEX "SalesInvoice_journalEntryId_key" ON "SalesInvoice"("journalEntryId");
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"(id) ON DELETE SET NULL ON UPDATE CASCADE;
