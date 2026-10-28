-- سند حسابداری تحویل فروش + سه نوع «تعیین حسابهای معین» جدید
ALTER TYPE "TreasuryAccountType" ADD VALUE IF NOT EXISTS 'CARD_IN_COLLECTION';
ALTER TYPE "TreasuryAccountType" ADD VALUE IF NOT EXISTS 'STORE_CASH_DIFF_EXPENSE';
ALTER TYPE "TreasuryAccountType" ADD VALUE IF NOT EXISTS 'STORE_CASH_DIFF_CASHIER';
ALTER TABLE "StoreSaleDelivery" ADD COLUMN "journalEntryId" INTEGER;
ALTER TABLE "StoreSaleDelivery" ADD CONSTRAINT "StoreSaleDelivery_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
