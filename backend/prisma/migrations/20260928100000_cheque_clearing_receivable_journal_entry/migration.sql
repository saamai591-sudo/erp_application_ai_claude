-- AlterTable
ALTER TABLE "ChequeClearingReceivable" ADD COLUMN "journalEntryId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "ChequeClearingReceivable_journalEntryId_key" ON "ChequeClearingReceivable"("journalEntryId");

-- AddForeignKey
ALTER TABLE "ChequeClearingReceivable" ADD CONSTRAINT "ChequeClearingReceivable_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- نوع سند سیستمی «وصول و برگشت چک دریافتنی» (هم‌راستا با seed.ts) — فقط اگر هنوز وجود ندارد و عنوان آن برای رکورد دیگری گرفته نشده باشد
INSERT INTO "DocumentType" ("code", "title", "isSystem", "systemKey")
SELECT COALESCE(MAX("code"), 0) + 1, 'وصول و برگشت چک دریافتنی', true, 'CHEQUE_CLEARING_RECEIVABLE'
FROM "DocumentType"
WHERE NOT EXISTS (SELECT 1 FROM "DocumentType" WHERE "systemKey" = 'CHEQUE_CLEARING_RECEIVABLE')
  AND NOT EXISTS (SELECT 1 FROM "DocumentType" WHERE "title" = 'وصول و برگشت چک دریافتنی');
