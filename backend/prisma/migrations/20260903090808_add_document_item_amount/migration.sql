-- CreateEnum
CREATE TYPE "DocumentAmountPriceType" AS ENUM ('USER_ENTRY', 'ENGINE_PRICING', 'ENGINE_CORRECTION', 'CROSS_ENTITY', 'MIGRATED');

-- CreateTable
CREATE TABLE "DocumentItemAmount" (
    "id" SERIAL NOT NULL,
    "lineId" INTEGER NOT NULL,
    "priceType" "DocumentAmountPriceType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "difference" DECIMAL(18,2) NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "journalEntryId" INTEGER,
    "goodsPricingStatusId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER,

    CONSTRAINT "DocumentItemAmount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentItemAmount_lineId_idx" ON "DocumentItemAmount"("lineId");

-- AddForeignKey
ALTER TABLE "DocumentItemAmount" ADD CONSTRAINT "DocumentItemAmount_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "InventoryDocumentLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentItemAmount" ADD CONSTRAINT "DocumentItemAmount_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentItemAmount" ADD CONSTRAINT "DocumentItemAmount_goodsPricingStatusId_fkey" FOREIGN KEY ("goodsPricingStatusId") REFERENCES "GoodsPricingStatus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentItemAmount" ADD CONSTRAINT "DocumentItemAmount_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

