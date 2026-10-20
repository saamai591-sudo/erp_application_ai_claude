-- حقوق و دستمزد › حسابداری حقوق: گروه حساب حقوق، الگوی سند حقوق، تنظیمات صدور سند، سازمان ذینفع عامل، ارتباط فیش با سند

CREATE TYPE "PayrollEntryNature" AS ENUM ('DEBIT', 'CREDIT');
CREATE TYPE "PayrollPartyKind" AS ENUM ('EMPLOYEE', 'FACTOR_ORG', 'SECONDING_ORG');

CREATE TABLE "PayrollAccountGroup" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "hasSecondment" BOOLEAN NOT NULL DEFAULT false,
    "usesProject" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollAccountGroup_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PayrollAccountGroup_code_key" ON "PayrollAccountGroup"("code");
CREATE UNIQUE INDEX "PayrollAccountGroup_title_key" ON "PayrollAccountGroup"("title");

CREATE TABLE "PayrollJournalTemplate" (
    "id" SERIAL NOT NULL,
    "fromMonthId" INTEGER NOT NULL,
    "groupId" INTEGER NOT NULL,
    "payrollComponentId" INTEGER,
    "decreeComponentId" INTEGER,
    "netCalcTypeId" INTEGER,
    "loanTypeId" INTEGER,
    "accountId" INTEGER NOT NULL,
    "nature" "PayrollEntryNature" NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "partyKind" "PayrollPartyKind",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollJournalTemplate_pkey" PRIMARY KEY ("id"),
    -- مرجع دقیقاً یکی از چهار مورد است
    CONSTRAINT "PayrollJournalTemplate_one_ref" CHECK (
      (("payrollComponentId" IS NOT NULL)::int + ("decreeComponentId" IS NOT NULL)::int + ("netCalcTypeId" IS NOT NULL)::int + ("loanTypeId" IS NOT NULL)::int) = 1
    )
);
CREATE INDEX "PayrollJournalTemplate_groupId_fromMonthId_idx" ON "PayrollJournalTemplate"("groupId", "fromMonthId");
ALTER TABLE "PayrollJournalTemplate" ADD CONSTRAINT "PayrollJournalTemplate_fromMonthId_fkey" FOREIGN KEY ("fromMonthId") REFERENCES "WorkCalendarMonth"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollJournalTemplate" ADD CONSTRAINT "PayrollJournalTemplate_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "PayrollAccountGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollJournalTemplate" ADD CONSTRAINT "PayrollJournalTemplate_payrollComponentId_fkey" FOREIGN KEY ("payrollComponentId") REFERENCES "PayrollComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollJournalTemplate" ADD CONSTRAINT "PayrollJournalTemplate_decreeComponentId_fkey" FOREIGN KEY ("decreeComponentId") REFERENCES "DecreeComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollJournalTemplate" ADD CONSTRAINT "PayrollJournalTemplate_netCalcTypeId_fkey" FOREIGN KEY ("netCalcTypeId") REFERENCES "PayrollCalcType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollJournalTemplate" ADD CONSTRAINT "PayrollJournalTemplate_loanTypeId_fkey" FOREIGN KEY ("loanTypeId") REFERENCES "LoanType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollJournalTemplate" ADD CONSTRAINT "PayrollJournalTemplate_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PayrollIssueSetting" (
    "id" SERIAL NOT NULL,
    "fromMonthId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "groupId" INTEGER NOT NULL,
    "secondingPartyId" INTEGER,
    "projectId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollIssueSetting_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PayrollIssueSetting_employeeId_fromMonthId_key" ON "PayrollIssueSetting"("employeeId", "fromMonthId");
ALTER TABLE "PayrollIssueSetting" ADD CONSTRAINT "PayrollIssueSetting_fromMonthId_fkey" FOREIGN KEY ("fromMonthId") REFERENCES "WorkCalendarMonth"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollIssueSetting" ADD CONSTRAINT "PayrollIssueSetting_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollIssueSetting" ADD CONSTRAINT "PayrollIssueSetting_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "PayrollAccountGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollIssueSetting" ADD CONSTRAINT "PayrollIssueSetting_secondingPartyId_fkey" FOREIGN KEY ("secondingPartyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayrollIssueSetting" ADD CONSTRAINT "PayrollIssueSetting_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollComponent" ADD COLUMN "beneficiaryOrgId" INTEGER;
ALTER TABLE "PayrollComponent" ADD CONSTRAINT "PayrollComponent_beneficiaryOrgId_fkey" FOREIGN KEY ("beneficiaryOrgId") REFERENCES "BeneficiaryOrg"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollSlip" ADD COLUMN "journalEntryId" INTEGER;
CREATE INDEX "PayrollSlip_journalEntryId_idx" ON "PayrollSlip"("journalEntryId");
ALTER TABLE "PayrollSlip" ADD CONSTRAINT "PayrollSlip_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- نوع سند «سند حقوق»
INSERT INTO "DocumentType" ("code", "title", "isSystem", "systemKey")
SELECT COALESCE(MAX("code"), 0) + 1, 'سند حقوق', true, 'PAYROLL'
FROM "DocumentType"
WHERE NOT EXISTS (SELECT 1 FROM "DocumentType" WHERE "systemKey" = 'PAYROLL');
