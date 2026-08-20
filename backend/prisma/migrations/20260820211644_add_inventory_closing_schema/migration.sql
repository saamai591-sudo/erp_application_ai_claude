-- CreateEnum
CREATE TYPE "InventoryClosingAction" AS ENUM ('CLOSE', 'ROLLBACK');

-- CreateTable
CREATE TABLE "InventoryClosing" (
    "id" SERIAL NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "closingDate" DATE NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER,

    CONSTRAINT "InventoryClosing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryClosingLine" (
    "id" SERIAL NOT NULL,
    "closingId" INTEGER NOT NULL,
    "goodsItemId" INTEGER NOT NULL,
    "physicalLocationId" INTEGER,
    "batchId" INTEGER,
    "serialId" INTEGER,
    "quantity" DECIMAL(36,10) NOT NULL,

    CONSTRAINT "InventoryClosingLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryClosingAudit" (
    "id" SERIAL NOT NULL,
    "action" "InventoryClosingAction" NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "oldClosingDate" DATE,
    "newClosingDate" DATE NOT NULL,
    "reason" TEXT,
    "userId" INTEGER,
    "actionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryClosingAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryClosing_warehouseId_closingDate_idx" ON "InventoryClosing"("warehouseId", "closingDate");

-- AddForeignKey
ALTER TABLE "InventoryClosing" ADD CONSTRAINT "InventoryClosing_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryClosing" ADD CONSTRAINT "InventoryClosing_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryClosingLine" ADD CONSTRAINT "InventoryClosingLine_closingId_fkey" FOREIGN KEY ("closingId") REFERENCES "InventoryClosing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryClosingLine" ADD CONSTRAINT "InventoryClosingLine_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryClosingLine" ADD CONSTRAINT "InventoryClosingLine_physicalLocationId_fkey" FOREIGN KEY ("physicalLocationId") REFERENCES "PhysicalLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryClosingLine" ADD CONSTRAINT "InventoryClosingLine_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryClosingLine" ADD CONSTRAINT "InventoryClosingLine_serialId_fkey" FOREIGN KEY ("serialId") REFERENCES "Serial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryClosingAudit" ADD CONSTRAINT "InventoryClosingAudit_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryClosingAudit" ADD CONSTRAINT "InventoryClosingAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
