-- چهار نوع حساب معین برای تضمین‌ها (به‌ازای نوع تضمین): دریافت تضمین، پرداخت تضمین، طرف حساب دریافت تضمین، طرف حساب پرداخت تضمین
ALTER TYPE "TreasuryAccountType" ADD VALUE 'GUARANTEE_RECEIPT';
ALTER TYPE "TreasuryAccountType" ADD VALUE 'GUARANTEE_PAYMENT';
ALTER TYPE "TreasuryAccountType" ADD VALUE 'GUARANTEE_RECEIPT_PARTY';
ALTER TYPE "TreasuryAccountType" ADD VALUE 'GUARANTEE_PAYMENT_PARTY';

ALTER TABLE "TreasuryAccountSetting" ADD COLUMN "guaranteeTypeId" INTEGER;
ALTER TABLE "TreasuryAccountSetting" ADD CONSTRAINT "TreasuryAccountSetting_guaranteeTypeId_fkey" FOREIGN KEY ("guaranteeTypeId") REFERENCES "GuaranteeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "TreasuryAccountSetting_accountType_guaranteeTypeId_effectiveDate_key" ON "TreasuryAccountSetting"("accountType", "guaranteeTypeId", "effectiveDate");
