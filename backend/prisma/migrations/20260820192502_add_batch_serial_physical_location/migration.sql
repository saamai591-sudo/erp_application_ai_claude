-- CreateEnum
CREATE TYPE "BatchSourceType" AS ENUM ('MANUAL', 'PURCHASE', 'PRODUCTION');

-- CreateTable
CREATE TABLE "PhysicalLocation" (
    "id" SERIAL NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "parentId" INTEGER,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hasTransactions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhysicalLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" SERIAL NOT NULL,
    "goodsItemId" INTEGER NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "productionDate" DATE,
    "expiryDate" DATE,
    "sourceType" "BatchSourceType" NOT NULL DEFAULT 'MANUAL',
    "supplierId" INTEGER,
    "productionReferenceId" INTEGER,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hasTransactions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Serial" (
    "id" SERIAL NOT NULL,
    "goodsItemId" INTEGER NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hasTransactions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Serial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PhysicalLocation_warehouseId_parentId_code_key" ON "PhysicalLocation"("warehouseId", "parentId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_goodsItemId_batchNumber_key" ON "Batch"("goodsItemId", "batchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Serial_goodsItemId_serialNumber_key" ON "Serial"("goodsItemId", "serialNumber");

-- AddForeignKey
ALTER TABLE "PhysicalLocation" ADD CONSTRAINT "PhysicalLocation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhysicalLocation" ADD CONSTRAINT "PhysicalLocation_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PhysicalLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Serial" ADD CONSTRAINT "Serial_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
