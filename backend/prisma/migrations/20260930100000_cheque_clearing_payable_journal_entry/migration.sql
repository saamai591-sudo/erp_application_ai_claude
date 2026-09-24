-- AlterEnum
ALTER TYPE "TreasuryAccountType" ADD VALUE 'BOUNCED_PAYABLE_CHEQUE';

-- AlterTable
ALTER TABLE "ChequeClearingPayable" ADD COLUMN "journalEntryId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "ChequeClearingPayable_journalEntryId_key" ON "ChequeClearingPayable"("journalEntryId");

-- AddForeignKey
ALTER TABLE "ChequeClearingPayable" ADD CONSTRAINT "ChequeClearingPayable_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- نوع سند سیستمی «وصول و برگشت چک پرداختنی» (هم‌راستا با seed.ts) — فقط اگر هنوز وجود ندارد و عنوان آن برای رکورد دیگری گرفته نشده باشد
INSERT INTO "DocumentType" ("code", "title", "isSystem", "systemKey")
SELECT COALESCE(MAX("code"), 0) + 1, 'وصول و برگشت چک پرداختنی', true, 'CHEQUE_CLEARING_PAYABLE'
FROM "DocumentType"
WHERE NOT EXISTS (SELECT 1 FROM "DocumentType" WHERE "systemKey" = 'CHEQUE_CLEARING_PAYABLE')
  AND NOT EXISTS (SELECT 1 FROM "DocumentType" WHERE "title" = 'وصول و برگشت چک پرداختنی');
