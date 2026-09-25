-- حواله فروش بر مبنای پیش‌فاکتور
ALTER TYPE "InventoryBasis" ADD VALUE 'SALES_QUOTE';

-- AlterTable
ALTER TABLE "InventoryDocumentLine" ADD COLUMN "sourceSalesQuoteLineId" INTEGER;

-- AddForeignKey
ALTER TABLE "InventoryDocumentLine" ADD CONSTRAINT "InventoryDocumentLine_sourceSalesQuoteLineId_fkey" FOREIGN KEY ("sourceSalesQuoteLineId") REFERENCES "SalesQuoteLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
