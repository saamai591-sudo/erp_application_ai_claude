-- اجزای بهای تولید (مواد هر جزء با استاندارد/انحراف و هزینه‌ی تبدیل به تفکیک مخزن و معین) — ذخیره هنگام محاسبه
CREATE TYPE "ProductionCostComponentKind" AS ENUM ('MATERIAL', 'CARRY_MATERIAL', 'CONVERSION', 'CARRY_CONVERSION');

CREATE TABLE "ProductionCostComponent" (
    "id" SERIAL NOT NULL,
    "runId" INTEGER NOT NULL,
    "costCenterId" INTEGER NOT NULL,
    "goodsItemId" INTEGER NOT NULL,
    "kind" "ProductionCostComponentKind" NOT NULL,
    "componentItemId" INTEGER,
    "poolId" INTEGER,
    "accountId" INTEGER,
    "actualQty" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "actualAmount" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "standardQty" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "standardAmount" DECIMAL(36,10) NOT NULL DEFAULT 0,

    CONSTRAINT "ProductionCostComponent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductionCostComponent_runId_idx" ON "ProductionCostComponent"("runId");

ALTER TABLE "ProductionCostComponent" ADD CONSTRAINT "ProductionCostComponent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ProductionCostRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionCostComponent" ADD CONSTRAINT "ProductionCostComponent_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionCostComponent" ADD CONSTRAINT "ProductionCostComponent_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionCostComponent" ADD CONSTRAINT "ProductionCostComponent_componentItemId_fkey" FOREIGN KEY ("componentItemId") REFERENCES "GoodsItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductionCostComponent" ADD CONSTRAINT "ProductionCostComponent_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "CostPool"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductionCostComponent" ADD CONSTRAINT "ProductionCostComponent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
