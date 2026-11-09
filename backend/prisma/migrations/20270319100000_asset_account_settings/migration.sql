-- «تعیین حسابهای معین دارایی ثابت» (تاریخ‌دار) جای ۱۱ ستون حساب روی گروه دارایی را می‌گیرد؛ حساب‌های قبلی گروه‌ها حذف می‌شوند (تصمیم کاربر).
-- «نوع بیمه» هم تعریف‌پذیر می‌شود و روی بیمه‌نامه ثبت می‌شود.

-- ستون‌های حساب گروه
ALTER TABLE "AssetGroup"
  DROP COLUMN "assetCostAccountId",
  DROP COLUMN "depreciationExpenseAccountId",
  DROP COLUMN "accumulatedDepreciationAccountId",
  DROP COLUMN "insuranceExpenseAccountId",
  DROP COLUMN "prepaidInsuranceAccountId",
  DROP COLUMN "saleGainLossAccountId",
  DROP COLUMN "insuranceGainLossAccountId",
  DROP COLUMN "repairExpenseAccountId",
  DROP COLUMN "donationExpenseAccountId",
  DROP COLUMN "scrapLossAccountId",
  DROP COLUMN "priorPeriodAdjustmentAccountId";

-- نوع بیمه
CREATE TABLE "AssetInsuranceType" (
  "id" SERIAL NOT NULL,
  "code" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssetInsuranceType_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AssetInsuranceType_code_key" ON "AssetInsuranceType"("code");
CREATE UNIQUE INDEX "AssetInsuranceType_title_key" ON "AssetInsuranceType"("title");

ALTER TABLE "AssetInsurancePolicy" ADD COLUMN "insuranceTypeId" INTEGER;
ALTER TABLE "AssetInsurancePolicy" ADD CONSTRAINT "AssetInsurancePolicy_insuranceTypeId_fkey"
  FOREIGN KEY ("insuranceTypeId") REFERENCES "AssetInsuranceType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- تعیین حساب‌ها
CREATE TYPE "AssetAccountType" AS ENUM ('ASSET_COST','DEPRECIATION_EXPENSE','ACCUMULATED_DEPRECIATION','INSURANCE_EXPENSE','PREPAID_INSURANCE','SALE_GAIN_LOSS','INSURANCE_GAIN_LOSS','REPAIR_EXPENSE','DONATION_EXPENSE','SCRAP_LOSS','PRIOR_PERIOD_ADJUSTMENT');

CREATE TABLE "AssetAccountSetting" (
  "id" SERIAL NOT NULL,
  "accountType" "AssetAccountType" NOT NULL,
  "assetGroupId" INTEGER NOT NULL,
  "insuranceTypeId" INTEGER,
  "effectiveDate" DATE NOT NULL,
  "accountId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssetAccountSetting_pkey" PRIMARY KEY ("id"),
  -- نوع بیمه فقط برای دو حساب بیمه (و برای آن‌ها الزامی)
  CONSTRAINT "AssetAccountSetting_insurance_type_chk" CHECK (
    ("accountType" IN ('INSURANCE_EXPENSE','PREPAID_INSURANCE') AND "insuranceTypeId" IS NOT NULL)
    OR ("accountType" NOT IN ('INSURANCE_EXPENSE','PREPAID_INSURANCE') AND "insuranceTypeId" IS NULL)
  )
);
CREATE INDEX "AssetAccountSetting_assetGroupId_accountType_idx" ON "AssetAccountSetting"("assetGroupId","accountType");
CREATE UNIQUE INDEX "AssetAccountSetting_key_date_key" ON "AssetAccountSetting"("accountType","assetGroupId","insuranceTypeId","effectiveDate") NULLS NOT DISTINCT;
ALTER TABLE "AssetAccountSetting" ADD CONSTRAINT "AssetAccountSetting_assetGroupId_fkey" FOREIGN KEY ("assetGroupId") REFERENCES "AssetGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssetAccountSetting" ADD CONSTRAINT "AssetAccountSetting_insuranceTypeId_fkey" FOREIGN KEY ("insuranceTypeId") REFERENCES "AssetInsuranceType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssetAccountSetting" ADD CONSTRAINT "AssetAccountSetting_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- قفل زنده: استفاده از رکورد در سند حسابداری
ALTER TABLE "AccountingSettingUsage" ADD COLUMN "assetSettingId" INTEGER;
ALTER TABLE "AccountingSettingUsage" ADD CONSTRAINT "AccountingSettingUsage_assetSettingId_fkey" FOREIGN KEY ("assetSettingId") REFERENCES "AssetAccountSetting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "AccountingSettingUsage_journalEntryId_assetSettingId_key" ON "AccountingSettingUsage"("journalEntryId","assetSettingId");
CREATE INDEX "AccountingSettingUsage_assetSettingId_idx" ON "AccountingSettingUsage"("assetSettingId");
ALTER TABLE "AccountingSettingUsage" DROP CONSTRAINT "AccountingSettingUsage_one_setting_chk";
ALTER TABLE "AccountingSettingUsage" ADD CONSTRAINT "AccountingSettingUsage_one_setting_chk" CHECK (
  (("goodsSettingId" IS NOT NULL)::int + ("treasurySettingId" IS NOT NULL)::int + ("assetSettingId" IS NOT NULL)::int) = 1
);
