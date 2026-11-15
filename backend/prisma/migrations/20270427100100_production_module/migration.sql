-- ماژول تولید: فرمول ساخت، دستور تولید، مخزن هزینه، پای کار، بهای تمام‌شده، MRP (طرح: Documents/طرح ماژول تولید.md)
-- CreateEnum
CREATE TYPE "ProductionOrderStatus" AS ENUM ('DRAFT', 'RELEASED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CostPoolBasis" AS ENUM ('QUANTITY', 'MATERIAL_COST', 'STANDARD_HOURS');

-- CreateEnum
CREATE TYPE "WipCountKind" AS ENUM ('PERIOD_END', 'OPENING');

-- CreateEnum
CREATE TYPE "WipCountStatus" AS ENUM ('DRAFT', 'APPROVED');

-- CreateEnum
CREATE TYPE "MrpPlannedType" AS ENUM ('MAKE', 'BUY');

-- CreateEnum
CREATE TYPE "MrpPlannedStatus" AS ENUM ('OPEN', 'CONVERTED');

-- AlterTable
ALTER TABLE "InventoryDocument" ADD COLUMN     "productionOrderId" INTEGER;

-- CreateTable
CREATE TABLE "Bom" (
    "id" SERIAL NOT NULL,
    "number" INTEGER NOT NULL,
    "outputItemId" INTEGER NOT NULL,
    "outputQuantity" DECIMAL(36,10) NOT NULL DEFAULT 1,
    "effectiveDate" DATE NOT NULL,
    "standardHours" DECIMAL(36,10),
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BomLine" (
    "id" SERIAL NOT NULL,
    "bomId" INTEGER NOT NULL,
    "componentItemId" INTEGER NOT NULL,
    "quantity" DECIMAL(36,10) NOT NULL,
    "scrapPercent" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "note" TEXT,

    CONSTRAINT "BomLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionOrder" (
    "id" SERIAL NOT NULL,
    "number" INTEGER NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "outputItemId" INTEGER NOT NULL,
    "quantity" DECIMAL(36,10) NOT NULL,
    "status" "ProductionOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "bomId" INTEGER,
    "standardHours" DECIMAL(36,10),
    "salesOrderLineId" INTEGER,
    "salesQuoteLineId" INTEGER,
    "plannedStart" DATE,
    "plannedEnd" DATE,
    "description" TEXT,
    "mrpPlannedOrderId" INTEGER,
    "closedAt" TIMESTAMP(3),
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionOrderLine" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "componentItemId" INTEGER NOT NULL,
    "quantity" DECIMAL(36,10) NOT NULL,
    "note" TEXT,

    CONSTRAINT "ProductionOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostPool" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "basis" "CostPoolBasis" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CostPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostPoolAccount" (
    "id" SERIAL NOT NULL,
    "poolId" INTEGER NOT NULL,
    "accountId" INTEGER NOT NULL,
    "detailCode" TEXT,

    CONSTRAINT "CostPoolAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WipCount" (
    "id" SERIAL NOT NULL,
    "number" INTEGER NOT NULL,
    "reportingPeriodId" INTEGER NOT NULL,
    "kind" "WipCountKind" NOT NULL,
    "status" "WipCountStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WipCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WipCountLine" (
    "id" SERIAL NOT NULL,
    "wipCountId" INTEGER NOT NULL,
    "productionOrderId" INTEGER NOT NULL,
    "goodsItemId" INTEGER NOT NULL,
    "quantity" DECIMAL(36,10) NOT NULL,
    "completionPercent" DECIMAL(10,4),
    "openingMaterialValue" DECIMAL(36,10),
    "openingConversionValue" DECIMAL(36,10),

    CONSTRAINT "WipCountLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionCostRun" (
    "id" SERIAL NOT NULL,
    "reportingPeriodId" INTEGER NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calculatedById" INTEGER,
    "journalEntryId" INTEGER,
    "warnings" JSONB,
    "pricedItemIds" JSONB,
    "finalizedDocIds" JSONB,

    CONSTRAINT "ProductionCostRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionCostItem" (
    "id" SERIAL NOT NULL,
    "runId" INTEGER NOT NULL,
    "productionOrderId" INTEGER NOT NULL,
    "outputItemId" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "openingWipMaterial" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "openingWipConversion" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "materialCost" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "conversionCost" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "finishedQty" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "wipQty" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "wipPercent" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "unitMaterial" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "unitConversion" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "receiptValue" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "endingWipMaterial" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "endingWipConversion" DECIMAL(36,10) NOT NULL DEFAULT 0,

    CONSTRAINT "ProductionCostItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionCostPoolAlloc" (
    "id" SERIAL NOT NULL,
    "runId" INTEGER NOT NULL,
    "poolId" INTEGER NOT NULL,
    "productionOrderId" INTEGER NOT NULL,
    "basisValue" DECIMAL(36,10) NOT NULL,
    "amount" DECIMAL(36,10) NOT NULL,

    CONSTRAINT "ProductionCostPoolAlloc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionCostPoolLine" (
    "id" SERIAL NOT NULL,
    "runId" INTEGER NOT NULL,
    "poolId" INTEGER NOT NULL,
    "accountId" INTEGER NOT NULL,
    "detail1Code" TEXT,
    "detail2Code" TEXT,
    "detail3Code" TEXT,
    "amount" DECIMAL(36,10) NOT NULL,

    CONSTRAINT "ProductionCostPoolLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemPlanning" (
    "id" SERIAL NOT NULL,
    "goodsItemId" INTEGER NOT NULL,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 0,
    "safetyStock" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "lotSize" DECIMAL(36,10),

    CONSTRAINT "ItemPlanning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MrpRun" (
    "id" SERIAL NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "horizonEnd" DATE NOT NULL,
    "description" TEXT,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MrpRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MrpPlannedOrder" (
    "id" SERIAL NOT NULL,
    "runId" INTEGER NOT NULL,
    "goodsItemId" INTEGER NOT NULL,
    "type" "MrpPlannedType" NOT NULL,
    "quantity" DECIMAL(36,10) NOT NULL,
    "dueDate" DATE NOT NULL,
    "releaseDate" DATE NOT NULL,
    "status" "MrpPlannedStatus" NOT NULL DEFAULT 'OPEN',
    "note" TEXT,
    "supplyRequestId" INTEGER,

    CONSTRAINT "MrpPlannedOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bom_number_key" ON "Bom"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Bom_outputItemId_effectiveDate_key" ON "Bom"("outputItemId", "effectiveDate");

-- CreateIndex
CREATE INDEX "BomLine_bomId_idx" ON "BomLine"("bomId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionOrder_mrpPlannedOrderId_key" ON "ProductionOrder"("mrpPlannedOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionOrder_fiscalPeriodId_number_key" ON "ProductionOrder"("fiscalPeriodId", "number");

-- CreateIndex
CREATE INDEX "ProductionOrderLine_orderId_idx" ON "ProductionOrderLine"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "CostPool_code_key" ON "CostPool"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CostPool_title_key" ON "CostPool"("title");

-- CreateIndex
CREATE INDEX "CostPoolAccount_poolId_idx" ON "CostPoolAccount"("poolId");

-- CreateIndex
CREATE UNIQUE INDEX "WipCount_number_key" ON "WipCount"("number");

-- CreateIndex
CREATE UNIQUE INDEX "WipCount_reportingPeriodId_kind_key" ON "WipCount"("reportingPeriodId", "kind");

-- CreateIndex
CREATE INDEX "WipCountLine_wipCountId_idx" ON "WipCountLine"("wipCountId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionCostRun_reportingPeriodId_key" ON "ProductionCostRun"("reportingPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionCostRun_journalEntryId_key" ON "ProductionCostRun"("journalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionCostItem_runId_productionOrderId_key" ON "ProductionCostItem"("runId", "productionOrderId");

-- CreateIndex
CREATE INDEX "ProductionCostPoolAlloc_runId_idx" ON "ProductionCostPoolAlloc"("runId");

-- CreateIndex
CREATE INDEX "ProductionCostPoolLine_runId_idx" ON "ProductionCostPoolLine"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemPlanning_goodsItemId_key" ON "ItemPlanning"("goodsItemId");

-- CreateIndex
CREATE UNIQUE INDEX "MrpRun_number_key" ON "MrpRun"("number");

-- CreateIndex
CREATE INDEX "MrpPlannedOrder_runId_idx" ON "MrpPlannedOrder"("runId");

-- AddForeignKey
ALTER TABLE "InventoryDocument" ADD CONSTRAINT "InventoryDocument_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bom" ADD CONSTRAINT "Bom_outputItemId_fkey" FOREIGN KEY ("outputItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomLine" ADD CONSTRAINT "BomLine_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "Bom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomLine" ADD CONSTRAINT "BomLine_componentItemId_fkey" FOREIGN KEY ("componentItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_outputItemId_fkey" FOREIGN KEY ("outputItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "Bom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_salesOrderLineId_fkey" FOREIGN KEY ("salesOrderLineId") REFERENCES "SalesOrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_salesQuoteLineId_fkey" FOREIGN KEY ("salesQuoteLineId") REFERENCES "SalesQuoteLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_mrpPlannedOrderId_fkey" FOREIGN KEY ("mrpPlannedOrderId") REFERENCES "MrpPlannedOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrderLine" ADD CONSTRAINT "ProductionOrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ProductionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionOrderLine" ADD CONSTRAINT "ProductionOrderLine_componentItemId_fkey" FOREIGN KEY ("componentItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostPoolAccount" ADD CONSTRAINT "CostPoolAccount_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "CostPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostPoolAccount" ADD CONSTRAINT "CostPoolAccount_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WipCount" ADD CONSTRAINT "WipCount_reportingPeriodId_fkey" FOREIGN KEY ("reportingPeriodId") REFERENCES "ReportingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WipCountLine" ADD CONSTRAINT "WipCountLine_wipCountId_fkey" FOREIGN KEY ("wipCountId") REFERENCES "WipCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WipCountLine" ADD CONSTRAINT "WipCountLine_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WipCountLine" ADD CONSTRAINT "WipCountLine_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionCostRun" ADD CONSTRAINT "ProductionCostRun_reportingPeriodId_fkey" FOREIGN KEY ("reportingPeriodId") REFERENCES "ReportingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionCostRun" ADD CONSTRAINT "ProductionCostRun_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionCostItem" ADD CONSTRAINT "ProductionCostItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ProductionCostRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionCostItem" ADD CONSTRAINT "ProductionCostItem_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionCostItem" ADD CONSTRAINT "ProductionCostItem_outputItemId_fkey" FOREIGN KEY ("outputItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionCostPoolAlloc" ADD CONSTRAINT "ProductionCostPoolAlloc_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ProductionCostRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionCostPoolAlloc" ADD CONSTRAINT "ProductionCostPoolAlloc_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "CostPool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionCostPoolAlloc" ADD CONSTRAINT "ProductionCostPoolAlloc_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionCostPoolLine" ADD CONSTRAINT "ProductionCostPoolLine_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ProductionCostRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionCostPoolLine" ADD CONSTRAINT "ProductionCostPoolLine_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "CostPool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionCostPoolLine" ADD CONSTRAINT "ProductionCostPoolLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemPlanning" ADD CONSTRAINT "ItemPlanning_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MrpPlannedOrder" ADD CONSTRAINT "MrpPlannedOrder_runId_fkey" FOREIGN KEY ("runId") REFERENCES "MrpRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MrpPlannedOrder" ADD CONSTRAINT "MrpPlannedOrder_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
