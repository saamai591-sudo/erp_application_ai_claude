-- مرکز هزینه‌ی تولید: بهای تمام‌شده‌ی تولید از سطح دستور به سطح مرکز هزینه رفت.
-- ستون‌های «دستور» از پای کار و تسهیم مخزن حذف و «مرکز هزینه» جایگزین می‌شود؛ این داده‌ها قابل تبدیل نیستند، پس اگر محاسبه یا پای کاری ثبت شده باشد مهاجرت متوقف می‌شود.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "ProductionCostRun") OR EXISTS (SELECT 1 FROM "WipCountLine") OR EXISTS (SELECT 1 FROM "ProductionCostPoolAlloc") THEN
    RAISE EXCEPTION 'محاسبه‌ی بهای تمام‌شده یا فرم موجودی پای کار مبتنی بر دستور تولید وجود دارد؛ ابتدا محاسبه‌ها را حذف و فرم‌های پای کار را پاک کنید و دوباره اجرا کنید';
  END IF;
END $$;

-- AlterEnum
ALTER TYPE "InventoryBasis" ADD VALUE 'PRODUCTION_STAT';

-- DropForeignKey
ALTER TABLE "ProductionCostPoolAlloc" DROP CONSTRAINT "ProductionCostPoolAlloc_productionOrderId_fkey";

-- DropForeignKey
ALTER TABLE "WipCountLine" DROP CONSTRAINT "WipCountLine_productionOrderId_fkey";

-- AlterTable
ALTER TABLE "InventoryDocumentLine" ADD COLUMN     "sourceProductionStatLineId" INTEGER;

-- AlterTable
ALTER TABLE "ProductionCostPoolAlloc" DROP COLUMN "productionOrderId",
ADD COLUMN     "costCenterId" INTEGER NOT NULL,
ADD COLUMN     "direct" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "WipCountLine" DROP COLUMN "productionOrderId",
ADD COLUMN     "costCenterId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "ProductionStat" (
    "id" SERIAL NOT NULL,
    "number" INTEGER NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "costCenterId" INTEGER NOT NULL,
    "description" TEXT,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

