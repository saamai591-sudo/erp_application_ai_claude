-- قواعد تفصیل روی رکوردهای «تعیین حسابهای معین» (دریافت/پرداخت) هم تعریف می‌شود
ALTER TYPE "DetailRuleSource" ADD VALUE IF NOT EXISTS 'FROM_BASE_DOCUMENT';

-- AlterTable
ALTER TABLE "DetailRuleHeader" ALTER COLUMN "settingId" DROP NOT NULL;
ALTER TABLE "DetailRuleHeader" ADD COLUMN "treasurySettingId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "DetailRuleHeader_treasurySettingId_effectiveDate_key" ON "DetailRuleHeader"("treasurySettingId", "effectiveDate");

-- AddForeignKey
ALTER TABLE "DetailRuleHeader" ADD CONSTRAINT "DetailRuleHeader_treasurySettingId_fkey" FOREIGN KEY ("treasurySettingId") REFERENCES "TreasuryAccountSetting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
