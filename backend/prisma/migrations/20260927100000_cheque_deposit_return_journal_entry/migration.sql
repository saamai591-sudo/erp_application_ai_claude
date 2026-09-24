-- AlterTable
ALTER TABLE "ChequeDepositReturn" ADD COLUMN "journalEntryId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "ChequeDepositReturn_journalEntryId_key" ON "ChequeDepositReturn"("journalEntryId");

-- AddForeignKey
ALTER TABLE "ChequeDepositReturn" ADD CONSTRAINT "ChequeDepositReturn_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- نوع سند سیستمی «برگشت از واگذاری چک» (هم‌راستا با seed.ts) — فقط اگر هنوز وجود ندارد و عنوان آن برای رکورد دیگری گرفته نشده باشد
INSERT INTO "DocumentType" ("code", "title", "isSystem", "systemKey")
SELECT COALESCE(MAX("code"), 0) + 1, 'برگشت از واگذاری چک', true, 'CHEQUE_DEPOSIT_RETURN'
FROM "DocumentType"
WHERE NOT EXISTS (SELECT 1 FROM "DocumentType" WHERE "systemKey" = 'CHEQUE_DEPOSIT_RETURN')
  AND NOT EXISTS (SELECT 1 FROM "DocumentType" WHERE "title" = 'برگشت از واگذاری چک');