CONSTRAINT "ProductionStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionStatLine" (
    "id" SERIAL NOT NULL,
    "statId" INTEGER NOT NULL,
    "goodsItemId" INTEGER NOT NULL,
    "productionOrderId" INTEGER,
    "quantity" DECIMAL(36,10) NOT NULL,
    "scrapQuantity" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "note" TEXT,

CONSTRAINT "ProductionStatLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionDelivery" (
    "id" SERIAL NOT NULL,
    "number" INTEGER NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "fromCostCenterId" INTEGER NOT NULL,
    "toCostCenterId" INTEGER NOT NULL,
    "description" TEXT,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

CONSTRAINT "ProductionDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionDeliveryLine" (
    "id" SERIAL NOT NULL,
    "deliveryId" INTEGER NOT NULL,
    "statLineId" INTEGER NOT NULL,
    "goodsItemId" INTEGER NOT NULL,
    "quantity" DECIMAL(36,10) NOT NULL,
    "amount" DECIMAL(36,10),
    "note" TEXT,

CONSTRAINT "ProductionDeliveryLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionCostCenter" (
    "id" SERIAL NOT NULL,
    "runId" INTEGER NOT NULL,
    "costCenterId" INTEGER NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "materialCost" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "transferredIn" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "conversionDirect" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "conversionAllocated" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "openCarryMaterial" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "openCarryConversion" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "endCarryMaterial" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "endCarryConversion" DECIMAL(36,10) NOT NULL DEFAULT 0,

CONSTRAINT "ProductionCostCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionCostCenterItem" (
    "id" SERIAL NOT NULL,
    "runId" INTEGER NOT NULL,
    "costCenterId" INTEGER NOT NULL,
    "goodsItemId" INTEGER NOT NULL,
    "finishedQty" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "openingWipQty" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "openingWipPercent" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "openingWipMaterial" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "openingWipConversion" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "wipQty" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "wipPercent" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "materialCost" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "conversionCost" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "unitMaterial" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "unitConversion" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "finishedValue" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "receiptQty" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "receiptValue" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "deliveredQty" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "deliveredValue" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "heldOpenQty" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "heldOpenValue" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "heldEndQty" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "heldEndValue" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "endingWipMaterial" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "endingWipConversion" DECIMAL(36,10) NOT NULL DEFAULT 0,

CONSTRAINT "ProductionCostCenterItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductionStat_costCenterId_date_idx" ON "ProductionStat"("costCenterId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionStat_fiscalPeriodId_number_key" ON "ProductionStat"("fiscalPeriodId", "number");

-- CreateIndex
CREATE INDEX "ProductionStatLine_statId_idx" ON "ProductionStatLine"("statId");

-- CreateIndex
CREATE INDEX "ProductionDelivery_fromCostCenterId_date_idx" ON "ProductionDelivery"("fromCostCenterId", "date");

-- CreateIndex
CREATE INDEX "ProductionDelivery_toCostCenterId_date_idx" ON "ProductionDelivery"("toCostCenterId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionDelivery_fiscalPeriodId_number_key" ON "ProductionDelivery"("fiscalPeriodId", "number");

-- CreateIndex
CREATE INDEX "ProductionDeliveryLine_deliveryId_idx" ON "ProductionDeliveryLine"("deliveryId");

-- CreateIndex
CREATE INDEX "ProductionDeliveryLine_statLineId_idx" ON "ProductionDeliveryLine"("statLineId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionCostCenter_runId_costCenterId_key" ON "ProductionCostCenter"("runId", "costCenterId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionCostCenterItem_runId_costCenterId_goodsItemId_key" ON "ProductionCostCenterItem"("runId", "costCenterId", "goodsItemId");

-- AddForeignKey
ALTER TABLE "InventoryDocumentLine" ADD CONSTRAINT "InventoryDocumentLine_sourceProductionStatLineId_fkey" FOREIGN KEY ("sourceProductionStatLineId") REFERENCES "ProductionStatLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WipCountLine" ADD CONSTRAINT "WipCountLine_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionCostPoolAlloc" ADD CONSTRAINT "ProductionCostPoolAlloc_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionStat" ADD CONSTRAINT "ProductionStat_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionStat" ADD CONSTRAINT "ProductionStat_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionStatLine" ADD CONSTRAINT "ProductionStatLine_statId_fkey" FOREIGN KEY ("statId") REFERENCES "ProductionStat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionStatLine" ADD CONSTRAINT "ProductionStatLine_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionStatLine" ADD CONSTRAINT "ProductionStatLine_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionDelivery" ADD CONSTRAINT "ProductionDelivery_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionDelivery" ADD CONSTRAINT "ProductionDelivery_fromCostCenterId_fkey" FOREIGN KEY ("fromCostCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionDelivery" ADD CONSTRAINT "ProductionDelivery_toCostCenterId_fkey" FOREIGN KEY ("toCostCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionDeliveryLine" ADD CONSTRAINT "ProductionDeliveryLine_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "ProductionDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionDeliveryLine" ADD CONSTRAINT "ProductionDeliveryLine_statLineId_fkey" FOREIGN KEY ("statLineId") REFERENCES "ProductionStatLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionDeliveryLine" ADD CONSTRAINT "ProductionDeliveryLine_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionCostCenter" ADD CONSTRAINT "ProductionCostCenter_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ProductionCostRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionCostCenter" ADD CONSTRAINT "ProductionCostCenter_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionCostCenterItem" ADD CONSTRAINT "ProductionCostCenterItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ProductionCostRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionCostCenterItem" ADD CONSTRAINT "ProductionCostCenterItem_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionCostCenterItem" ADD CONSTRAINT "ProductionCostCenterItem_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
