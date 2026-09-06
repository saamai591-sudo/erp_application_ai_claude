-- AlterEnum
ALTER TYPE "InventoryBasis" ADD VALUE 'WAREHOUSE_TRANSFER_OUT';

-- AlterEnum
BEGIN;
CREATE TYPE "InventoryDocumentType_new" AS ENUM ('INITIAL_INVENTORY', 'WAREHOUSE_RECEIPT', 'WAREHOUSE_TRANSFER_OUT', 'WAREHOUSE_TRANSFER_IN', 'WAREHOUSE_ADJUSTMENT', 'SALES_DELIVERY', 'SALES_RETURN', 'SUPPLIER_RETURN', 'PRODUCTION_RECEIPT', 'CENTER_CONSUMPTION', 'PROJECT_CONSUMPTION', 'PRODUCTION_CONSUMPTION', 'CENTER_CONSUMPTION_RETURN', 'PROJECT_CONSUMPTION_RETURN', 'PRODUCTION_CONSUMPTION_RETURN', 'FIXED_ASSET_ISSUE');
ALTER TABLE "InventoryDocument" ALTER COLUMN "documentType" TYPE "InventoryDocumentType_new" USING ("documentType"::text::"InventoryDocumentType_new");
ALTER TYPE "InventoryDocumentType" RENAME TO "InventoryDocumentType_old";
ALTER TYPE "InventoryDocumentType_new" RENAME TO "InventoryDocumentType";
DROP TYPE "InventoryDocumentType_old";
COMMIT;

-- AlterTable
ALTER TABLE "InventoryDocumentLine" ADD COLUMN     "sourceWarehouseTransferOutLineId" INTEGER;

-- AddForeignKey
ALTER TABLE "InventoryDocumentLine" ADD CONSTRAINT "InventoryDocumentLine_sourceWarehouseTransferOutLineId_fkey" FOREIGN KEY ("sourceWarehouseTransferOutLineId") REFERENCES "InventoryDocumentLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

