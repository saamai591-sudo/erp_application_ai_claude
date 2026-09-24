-- AlterEnum
ALTER TYPE "TreasuryAccountType" ADD VALUE 'CHEQUE_IN_COLLECTION';

-- AlterTable
ALTER TABLE "ChequeDeposit" ADD COLUMN "journalEntryId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "ChequeDeposit_journalEntryId_key" ON "ChequeDeposit"("journalEntryId");

-- AddForeignKey
ALTER TABLE "ChequeDeposit" ADD CONSTRAINT "ChequeDeposit_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- نوع سند سیستمی «واگذاری چک به بانک» (هم‌راستا با seed.ts) — فقط اگر هنوز وجود ندارد و عنوان آن برای رکورد دیگری گرفته نشده باشد
INSERT INTO "DocumentType" ("code", "title", "isSystem", "systemKey")
SELECT COALESCE(MAX("code"), 0) + 1, 'واگذاری چک به بانک', true, 'CHEQUE_DEPOSIT'
FROM "DocumentType"
WHERE NOT EXISTS (SELECT 1 FROM "DocumentType" WHERE "systemKey" = 'CHEQUE_DEPOSIT')
  AND NOT EXISTS (SELECT 1 FROM "DocumentType" WHERE "title" = 'واگذاری چک به بانک');
