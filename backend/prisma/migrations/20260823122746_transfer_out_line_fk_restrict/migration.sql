-- DropForeignKey
ALTER TABLE "InventoryDocumentLine" DROP CONSTRAINT "InventoryDocumentLine_sourceWarehouseTransferOutLineId_fkey";

-- AddForeignKey
ALTER TABLE "InventoryDocumentLine" ADD CONSTRAINT "InventoryDocumentLine_sourceWarehouseTransferOutLineId_fkey" FOREIGN KEY ("sourceWarehouseTransferOutLineId") REFERENCES "InventoryDocumentLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

