-- DropForeignKey
ALTER TABLE "PurchaseInvoiceLine" DROP CONSTRAINT "PurchaseInvoiceLine_sourceWarehouseReceiptLineId_fkey";

-- DropForeignKey
ALTER TABLE "SalesInvoiceLine" DROP CONSTRAINT "SalesInvoiceLine_sourceSalesDeliveryLineId_fkey";

-- DropIndex
DROP INDEX "PurchaseInvoiceLine_sourceWarehouseReceiptLineId_key";

-- AlterTable
ALTER TABLE "PurchaseInvoiceLine" DROP COLUMN "sourceWarehouseReceiptLineId",
ADD COLUMN     "sourceInventoryLineId" INTEGER;

-- AlterTable
ALTER TABLE "SalesInvoiceLine" DROP COLUMN "sourceSalesDeliveryLineId",
ADD COLUMN     "sourceInventoryLineId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseInvoiceLine_sourceInventoryLineId_key" ON "PurchaseInvoiceLine"("sourceInventoryLineId");

-- AddForeignKey
ALTER TABLE "PurchaseInvoiceLine" ADD CONSTRAINT "PurchaseInvoiceLine_sourceInventoryLineId_fkey" FOREIGN KEY ("sourceInventoryLineId") REFERENCES "InventoryDocumentLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoiceLine" ADD CONSTRAINT "SalesInvoiceLine_sourceInventoryLineId_fkey" FOREIGN KEY ("sourceInventoryLineId") REFERENCES "InventoryDocumentLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

