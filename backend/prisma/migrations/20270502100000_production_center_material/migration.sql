-- ماده‌ی در جریانِ مرکز هزینه به تفکیک کالا (اول و آخر دوره)؛ قبلاً فقط یک عدد کلی برای مرکز نگه داشته می‌شد
CREATE TABLE "ProductionCostCenterMaterial" (
    "id" SERIAL NOT NULL,
    "runId" INTEGER NOT NULL,
    "costCenterId" INTEGER NOT NULL,
    "goodsItemId" INTEGER NOT NULL,
    "openingQty" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "openingValue" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "endingQty" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "endingValue" DECIMAL(36,10) NOT NULL DEFAULT 0,
    CONSTRAINT "ProductionCostCenterMaterial_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProductionCostCenterMaterial_runId_costCenterId_goodsItemId_key" ON "ProductionCostCenterMaterial"("runId", "costCenterId", "goodsItemId");
ALTER TABLE "ProductionCostCenterMaterial" ADD CONSTRAINT "ProductionCostCenterMaterial_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ProductionCostRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionCostCenterMaterial" ADD CONSTRAINT "ProductionCostCenterMaterial_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionCostCenterMaterial" ADD CONSTRAINT "ProductionCostCenterMaterial_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
