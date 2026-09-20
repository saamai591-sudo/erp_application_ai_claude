-- AlterEnum
ALTER TYPE "IssuingSystem" ADD VALUE 'TREASURY';

-- AlterEnum
ALTER TYPE "TreasuryAccountType" ADD VALUE 'FX_GAIN_LOSS';

-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN "journalEntryId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_journalEntryId_key" ON "Receipt"("journalEntryId");

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- نوع سند سیستمی «رسید دریافت» (هم‌راستا با seed.ts) — فقط اگر هنوز وجود ندارد و عنوان/کد آن توسط کاربر
-- برای رکورد دیگری گرفته نشده باشد؛ کد = بزرگ‌ترین کد موجود + ۱ تا با کدهای کاربر برخورد نکند.
INSERT INTO "DocumentType" ("code", "title", "isSystem", "systemKey")
SELECT COALESCE(MAX("code"), 0) + 1, 'رسید دریافت', true, 'RECEIPT'
FROM "DocumentType"
WHERE NOT EXISTS (SELECT 1 FROM "DocumentType" WHERE "systemKey" = 'RECEIPT')
  AND NOT EXISTS (SELECT 1 FROM "DocumentType" WHERE "title" = 'رسید دریافت');
