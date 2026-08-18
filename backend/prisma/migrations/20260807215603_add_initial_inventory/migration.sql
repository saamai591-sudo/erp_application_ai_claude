-- CreateEnum
CREATE TYPE "WarehouseDocStatus" AS ENUM ('DRAFT', 'FINALIZED', 'VOID');

-- CreateEnum
CREATE TYPE "WarehouseDocCreationType" AS ENUM ('MANUAL', 'SYSTEM');

-- CreateTable
CREATE TABLE "InitialInventory" (
    "id" SERIAL NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT,
    "creationType" "WarehouseDocCreationType" NOT NULL DEFAULT 'MANUAL',
    "status" "WarehouseDocStatus" NOT NULL DEFAULT 'DRAFT',
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InitialInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InitialInventoryLine" (
    "id" SERIAL NOT NULL,
    "initialInventoryId" INTEGER NOT NULL,
    "goodsItemId" INTEGER NOT NULL,
    "unitId" INTEGER NOT NULL,
    "quantity" DECIMAL(36,10) NOT NULL,
    "unitCost" DECIMAL(28,10) NOT NULL DEFAULT 0,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InitialInventoryLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InitialInventory_warehouseId_fiscalPeriodId_key" ON "InitialInventory"("warehouseId", "fiscalPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "InitialInventory_fiscalPeriodId_number_key" ON "InitialInventory"("fiscalPeriodId", "number");

-- AddForeignKey
ALTER TABLE "InitialInventory" ADD CONSTRAINT "InitialInventory_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitialInventory" ADD CONSTRAINT "InitialInventory_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitialInventoryLine" ADD CONSTRAINT "InitialInventoryLine_initialInventoryId_fkey" FOREIGN KEY ("initialInventoryId") REFERENCES "InitialInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitialInventoryLine" ADD CONSTRAINT "InitialInventoryLine_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InitialInventoryLine" ADD CONSTRAINT "InitialInventoryLine_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
