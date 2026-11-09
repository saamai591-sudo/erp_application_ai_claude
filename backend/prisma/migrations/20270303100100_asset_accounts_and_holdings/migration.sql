-- Asset group account settings, source holdings (credit side of the acquisition entry), acquisition entry link

-- CreateEnum
CREATE TYPE "AssetAccountType" AS ENUM ('ASSET_COST', 'DEPRECIATION_EXPENSE', 'ACCUMULATED_DEPRECIATION', 'INSURANCE_EXPENSE', 'PREPAID_INSURANCE', 'SALE_GAIN_LOSS', 'INSURANCE_GAIN_LOSS', 'REPAIR_EXPENSE', 'DONATION_EXPENSE', 'SCRAP_LOSS', 'PRIOR_PERIOD_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "AssetHoldingSource" AS ENUM ('INVOICE_LINE', 'INVENTORY_LINE');

-- AlterTable
ALTER TABLE "FixedAsset" ADD COLUMN     "acquisitionJournalEntryId" INTEGER;

-- CreateTable
CREATE TABLE "AssetGroupAccountSetting" (
    "id" SERIAL NOT NULL,
    "assetGroupId" INTEGER NOT NULL,
    "accountType" "AssetAccountType" NOT NULL,
    "accountId" INTEGER NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetGroupAccountSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetSourceHolding" (
    "id" SERIAL NOT NULL,
    "sourceType" "AssetHoldingSource" NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "journalEntryId" INTEGER NOT NULL,
    "accountId" INTEGER NOT NULL,
    "detail1Code" TEXT,
    "detail2Code" TEXT,
    "detail3Code" TEXT,

    CONSTRAINT "AssetSourceHolding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssetGroupAccountSetting_assetGroupId_accountType_effective_key" ON "AssetGroupAccountSetting"("assetGroupId", "accountType", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "AssetSourceHolding_sourceType_sourceId_key" ON "AssetSourceHolding"("sourceType", "sourceId");

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_acquisitionJournalEntryId_fkey" FOREIGN KEY ("acquisitionJournalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetGroupAccountSetting" ADD CONSTRAINT "AssetGroupAccountSetting_assetGroupId_fkey" FOREIGN KEY ("assetGroupId") REFERENCES "AssetGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetGroupAccountSetting" ADD CONSTRAINT "AssetGroupAccountSetting_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetSourceHolding" ADD CONSTRAINT "AssetSourceHolding_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetSourceHolding" ADD CONSTRAINT "AssetSourceHolding_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
