-- Asset group change documents; depreciation items may hang off a change item instead of a period run

-- CreateEnum
CREATE TYPE "AssetGroupChangeStatus" AS ENUM ('DRAFT', 'CONFIRMED');

-- AlterTable
ALTER TABLE "AssetDepreciationItem" ADD COLUMN     "changeItemId" INTEGER,
ALTER COLUMN "runId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "AssetGroupChange" (
    "id" SERIAL NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "toGroupId" INTEGER NOT NULL,
    "description" TEXT,
    "status" "AssetGroupChangeStatus" NOT NULL DEFAULT 'DRAFT',
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" INTEGER,
    "journalEntryId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetGroupChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetGroupChangeItem" (
    "id" SERIAL NOT NULL,
    "changeId" INTEGER NOT NULL,
    "assetId" INTEGER NOT NULL,
    "fromGroupId" INTEGER NOT NULL,
    "costAtChange" DECIMAL(36,10),
    "accumulatedAtChange" DECIMAL(36,10),

    CONSTRAINT "AssetGroupChangeItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssetGroupChange_fiscalPeriodId_number_key" ON "AssetGroupChange"("fiscalPeriodId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "AssetGroupChangeItem_changeId_assetId_key" ON "AssetGroupChangeItem"("changeId", "assetId");

-- CreateIndex
CREATE INDEX "AssetDepreciationItem_changeItemId_idx" ON "AssetDepreciationItem"("changeItemId");

-- AddForeignKey
ALTER TABLE "AssetDepreciationItem" ADD CONSTRAINT "AssetDepreciationItem_changeItemId_fkey" FOREIGN KEY ("changeItemId") REFERENCES "AssetGroupChangeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetGroupChange" ADD CONSTRAINT "AssetGroupChange_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetGroupChange" ADD CONSTRAINT "AssetGroupChange_toGroupId_fkey" FOREIGN KEY ("toGroupId") REFERENCES "AssetGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetGroupChange" ADD CONSTRAINT "AssetGroupChange_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetGroupChangeItem" ADD CONSTRAINT "AssetGroupChangeItem_changeId_fkey" FOREIGN KEY ("changeId") REFERENCES "AssetGroupChange"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetGroupChangeItem" ADD CONSTRAINT "AssetGroupChangeItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FixedAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetGroupChangeItem" ADD CONSTRAINT "AssetGroupChangeItem_fromGroupId_fkey" FOREIGN KEY ("fromGroupId") REFERENCES "AssetGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
