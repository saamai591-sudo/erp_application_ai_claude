-- Asset group accounts become columns of AssetGroup (set once, no effective date); the settings table is dropped

-- AlterTable
ALTER TABLE "AssetGroup" ADD COLUMN     "accumulatedDepreciationAccountId" INTEGER,
ADD COLUMN     "assetCostAccountId" INTEGER,
ADD COLUMN     "depreciationExpenseAccountId" INTEGER,
ADD COLUMN     "donationExpenseAccountId" INTEGER,
ADD COLUMN     "insuranceExpenseAccountId" INTEGER,
ADD COLUMN     "insuranceGainLossAccountId" INTEGER,
ADD COLUMN     "prepaidInsuranceAccountId" INTEGER,
ADD COLUMN     "priorPeriodAdjustmentAccountId" INTEGER,
ADD COLUMN     "repairExpenseAccountId" INTEGER,
ADD COLUMN     "saleGainLossAccountId" INTEGER,
ADD COLUMN     "scrapLossAccountId" INTEGER;

-- carry over the latest dated record of every type
UPDATE "AssetGroup" g SET
  "assetCostAccountId" = (SELECT s."accountId" FROM "AssetGroupAccountSetting" s WHERE s."assetGroupId" = g."id" AND s."accountType" = 'ASSET_COST' ORDER BY s."effectiveDate" DESC LIMIT 1),
  "depreciationExpenseAccountId" = (SELECT s."accountId" FROM "AssetGroupAccountSetting" s WHERE s."assetGroupId" = g."id" AND s."accountType" = 'DEPRECIATION_EXPENSE' ORDER BY s."effectiveDate" DESC LIMIT 1),
  "accumulatedDepreciationAccountId" = (SELECT s."accountId" FROM "AssetGroupAccountSetting" s WHERE s."assetGroupId" = g."id" AND s."accountType" = 'ACCUMULATED_DEPRECIATION' ORDER BY s."effectiveDate" DESC LIMIT 1),
  "insuranceExpenseAccountId" = (SELECT s."accountId" FROM "AssetGroupAccountSetting" s WHERE s."assetGroupId" = g."id" AND s."accountType" = 'INSURANCE_EXPENSE' ORDER BY s."effectiveDate" DESC LIMIT 1),
  "prepaidInsuranceAccountId" = (SELECT s."accountId" FROM "AssetGroupAccountSetting" s WHERE s."assetGroupId" = g."id" AND s."accountType" = 'PREPAID_INSURANCE' ORDER BY s."effectiveDate" DESC LIMIT 1),
  "saleGainLossAccountId" = (SELECT s."accountId" FROM "AssetGroupAccountSetting" s WHERE s."assetGroupId" = g."id" AND s."accountType" = 'SALE_GAIN_LOSS' ORDER BY s."effectiveDate" DESC LIMIT 1),
  "insuranceGainLossAccountId" = (SELECT s."accountId" FROM "AssetGroupAccountSetting" s WHERE s."assetGroupId" = g."id" AND s."accountType" = 'INSURANCE_GAIN_LOSS' ORDER BY s."effectiveDate" DESC LIMIT 1),
  "repairExpenseAccountId" = (SELECT s."accountId" FROM "AssetGroupAccountSetting" s WHERE s."assetGroupId" = g."id" AND s."accountType" = 'REPAIR_EXPENSE' ORDER BY s."effectiveDate" DESC LIMIT 1),
  "donationExpenseAccountId" = (SELECT s."accountId" FROM "AssetGroupAccountSetting" s WHERE s."assetGroupId" = g."id" AND s."accountType" = 'DONATION_EXPENSE' ORDER BY s."effectiveDate" DESC LIMIT 1),
  "scrapLossAccountId" = (SELECT s."accountId" FROM "AssetGroupAccountSetting" s WHERE s."assetGroupId" = g."id" AND s."accountType" = 'SCRAP_LOSS' ORDER BY s."effectiveDate" DESC LIMIT 1),
  "priorPeriodAdjustmentAccountId" = (SELECT s."accountId" FROM "AssetGroupAccountSetting" s WHERE s."assetGroupId" = g."id" AND s."accountType" = 'PRIOR_PERIOD_ADJUSTMENT' ORDER BY s."effectiveDate" DESC LIMIT 1);

-- AddForeignKey
ALTER TABLE "AssetGroup" ADD CONSTRAINT "AssetGroup_assetCostAccountId_fkey" FOREIGN KEY ("assetCostAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetGroup" ADD CONSTRAINT "AssetGroup_depreciationExpenseAccountId_fkey" FOREIGN KEY ("depreciationExpenseAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetGroup" ADD CONSTRAINT "AssetGroup_accumulatedDepreciationAccountId_fkey" FOREIGN KEY ("accumulatedDepreciationAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetGroup" ADD CONSTRAINT "AssetGroup_insuranceExpenseAccountId_fkey" FOREIGN KEY ("insuranceExpenseAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetGroup" ADD CONSTRAINT "AssetGroup_prepaidInsuranceAccountId_fkey" FOREIGN KEY ("prepaidInsuranceAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetGroup" ADD CONSTRAINT "AssetGroup_saleGainLossAccountId_fkey" FOREIGN KEY ("saleGainLossAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetGroup" ADD CONSTRAINT "AssetGroup_insuranceGainLossAccountId_fkey" FOREIGN KEY ("insuranceGainLossAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetGroup" ADD CONSTRAINT "AssetGroup_repairExpenseAccountId_fkey" FOREIGN KEY ("repairExpenseAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetGroup" ADD CONSTRAINT "AssetGroup_donationExpenseAccountId_fkey" FOREIGN KEY ("donationExpenseAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetGroup" ADD CONSTRAINT "AssetGroup_scrapLossAccountId_fkey" FOREIGN KEY ("scrapLossAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetGroup" ADD CONSTRAINT "AssetGroup_priorPeriodAdjustmentAccountId_fkey" FOREIGN KEY ("priorPeriodAdjustmentAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropTable
DROP TABLE "AssetGroupAccountSetting";

-- DropEnum
DROP TYPE "AssetAccountType";
