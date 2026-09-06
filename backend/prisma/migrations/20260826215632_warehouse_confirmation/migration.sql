-- DropForeignKey
ALTER TABLE "InventoryClosing" DROP CONSTRAINT "InventoryClosing_createdById_fkey";

-- DropForeignKey
ALTER TABLE "InventoryClosing" DROP CONSTRAINT "InventoryClosing_warehouseId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryClosingAudit" DROP CONSTRAINT "InventoryClosingAudit_userId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryClosingAudit" DROP CONSTRAINT "InventoryClosingAudit_warehouseId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryClosingLine" DROP CONSTRAINT "InventoryClosingLine_batchId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryClosingLine" DROP CONSTRAINT "InventoryClosingLine_closingId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryClosingLine" DROP CONSTRAINT "InventoryClosingLine_goodsItemId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryClosingLine" DROP CONSTRAINT "InventoryClosingLine_physicalLocationId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryClosingLine" DROP CONSTRAINT "InventoryClosingLine_serialId_fkey";

-- AlterTable
ALTER TABLE "Warehouse" ADD COLUMN     "confirmedDate" DATE;

-- DropTable
DROP TABLE "InventoryClosing";

-- DropTable
DROP TABLE "InventoryClosingAudit";

-- DropTable
DROP TABLE "InventoryClosingLine";

-- DropEnum
DROP TYPE "InventoryClosingAction";

-- CreateTable
CREATE TABLE "WarehouseConfirmationLine" (
    "id" SERIAL NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "goodsItemId" INTEGER NOT NULL,
    "quantity" DECIMAL(36,10) NOT NULL,

    CONSTRAINT "WarehouseConfirmationLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseConfirmationLine_warehouseId_goodsItemId_key" ON "WarehouseConfirmationLine"("warehouseId", "goodsItemId");

-- AddForeignKey
ALTER TABLE "WarehouseConfirmationLine" ADD CONSTRAINT "WarehouseConfirmationLine_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseConfirmationLine" ADD CONSTRAINT "WarehouseConfirmationLine_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

