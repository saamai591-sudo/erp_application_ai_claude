-- تایید حسابداری و صدور سند برای دریافت/پرداخت تضمین
ALTER TABLE "GuaranteeDocument" ADD COLUMN "accountingStatus" "AccountingApprovalStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "GuaranteeDocument" ADD COLUMN "accountingApprovedAt" TIMESTAMP(3);
ALTER TABLE "GuaranteeDocument" ADD COLUMN "accountingApprovedById" INTEGER;
ALTER TABLE "GuaranteeDocument" ADD COLUMN "journalEntryId" INTEGER;
CREATE UNIQUE INDEX "GuaranteeDocument_journalEntryId_key" ON "GuaranteeDocument"("journalEntryId");
ALTER TABLE "GuaranteeDocument" ADD CONSTRAINT "GuaranteeDocument_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TYPE "GuaranteeAccountingRole" AS ENUM ('MAIN', 'PARTY');
CREATE TABLE "GuaranteeAccountingLine" (
  "id" SERIAL NOT NULL,
  "documentId" INTEGER NOT NULL,
  "instrumentId" INTEGER NOT NULL,
  "role" "GuaranteeAccountingRole" NOT NULL,
  "accountId" INTEGER NOT NULL,
  "treasurySettingId" INTEGER,
  "detail1Code" TEXT,
  "detail2Code" TEXT,
  "detail3Code" TEXT,
  "detail1Source" "DetailValueSource" NOT NULL DEFAULT 'MANUAL',
  "detail2Source" "DetailValueSource" NOT NULL DEFAULT 'MANUAL',
  "detail3Source" "DetailValueSource" NOT NULL DEFAULT 'MANUAL',
  CONSTRAINT "GuaranteeAccountingLine_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GuaranteeAccountingLine_instrumentId_role_key" ON "GuaranteeAccountingLine"("instrumentId", "role");
CREATE INDEX "GuaranteeAccountingLine_documentId_idx" ON "GuaranteeAccountingLine"("documentId");
CREATE INDEX "GuaranteeAccountingLine_treasurySettingId_idx" ON "GuaranteeAccountingLine"("treasurySettingId");
ALTER TABLE "GuaranteeAccountingLine" ADD CONSTRAINT "GuaranteeAccountingLine_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "GuaranteeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuaranteeAccountingLine" ADD CONSTRAINT "GuaranteeAccountingLine_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "GuaranteeInstrument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuaranteeAccountingLine" ADD CONSTRAINT "GuaranteeAccountingLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GuaranteeAccountingLine" ADD CONSTRAINT "GuaranteeAccountingLine_treasurySettingId_fkey" FOREIGN KEY ("treasurySettingId") REFERENCES "TreasuryAccountSetting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
