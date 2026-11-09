-- سند حسابداری برگشت خرید دوباره اضافه شد (بستانکار «کنترل برگشت»)
ALTER TABLE "PurchaseReturn" ADD COLUMN "journalEntryId" INTEGER;
CREATE UNIQUE INDEX "PurchaseReturn_journalEntryId_key" ON "PurchaseReturn"("journalEntryId");
ALTER TABLE "PurchaseReturn" ADD CONSTRAINT "PurchaseReturn_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
