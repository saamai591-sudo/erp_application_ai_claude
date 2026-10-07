-- «تعیین حسابهای معین» تاریخ اجرا گرفت: تغییر حساب = رکورد جدید با تاریخ اجرای جدید؛ یکتایی شامل تاریخ اجرا شد
-- DropIndex
DROP INDEX "TreasuryAccountSetting_accountType_bankAccountId_key";
DROP INDEX "TreasuryAccountSetting_accountType_cashBoxId_key";
DROP INDEX "TreasuryAccountSetting_accountType_receivableChequeTypeId_key";
DROP INDEX "TreasuryAccountSetting_accountType_payableChequeTypeId_key";
DROP INDEX "TreasuryAccountSetting_accountType_receiptTypeId_key";
DROP INDEX "TreasuryAccountSetting_accountType_paymentTypeId_key";
DROP INDEX "TreasuryAccountSetting_accountType_pettyCashId_key";

-- AlterTable
ALTER TABLE "TreasuryAccountSetting" ADD COLUMN "effectiveDate" DATE NOT NULL DEFAULT '2000-01-01';
ALTER TABLE "TreasuryAccountSetting" ADD COLUMN "hasTransactions" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "TreasuryAccountSetting_accountType_bankAccountId_effectiveDate_key" ON "TreasuryAccountSetting"("accountType", "bankAccountId", "effectiveDate");
CREATE UNIQUE INDEX "TreasuryAccountSetting_accountType_cashBoxId_effectiveDate_key" ON "TreasuryAccountSetting"("accountType", "cashBoxId", "effectiveDate");
CREATE UNIQUE INDEX "TreasuryAccountSetting_accountType_receivableChequeTypeId_effectiveDate_key" ON "TreasuryAccountSetting"("accountType", "receivableChequeTypeId", "effectiveDate");
CREATE UNIQUE INDEX "TreasuryAccountSetting_accountType_payableChequeTypeId_effectiveDate_key" ON "TreasuryAccountSetting"("accountType", "payableChequeTypeId", "effectiveDate");
CREATE UNIQUE INDEX "TreasuryAccountSetting_accountType_receiptTypeId_effectiveDate_key" ON "TreasuryAccountSetting"("accountType", "receiptTypeId", "effectiveDate");
CREATE UNIQUE INDEX "TreasuryAccountSetting_accountType_paymentTypeId_effectiveDate_key" ON "TreasuryAccountSetting"("accountType", "paymentTypeId", "effectiveDate");
CREATE UNIQUE INDEX "TreasuryAccountSetting_accountType_pettyCashId_effectiveDate_key" ON "TreasuryAccountSetting"("accountType", "pettyCashId", "effectiveDate");
