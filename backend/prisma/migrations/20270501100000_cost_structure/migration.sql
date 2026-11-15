-- ساختار بهای تمام‌شده (جایگزین مخزن هزینه‌ی تبدیل): درخت با چهار ریشه‌ی سیستمی، قاعده‌ی تاریخ‌دار معین، برگ در ردیف فرمول ساخت.
-- مهاجرت داده ندارد: مخزن‌ها، فرمول‌های ساخت و محاسبه‌های قبلی (فقط داده‌ی آزمایشی) پیش از اجرا پاک شده‌اند.

CREATE TYPE "CostStructureRoot" AS ENUM ('MATERIAL', 'TRANSFERRED', 'LABOR', 'OVERHEAD');
CREATE TYPE "CostBehavior" AS ENUM ('FIXED', 'VARIABLE');
ALTER TYPE "ProductionCostComponentKind" ADD VALUE 'TRANSFERRED';

-- حذف مخزن و نتایج مخزنی
ALTER TABLE "ProductionCostComponent" DROP CONSTRAINT "ProductionCostComponent_poolId_fkey";
ALTER TABLE "ProductionCostComponent" DROP COLUMN "poolId", DROP COLUMN "transferredAmount", ADD COLUMN "nodeId" INTEGER;
DROP TABLE "ProductionCostPoolAlloc";
DROP TABLE "ProductionCostPoolLine";
DROP TABLE "CostPoolAccount";
DROP TABLE "CostPool";

CREATE TABLE "CostStructureNode" (
    "id" SERIAL NOT NULL,
    "parentId" INTEGER,
    "root" "CostStructureRoot" NOT NULL,
    "title" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "CostStructureNode_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CostStructureNode_parentId_idx" ON "CostStructureNode"("parentId");
CREATE UNIQUE INDEX "CostStructureNode_parentId_title_key" ON "CostStructureNode"("parentId", "title");
-- هر ریشه فقط یک‌بار (پایگاه NULL را یکتا نمی‌گیرد) و فقط ریشه سیستمی است
CREATE UNIQUE INDEX "CostStructureNode_root_unique" ON "CostStructureNode"("root") WHERE "parentId" IS NULL;
ALTER TABLE "CostStructureNode" ADD CONSTRAINT "CostStructureNode_system_root_check" CHECK ("isSystem" = ("parentId" IS NULL));
ALTER TABLE "CostStructureNode" ADD CONSTRAINT "CostStructureNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CostStructureNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- چهار ریشه‌ی سیستمی
INSERT INTO "CostStructureNode" ("parentId", "root", "title", "isSystem") VALUES
  (NULL, 'MATERIAL', 'مواد', true),
  (NULL, 'TRANSFERRED', 'انتقالی', true),
  (NULL, 'LABOR', 'دستمزد', true),
  (NULL, 'OVERHEAD', 'سربار', true);

CREATE TABLE "CostAccountRule" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "fromReportingPeriodId" INTEGER NOT NULL,
    "nodeId" INTEGER,
    "behavior" "CostBehavior" NOT NULL DEFAULT 'VARIABLE',
    "basis" "CostPoolBasis" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CostAccountRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CostAccountRule_nodeId_idx" ON "CostAccountRule"("nodeId");
CREATE UNIQUE INDEX "CostAccountRule_accountId_fromReportingPeriodId_key" ON "CostAccountRule"("accountId", "fromReportingPeriodId");
ALTER TABLE "CostAccountRule" ADD CONSTRAINT "CostAccountRule_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CostAccountRule" ADD CONSTRAINT "CostAccountRule_fromReportingPeriodId_fkey" FOREIGN KEY ("fromReportingPeriodId") REFERENCES "ReportingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CostAccountRule" ADD CONSTRAINT "CostAccountRule_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "CostStructureNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ProductionCostAccountAlloc" (
    "id" SERIAL NOT NULL,
    "runId" INTEGER NOT NULL,
    "accountId" INTEGER NOT NULL,
    "costCenterId" INTEGER NOT NULL,
    "direct" BOOLEAN NOT NULL DEFAULT false,
    "basisValue" DECIMAL(36,10) NOT NULL,
    "amount" DECIMAL(36,10) NOT NULL,
    CONSTRAINT "ProductionCostAccountAlloc_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProductionCostAccountAlloc_runId_idx" ON "ProductionCostAccountAlloc"("runId");
ALTER TABLE "ProductionCostAccountAlloc" ADD CONSTRAINT "ProductionCostAccountAlloc_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ProductionCostRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionCostAccountAlloc" ADD CONSTRAINT "ProductionCostAccountAlloc_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionCostAccountAlloc" ADD CONSTRAINT "ProductionCostAccountAlloc_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ProductionCostJournalLine" (
    "id" SERIAL NOT NULL,
    "runId" INTEGER NOT NULL,
    "accountId" INTEGER NOT NULL,
    "detail1Code" TEXT,
    "detail2Code" TEXT,
    "detail3Code" TEXT,
    "amount" DECIMAL(36,10) NOT NULL,
    CONSTRAINT "ProductionCostJournalLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProductionCostJournalLine_runId_idx" ON "ProductionCostJournalLine"("runId");
ALTER TABLE "ProductionCostJournalLine" ADD CONSTRAINT "ProductionCostJournalLine_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ProductionCostRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionCostJournalLine" ADD CONSTRAINT "ProductionCostJournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductionCostComponent" ADD CONSTRAINT "ProductionCostComponent_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "CostStructureNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- برگ ساختار در ردیف فرمول ساخت (اجباری؛ فرمول‌های قبلی پاک شده‌اند)
ALTER TABLE "BomLine" ADD COLUMN "costNodeId" INTEGER NOT NULL;
ALTER TABLE "BomLine" ADD CONSTRAINT "BomLine_costNodeId_fkey" FOREIGN KEY ("costNodeId") REFERENCES "CostStructureNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
