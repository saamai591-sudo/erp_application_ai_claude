-- Fixed asset exit documents (scrap / loss / donation); sale with invoice comes later

-- CreateEnum
CREATE TYPE "AssetExitNature" AS ENUM ('SALE', 'SCRAP', 'LOSS', 'DONATION');

-- CreateEnum
CREATE TYPE "AssetExitStatus" AS ENUM ('DRAFT', 'CONFIRMED');

-- AlterTable
ALTER TABLE "AssetDepreciationItem" ADD COLUMN "exitItemId" INTEGER;

-- CreateTable
CREATE TABLE "AssetExitType" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "nature" "AssetExitNature" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetExitType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetExit" (
    "id" SERIAL NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "typeId" INTEGER NOT NULL,
    "description" TEXT,
    "status" "AssetExitStatus" NOT NULL DEFAULT 'DRAFT',
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" INTEGER,
    "journalEntryId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetExit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetExitItem" (
    "id" SERIAL NOT NULL,
    "exitId" INTEGER NOT NULL,
    "assetId" INTEGER NOT NULL,
    "groupId" INTEGER NOT NULL,
    "costAtExit" DECIMAL(36,10),
    "accumulatedAtExit" DECIMAL(36,10),

    CONSTRAINT "AssetExitItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssetExitType_title_key" ON "AssetExitType"("title");
CREATE UNIQUE INDEX "AssetExit_fiscalPeriodId_number_key" ON "AssetExit"("fiscalPeriodId", "number");
CREATE UNIQUE INDEX "AssetExitItem_exitId_assetId_key" ON "AssetExitItem"("exitId", "assetId");
CREATE INDEX "AssetDepreciationItem_exitItemId_idx" ON "AssetDepreciationItem"("exitItemId");

-- AddForeignKey
ALTER TABLE "AssetDepreciationItem" ADD CONSTRAINT "AssetDepreciationItem_exitItemId_fkey" FOREIGN KEY ("exitItemId") REFERENCES "AssetExitItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetExit" ADD CONSTRAINT "AssetExit_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssetExit" ADD CONSTRAINT "AssetExit_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "AssetExitType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssetExit" ADD CONSTRAINT "AssetExit_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssetExitItem" ADD CONSTRAINT "AssetExitItem_exitId_fkey" FOREIGN KEY ("exitId") REFERENCES "AssetExit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetExitItem" ADD CONSTRAINT "AssetExitItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FixedAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssetExitItem" ADD CONSTRAINT "AssetExitItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "AssetGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
