-- CreateEnum
CREATE TYPE "WarehouseJournalEntryIssuanceStatus" AS ENUM ('DRAFT', 'ISSUED');

-- AlterTable
ALTER TABLE "DocumentItemAmount" ADD COLUMN     "warehouseJournalEntryIssuanceId" INTEGER;

-- AlterTable
ALTER TABLE "WarehouseJournalEntryIssuance" ADD COLUMN     "status" "WarehouseJournalEntryIssuanceStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateIndex
CREATE INDEX "DocumentItemAmount_warehouseJournalEntryIssuanceId_idx" ON "DocumentItemAmount"("warehouseJournalEntryIssuanceId");

-- AddForeignKey
ALTER TABLE "DocumentItemAmount" ADD CONSTRAINT "DocumentItemAmount_warehouseJournalEntryIssuanceId_fkey" FOREIGN KEY ("warehouseJournalEntryIssuanceId") REFERENCES "WarehouseJournalEntryIssuance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
