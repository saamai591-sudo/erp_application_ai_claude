-- CreateEnum
CREATE TYPE "WarehouseIssueBasis" AS ENUM ('NO_BASIS', 'GOODS_REQUEST');

-- CreateTable
CREATE TABLE "WarehouseIssue" (
    "id" SERIAL NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "basis" "WarehouseIssueBasis" NOT NULL,
    "description" TEXT,
    "status" "WarehouseDocStatus" NOT NULL DEFAULT 'DRAFT',
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarehouseIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseIssueLine" (
    "id" SERIAL NOT NULL,
    "warehouseIssueId" INTEGER NOT NULL,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,
    "sourceGoodsRequestLineId" INTEGER,
    "goodsItemId" INTEGER NOT NULL,
    "unitId" INTEGER NOT NULL,
    "quantity" DECIMAL(36,10) NOT NULL,
    "unitCost" DECIMAL(28,10) NOT NULL DEFAULT 0,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "description" TEXT,

    CONSTRAINT "WarehouseIssueLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseTransfer" (
    "id" SERIAL NOT NULL,
    "sourceWarehouseId" INTEGER NOT NULL,
    "destWarehouseId" INTEGER NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT,
    "status" "WarehouseDocStatus" NOT NULL DEFAULT 'DRAFT',
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarehouseTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseTransferLine" (
    "id" SERIAL NOT NULL,
    "warehouseTransferId" INTEGER NOT NULL,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,
    "goodsItemId" INTEGER NOT NULL,
    "unitId" INTEGER NOT NULL,
    "quantity" DECIMAL(36,10) NOT NULL,
    "unitCost" DECIMAL(28,10) NOT NULL DEFAULT 0,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "description" TEXT,

    CONSTRAINT "WarehouseTransferLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseAdjustment" (
    "id" SERIAL NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT,
    "status" "WarehouseDocStatus" NOT NULL DEFAULT 'DRAFT',
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarehouseAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseAdjustmentLine" (
    "id" SERIAL NOT NULL,
    "warehouseAdjustmentId" INTEGER NOT NULL,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,
    "goodsItemId" INTEGER NOT NULL,
    "unitId" INTEGER NOT NULL,
    "systemQuantity" DECIMAL(36,10) NOT NULL,
    "countedQuantity" DECIMAL(36,10) NOT NULL,
    "adjustmentQuantity" DECIMAL(36,10) NOT NULL,
    "unitCost" DECIMAL(28,10) NOT NULL DEFAULT 0,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "description" TEXT,

    CONSTRAINT "WarehouseAdjustmentLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseIssue_fiscalPeriodId_number_key" ON "WarehouseIssue"("fiscalPeriodId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseTransfer_fiscalPeriodId_number_key" ON "WarehouseTransfer"("fiscalPeriodId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseAdjustment_fiscalPeriodId_number_key" ON "WarehouseAdjustment"("fiscalPeriodId", "number");

-- AddForeignKey
ALTER TABLE "WarehouseIssue" ADD CONSTRAINT "WarehouseIssue_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseIssue" ADD CONSTRAINT "WarehouseIssue_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseIssueLine" ADD CONSTRAINT "WarehouseIssueLine_warehouseIssueId_fkey" FOREIGN KEY ("warehouseIssueId") REFERENCES "WarehouseIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseIssueLine" ADD CONSTRAINT "WarehouseIssueLine_sourceGoodsRequestLineId_fkey" FOREIGN KEY ("sourceGoodsRequestLineId") REFERENCES "GoodsRequestLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseIssueLine" ADD CONSTRAINT "WarehouseIssueLine_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseIssueLine" ADD CONSTRAINT "WarehouseIssueLine_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseTransfer" ADD CONSTRAINT "WarehouseTransfer_sourceWarehouseId_fkey" FOREIGN KEY ("sourceWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseTransfer" ADD CONSTRAINT "WarehouseTransfer_destWarehouseId_fkey" FOREIGN KEY ("destWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseTransfer" ADD CONSTRAINT "WarehouseTransfer_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseTransferLine" ADD CONSTRAINT "WarehouseTransferLine_warehouseTransferId_fkey" FOREIGN KEY ("warehouseTransferId") REFERENCES "WarehouseTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseTransferLine" ADD CONSTRAINT "WarehouseTransferLine_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseTransferLine" ADD CONSTRAINT "WarehouseTransferLine_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseAdjustment" ADD CONSTRAINT "WarehouseAdjustment_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseAdjustment" ADD CONSTRAINT "WarehouseAdjustment_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseAdjustmentLine" ADD CONSTRAINT "WarehouseAdjustmentLine_warehouseAdjustmentId_fkey" FOREIGN KEY ("warehouseAdjustmentId") REFERENCES "WarehouseAdjustment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseAdjustmentLine" ADD CONSTRAINT "WarehouseAdjustmentLine_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseAdjustmentLine" ADD CONSTRAINT "WarehouseAdjustmentLine_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
