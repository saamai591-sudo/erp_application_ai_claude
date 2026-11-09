-- Asset depreciation: first-month rule on the group, opening accumulated depreciation, per-period run and per-position items

-- CreateEnum
CREATE TYPE "AssetDepreciationStartRule" AS ENUM ('DAILY', 'MONTH_START', 'NEXT_MONTH');

-- AlterTable
ALTER TABLE "AssetGroup" ADD COLUMN     "depreciationStartRule" "AssetDepreciationStartRule" NOT NULL DEFAULT 'DAILY';

-- AlterTable
ALTER TABLE "FixedAsset" ADD COLUMN     "openingAccumulatedDepreciation" DECIMAL(36,10);

-- CreateTable
CREATE TABLE "AssetDepreciationRun" (
    "id" SERIAL NOT NULL,
    "reportingPeriodId" INTEGER NOT NULL,
    "totalAmount" DECIMAL(36,10) NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calculatedById" INTEGER,
    "journalEntryId" INTEGER,

    CONSTRAINT "AssetDepreciationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetDepreciationItem" (
    "id" SERIAL NOT NULL,
    "runId" INTEGER NOT NULL,
    "assetId" INTEGER NOT NULL,
    "positionId" INTEGER NOT NULL,
    "assetGroupId" INTEGER NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "days" INTEGER NOT NULL,
    "amount" DECIMAL(36,10) NOT NULL,
    "costCenterId" INTEGER NOT NULL,
    "projectId" INTEGER,

    CONSTRAINT "AssetDepreciationItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssetDepreciationRun_reportingPeriodId_key" ON "AssetDepreciationRun"("reportingPeriodId");

-- CreateIndex
CREATE INDEX "AssetDepreciationItem_runId_idx" ON "AssetDepreciationItem"("runId");

-- CreateIndex
CREATE INDEX "AssetDepreciationItem_assetId_idx" ON "AssetDepreciationItem"("assetId");

-- AddForeignKey
ALTER TABLE "AssetDepreciationRun" ADD CONSTRAINT "AssetDepreciationRun_reportingPeriodId_fkey" FOREIGN KEY ("reportingPeriodId") REFERENCES "ReportingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetDepreciationRun" ADD CONSTRAINT "AssetDepreciationRun_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetDepreciationItem" ADD CONSTRAINT "AssetDepreciationItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AssetDepreciationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetDepreciationItem" ADD CONSTRAINT "AssetDepreciationItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FixedAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetDepreciationItem" ADD CONSTRAINT "AssetDepreciationItem_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "AssetPosition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
