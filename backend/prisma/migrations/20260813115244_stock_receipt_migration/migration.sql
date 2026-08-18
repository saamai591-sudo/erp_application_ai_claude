-- CreateEnum
CREATE TYPE "WarehouseReceiptBasis" AS ENUM ('NO_BASIS', 'SUPPLY_REQUEST', 'PURCHASE_ORDER', 'DELIVERY_AUTHORIZATION');

-- CreateTable
CREATE TABLE "WarehouseReceipt" (
    "id" SERIAL NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "basis" "WarehouseReceiptBasis" NOT NULL,
    "description" TEXT,
    "status" "WarehouseDocStatus" NOT NULL DEFAULT 'DRAFT',
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarehouseReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseReceiptLine" (
    "id" SERIAL NOT NULL,
    "warehouseReceiptId" INTEGER NOT NULL,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,
    "sourceSupplyRequestLineId" INTEGER,
    "sourcePurchaseOrderLineId" INTEGER,
    "sourceDeliveryAuthorizationLineId" INTEGER,
    "goodsItemId" INTEGER NOT NULL,
    "unitId" INTEGER NOT NULL,
    "quantity" DECIMAL(36,10) NOT NULL,
    "unitCost" DECIMAL(28,10) NOT NULL DEFAULT 0,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "description" TEXT,

    CONSTRAINT "WarehouseReceiptLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseReceipt_fiscalPeriodId_number_key" ON "WarehouseReceipt"("fiscalPeriodId", "number");

-- AddForeignKey
ALTER TABLE "WarehouseReceipt" ADD CONSTRAINT "WarehouseReceipt_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseReceipt" ADD CONSTRAINT "WarehouseReceipt_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseReceiptLine" ADD CONSTRAINT "WarehouseReceiptLine_warehouseReceiptId_fkey" FOREIGN KEY ("warehouseReceiptId") REFERENCES "WarehouseReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseReceiptLine" ADD CONSTRAINT "WarehouseReceiptLine_sourceSupplyRequestLineId_fkey" FOREIGN KEY ("sourceSupplyRequestLineId") REFERENCES "SupplyRequestLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseReceiptLine" ADD CONSTRAINT "WarehouseReceiptLine_sourcePurchaseOrderLineId_fkey" FOREIGN KEY ("sourcePurchaseOrderLineId") REFERENCES "PurchaseOrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseReceiptLine" ADD CONSTRAINT "WarehouseReceiptLine_sourceDeliveryAuthorizationLineId_fkey" FOREIGN KEY ("sourceDeliveryAuthorizationLineId") REFERENCES "DeliveryAuthorizationLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseReceiptLine" ADD CONSTRAINT "WarehouseReceiptLine_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseReceiptLine" ADD CONSTRAINT "WarehouseReceiptLine_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
