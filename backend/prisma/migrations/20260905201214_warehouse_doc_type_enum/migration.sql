/*
  Warnings:

  - You are about to drop the column `warehouseDocTypeRef` on the `GoodsServiceAccountingSetting` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "GoodsServiceAccountingSetting" DROP COLUMN "warehouseDocTypeRef",
ADD COLUMN     "warehouseDocType" "InventoryDocumentType";
