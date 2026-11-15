-- ترکیب بهای تسطیح‌شده‌ی لایه‌های محاسبه‌ی بهای تولید + اجزای ردیف‌های افتتاحیه‌ی پای کار

CREATE TYPE "ProductionCompositionScope" AS ENUM ('WIP_END', 'HELD_END', 'MAT_END', 'CARRY_END', 'FINISHED');

ALTER TABLE "WipCountLine" ADD COLUMN "bomId" INTEGER;
ALTER TABLE "WipCountLine" ADD CONSTRAINT "WipCountLine_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "Bom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "WipCountLineComponent" (
    "id" SERIAL NOT NULL,
    "lineId" INTEGER NOT NULL,
    "componentItemId" INTEGER NOT NULL,
    "quantity" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "amount" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "nodeId" INTEGER,
    CONSTRAINT "WipCountLineComponent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WipCountLineComponent_lineId_componentItemId_key" ON "WipCountLineComponent"("lineId", "componentItemId");
ALTER TABLE "WipCountLineComponent" ADD CONSTRAINT "WipCountLineComponent_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "WipCountLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WipCountLineComponent" ADD CONSTRAINT "WipCountLineComponent_componentItemId_fkey" FOREIGN KEY ("componentItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WipCountLineComponent" ADD CONSTRAINT "WipCountLineComponent_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "CostStructureNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ProductionCostComposition" (
    "id" SERIAL NOT NULL,
    "runId" INTEGER NOT NULL,
    "costCenterId" INTEGER NOT NULL,
    "goodsItemId" INTEGER,
    "scope" "ProductionCompositionScope" NOT NULL,
    "side" VARCHAR(1) NOT NULL,
    "nodeId" INTEGER,
    "amount" DECIMAL(36,10) NOT NULL DEFAULT 0,
    CONSTRAINT "ProductionCostComposition_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProductionCostComposition_runId_costCenterId_idx" ON "ProductionCostComposition"("runId", "costCenterId");
ALTER TABLE "ProductionCostComposition" ADD CONSTRAINT "ProductionCostComposition_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ProductionCostRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionCostComposition" ADD CONSTRAINT "ProductionCostComposition_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionCostComposition" ADD CONSTRAINT "ProductionCostComposition_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionCostComposition" ADD CONSTRAINT "ProductionCostComposition_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "CostStructureNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
