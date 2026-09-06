-- CreateTable
CREATE TABLE "GoodsPricingFlowWarehouse" (
    "id" SERIAL NOT NULL,
    "goodsItemId" INTEGER NOT NULL,
    "reportingPeriodId" INTEGER NOT NULL,
    "warehouseId" INTEGER NOT NULL,

    CONSTRAINT "GoodsPricingFlowWarehouse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoodsPricingFlowWarehouse_goodsItemId_reportingPeriodId_war_key" ON "GoodsPricingFlowWarehouse"("goodsItemId", "reportingPeriodId", "warehouseId");

-- AddForeignKey
ALTER TABLE "GoodsPricingFlowWarehouse" ADD CONSTRAINT "GoodsPricingFlowWarehouse_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsPricingFlowWarehouse" ADD CONSTRAINT "GoodsPricingFlowWarehouse_reportingPeriodId_fkey" FOREIGN KEY ("reportingPeriodId") REFERENCES "ReportingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsPricingFlowWarehouse" ADD CONSTRAINT "GoodsPricingFlowWarehouse_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
