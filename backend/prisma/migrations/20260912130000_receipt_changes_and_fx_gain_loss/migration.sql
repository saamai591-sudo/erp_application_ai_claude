-- DropForeignKey
ALTER TABLE "Receipt" DROP CONSTRAINT "Receipt_currencyId_fkey";

-- AlterTable
ALTER TABLE "Receipt" DROP COLUMN "currencyId";

-- AlterTable
ALTER TABLE "ReceiptInstrumentLine" ADD COLUMN     "baseAmount" DECIMAL(36,10) NOT NULL,
ADD COLUMN     "currencyId" INTEGER NOT NULL,
ADD COLUMN     "fxRate" DECIMAL(18,6) NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ReceiptSettlementLine" ADD COLUMN     "currencyId" INTEGER NOT NULL,
ADD COLUMN     "exchangeGainLoss" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "fxRate" DECIMAL(18,6) NOT NULL DEFAULT 1,
ADD COLUMN     "instrumentLineId" INTEGER NOT NULL,
ADD COLUMN     "partyId" INTEGER NOT NULL,
ADD COLUMN     "purchaseInvoiceId" INTEGER,
ADD COLUMN     "receiptTypeId" INTEGER NOT NULL,
ADD COLUMN     "salesOrderId" INTEGER,
ADD COLUMN     "salesQuoteId" INTEGER;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptInstrumentLine" ADD CONSTRAINT "ReceiptInstrumentLine_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptSettlementLine" ADD CONSTRAINT "ReceiptSettlementLine_receiptTypeId_fkey" FOREIGN KEY ("receiptTypeId") REFERENCES "ReceiptType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptSettlementLine" ADD CONSTRAINT "ReceiptSettlementLine_instrumentLineId_fkey" FOREIGN KEY ("instrumentLineId") REFERENCES "ReceiptInstrumentLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptSettlementLine" ADD CONSTRAINT "ReceiptSettlementLine_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptSettlementLine" ADD CONSTRAINT "ReceiptSettlementLine_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptSettlementLine" ADD CONSTRAINT "ReceiptSettlementLine_salesQuoteId_fkey" FOREIGN KEY ("salesQuoteId") REFERENCES "SalesQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptSettlementLine" ADD CONSTRAINT "ReceiptSettlementLine_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptSettlementLine" ADD CONSTRAINT "ReceiptSettlementLine_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


