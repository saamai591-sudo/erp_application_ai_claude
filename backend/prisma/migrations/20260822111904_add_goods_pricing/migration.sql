-- CreateTable
CREATE TABLE "GoodsPricingStatus" (
    "id" SERIAL NOT NULL,
    "goodsItemId" INTEGER NOT NULL,
    "reportingPeriodId" INTEGER NOT NULL,
    "pricedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER,

    CONSTRAINT "GoodsPricingStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsPricingAdjustment" (
    "id" SERIAL NOT NULL,
    "statusId" INTEGER NOT NULL,
    "lineId" INTEGER NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoodsPricingAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoodsPricingStatus_goodsItemId_reportingPeriodId_key" ON "GoodsPricingStatus"("goodsItemId", "reportingPeriodId");

-- AddForeignKey
ALTER TABLE "GoodsPricingStatus" ADD CONSTRAINT "GoodsPricingStatus_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsPricingStatus" ADD CONSTRAINT "GoodsPricingStatus_reportingPeriodId_fkey" FOREIGN KEY ("reportingPeriodId") REFERENCES "ReportingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsPricingStatus" ADD CONSTRAINT "GoodsPricingStatus_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsPricingAdjustment" ADD CONSTRAINT "GoodsPricingAdjustment_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "GoodsPricingStatus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsPricingAdjustment" ADD CONSTRAINT "GoodsPricingAdjustment_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "InventoryDocumentLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
