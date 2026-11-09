ALTER TABLE "InventoryDocumentLine" ADD COLUMN "sourceTempReceiptLineId" INTEGER;
ALTER TABLE "InventoryDocumentLine" ADD CONSTRAINT "InventoryDocumentLine_sourceTempReceiptLineId_fkey" FOREIGN KEY ("sourceTempReceiptLineId") REFERENCES "InventoryDocumentLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "InventoryDocumentLine_sourceTempReceiptLineId_idx" ON "InventoryDocumentLine"("sourceTempReceiptLineId");
