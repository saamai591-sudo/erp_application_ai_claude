-- Purchase invoice line -> asset receipt line (1:1)
ALTER TABLE "PurchaseInvoiceLine" ADD COLUMN     "sourceAssetReceiptLineId" INTEGER;

CREATE UNIQUE INDEX "PurchaseInvoiceLine_sourceAssetReceiptLineId_key" ON "PurchaseInvoiceLine"("sourceAssetReceiptLineId");

ALTER TABLE "PurchaseInvoiceLine" ADD CONSTRAINT "PurchaseInvoiceLine_sourceAssetReceiptLineId_fkey" FOREIGN KEY ("sourceAssetReceiptLineId") REFERENCES "AssetReceiptLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
