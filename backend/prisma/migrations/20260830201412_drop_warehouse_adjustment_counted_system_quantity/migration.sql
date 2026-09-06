/*
  Warnings:

  - You are about to drop the column `countedQuantity` on the `InventoryDocumentLine` table. All the data in the column will be lost.
  - You are about to drop the column `systemQuantity` on the `InventoryDocumentLine` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "InventoryDocumentLine" DROP COLUMN "countedQuantity",
DROP COLUMN "systemQuantity";
