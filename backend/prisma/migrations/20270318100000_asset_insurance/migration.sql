-- Asset insurance policies and period cost calculation

CREATE TABLE "AssetInsurancePolicy" (
    "id" SERIAL NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "costLineId" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetInsurancePolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssetInsurancePolicyItem" (
    "id" SERIAL NOT NULL,
    "policyId" INTEGER NOT NULL,
    "assetId" INTEGER NOT NULL,
    "estimatedAmount" DECIMAL(36,10) NOT NULL,
    "shareAmount" DECIMAL(36,10) NOT NULL,
    CONSTRAINT "AssetInsurancePolicyItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssetInsuranceRun" (
    "id" SERIAL NOT NULL,
    "reportingPeriodId" INTEGER NOT NULL,
    "totalAmount" DECIMAL(36,10) NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calculatedById" INTEGER,
    "journalEntryId" INTEGER,
    CONSTRAINT "AssetInsuranceRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssetInsuranceItem" (
    "id" SERIAL NOT NULL,
    "runId" INTEGER,
    "changeItemId" INTEGER,
    "exitItemId" INTEGER,
    "policyItemId" INTEGER NOT NULL,
    "assetId" INTEGER NOT NULL,
    "positionId" INTEGER NOT NULL,
    "assetGroupId" INTEGER NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "days" INTEGER NOT NULL,
    "amount" DECIMAL(36,10) NOT NULL,
    "costCenterId" INTEGER NOT NULL,
    "projectId" INTEGER,
    CONSTRAINT "AssetInsuranceItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AssetInsuranceItem_one_owner_chk" CHECK ((("runId" IS NOT NULL)::int + ("changeItemId" IS NOT NULL)::int + ("exitItemId" IS NOT NULL)::int) = 1)
);

CREATE UNIQUE INDEX "AssetInsurancePolicy_costLineId_key" ON "AssetInsurancePolicy"("costLineId");
CREATE UNIQUE INDEX "AssetInsurancePolicy_fiscalPeriodId_number_key" ON "AssetInsurancePolicy"("fiscalPeriodId", "number");
CREATE UNIQUE INDEX "AssetInsurancePolicyItem_policyId_assetId_key" ON "AssetInsurancePolicyItem"("policyId", "assetId");
CREATE UNIQUE INDEX "AssetInsuranceRun_reportingPeriodId_key" ON "AssetInsuranceRun"("reportingPeriodId");
CREATE INDEX "AssetInsuranceItem_runId_idx" ON "AssetInsuranceItem"("runId");
CREATE INDEX "AssetInsuranceItem_changeItemId_idx" ON "AssetInsuranceItem"("changeItemId");
CREATE INDEX "AssetInsuranceItem_exitItemId_idx" ON "AssetInsuranceItem"("exitItemId");
CREATE INDEX "AssetInsuranceItem_policyItemId_idx" ON "AssetInsuranceItem"("policyItemId");
CREATE INDEX "AssetInsuranceItem_assetId_idx" ON "AssetInsuranceItem"("assetId");

ALTER TABLE "AssetInsurancePolicy" ADD CONSTRAINT "AssetInsurancePolicy_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssetInsurancePolicy" ADD CONSTRAINT "AssetInsurancePolicy_costLineId_fkey" FOREIGN KEY ("costLineId") REFERENCES "PurchaseCostLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssetInsurancePolicyItem" ADD CONSTRAINT "AssetInsurancePolicyItem_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "AssetInsurancePolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetInsurancePolicyItem" ADD CONSTRAINT "AssetInsurancePolicyItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FixedAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssetInsuranceRun" ADD CONSTRAINT "AssetInsuranceRun_reportingPeriodId_fkey" FOREIGN KEY ("reportingPeriodId") REFERENCES "ReportingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssetInsuranceRun" ADD CONSTRAINT "AssetInsuranceRun_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssetInsuranceItem" ADD CONSTRAINT "AssetInsuranceItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AssetInsuranceRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetInsuranceItem" ADD CONSTRAINT "AssetInsuranceItem_changeItemId_fkey" FOREIGN KEY ("changeItemId") REFERENCES "AssetGroupChangeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetInsuranceItem" ADD CONSTRAINT "AssetInsuranceItem_exitItemId_fkey" FOREIGN KEY ("exitItemId") REFERENCES "AssetExitItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetInsuranceItem" ADD CONSTRAINT "AssetInsuranceItem_policyItemId_fkey" FOREIGN KEY ("policyItemId") REFERENCES "AssetInsurancePolicyItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssetInsuranceItem" ADD CONSTRAINT "AssetInsuranceItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FixedAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssetInsuranceItem" ADD CONSTRAINT "AssetInsuranceItem_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "AssetPosition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
