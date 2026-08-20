-- AlterEnum
BEGIN;
CREATE TYPE "InventoryDocumentType_new" AS ENUM ('INITIAL_INVENTORY', 'WAREHOUSE_RECEIPT', 'WAREHOUSE_TRANSFER', 'WAREHOUSE_ADJUSTMENT', 'SALES_DELIVERY', 'SALES_RETURN', 'SUPPLIER_RETURN', 'PRODUCTION_RECEIPT', 'CENTER_CONSUMPTION', 'PROJECT_CONSUMPTION', 'PRODUCTION_CONSUMPTION', 'CENTER_CONSUMPTION_RETURN', 'PROJECT_CONSUMPTION_RETURN', 'PRODUCTION_CONSUMPTION_RETURN', 'FIXED_ASSET_ISSUE');
ALTER TABLE "InventoryDocument" ALTER COLUMN "documentType" TYPE "InventoryDocumentType_new" USING ("documentType"::text::"InventoryDocumentType_new");
ALTER TYPE "InventoryDocumentType" RENAME TO "InventoryDocumentType_old";
ALTER TYPE "InventoryDocumentType_new" RENAME TO "InventoryDocumentType";
DROP TYPE "InventoryDocumentType_old";
COMMIT;

-- AlterTable
ALTER TABLE "InventoryDocumentLine" ADD COLUMN     "sourceCenterConsumptionLineId" INTEGER,
ADD COLUMN     "sourceProductionConsumptionLineId" INTEGER,
ADD COLUMN     "sourceProjectConsumptionLineId" INTEGER,
ADD COLUMN     "sourceSalesDeliveryLineId" INTEGER,
ADD COLUMN     "sourceWarehouseReceiptLineId" INTEGER;

-- AddForeignKey
ALTER TABLE "InventoryDocumentLine" ADD CONSTRAINT "InventoryDocumentLine_sourceSalesDeliveryLineId_fkey" FOREIGN KEY ("sourceSalesDeliveryLineId") REFERENCES "InventoryDocumentLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryDocumentLine" ADD CONSTRAINT "InventoryDocumentLine_sourceWarehouseReceiptLineId_fkey" FOREIGN KEY ("sourceWarehouseReceiptLineId") REFERENCES "InventoryDocumentLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryDocumentLine" ADD CONSTRAINT "InventoryDocumentLine_sourceCenterConsumptionLineId_fkey" FOREIGN KEY ("sourceCenterConsumptionLineId") REFERENCES "InventoryDocumentLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryDocumentLine" ADD CONSTRAINT "InventoryDocumentLine_sourceProjectConsumptionLineId_fkey" FOREIGN KEY ("sourceProjectConsumptionLineId") REFERENCES "InventoryDocumentLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryDocumentLine" ADD CONSTRAINT "InventoryDocumentLine_sourceProductionConsumptionLineId_fkey" FOREIGN KEY ("sourceProductionConsumptionLineId") REFERENCES "InventoryDocumentLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
