-- CreateEnum
CREATE TYPE "InventoryDocumentType" AS ENUM ('INITIAL_INVENTORY', 'WAREHOUSE_RECEIPT', 'WAREHOUSE_ISSUE', 'WAREHOUSE_TRANSFER', 'WAREHOUSE_ADJUSTMENT', 'SALES_DELIVERY');

-- CreateEnum
CREATE TYPE "InventoryBasis" AS ENUM ('NO_BASIS', 'SUPPLY_REQUEST', 'PURCHASE_ORDER', 'DELIVERY_AUTHORIZATION', 'GOODS_REQUEST', 'SALES_ORDER');

-- CreateTable
CREATE TABLE "InventoryDocument" (
    "id" SERIAL NOT NULL,
    "documentType" "InventoryDocumentType" NOT NULL,
    "warehouseId" INTEGER,
    "sourceWarehouseId" INTEGER,
    "destWarehouseId" INTEGER,
    "fiscalPeriodId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "basis" "InventoryBasis",
    "partyId" INTEGER,
    "costCenterId" INTEGER,
    "projectId" INTEGER,
    "description" TEXT,
    "status" "WarehouseDocStatus" NOT NULL DEFAULT 'DRAFT',
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryDocumentLine" (
    "id" SERIAL NOT NULL,
    "documentId" INTEGER NOT NULL,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,
    "goodsItemId" INTEGER NOT NULL,
    "unitId" INTEGER NOT NULL,
    "quantity" DECIMAL(36,10) NOT NULL,
    "systemQuantity" DECIMAL(36,10),
    "countedQuantity" DECIMAL(36,10),
    "unitCost" DECIMAL(28,10) NOT NULL DEFAULT 0,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "description" TEXT,
    "batchId" INTEGER,
    "physicalLocationId" INTEGER,
    "sourceSupplyRequestLineId" INTEGER,
    "sourcePurchaseOrderLineId" INTEGER,
    "sourceDeliveryAuthorizationLineId" INTEGER,
    "sourceGoodsRequestLineId" INTEGER,
    "sourceSalesOrderLineId" INTEGER,

    CONSTRAINT "InventoryDocumentLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLineSerial" (
    "id" SERIAL NOT NULL,
    "lineId" INTEGER NOT NULL,
    "serialId" INTEGER NOT NULL,

    CONSTRAINT "InventoryLineSerial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryDocument_documentType_fiscalPeriodId_number_key" ON "InventoryDocument"("documentType", "fiscalPeriodId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLineSerial_lineId_serialId_key" ON "InventoryLineSerial"("lineId", "serialId");

-- AddForeignKey
ALTER TABLE "InventoryDocument" ADD CONSTRAINT "InventoryDocument_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryDocument" ADD CONSTRAINT "InventoryDocument_sourceWarehouseId_fkey" FOREIGN KEY ("sourceWarehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryDocument" ADD CONSTRAINT "InventoryDocument_destWarehouseId_fkey" FOREIGN KEY ("destWarehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryDocument" ADD CONSTRAINT "InventoryDocument_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryDocument" ADD CONSTRAINT "InventoryDocument_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryDocument" ADD CONSTRAINT "InventoryDocument_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryDocument" ADD CONSTRAINT "InventoryDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryDocumentLine" ADD CONSTRAINT "InventoryDocumentLine_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "InventoryDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryDocumentLine" ADD CONSTRAINT "InventoryDocumentLine_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryDocumentLine" ADD CONSTRAINT "InventoryDocumentLine_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryDocumentLine" ADD CONSTRAINT "InventoryDocumentLine_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryDocumentLine" ADD CONSTRAINT "InventoryDocumentLine_physicalLocationId_fkey" FOREIGN KEY ("physicalLocationId") REFERENCES "PhysicalLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryDocumentLine" ADD CONSTRAINT "InventoryDocumentLine_sourceSupplyRequestLineId_fkey" FOREIGN KEY ("sourceSupplyRequestLineId") REFERENCES "SupplyRequestLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryDocumentLine" ADD CONSTRAINT "InventoryDocumentLine_sourcePurchaseOrderLineId_fkey" FOREIGN KEY ("sourcePurchaseOrderLineId") REFERENCES "PurchaseOrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryDocumentLine" ADD CONSTRAINT "InventoryDocumentLine_sourceDeliveryAuthorizationLineId_fkey" FOREIGN KEY ("sourceDeliveryAuthorizationLineId") REFERENCES "DeliveryAuthorizationLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryDocumentLine" ADD CONSTRAINT "InventoryDocumentLine_sourceGoodsRequestLineId_fkey" FOREIGN KEY ("sourceGoodsRequestLineId") REFERENCES "GoodsRequestLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryDocumentLine" ADD CONSTRAINT "InventoryDocumentLine_sourceSalesOrderLineId_fkey" FOREIGN KEY ("sourceSalesOrderLineId") REFERENCES "SalesOrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLineSerial" ADD CONSTRAINT "InventoryLineSerial_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "InventoryDocumentLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLineSerial" ADD CONSTRAINT "InventoryLineSerial_serialId_fkey" FOREIGN KEY ("serialId") REFERENCES "Serial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
