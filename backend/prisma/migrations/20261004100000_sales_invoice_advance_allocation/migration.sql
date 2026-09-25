-- CreateTable
CREATE TABLE "SalesInvoiceAdvanceAllocation" (
    "id" SERIAL NOT NULL,
    "salesInvoiceId" INTEGER NOT NULL,
    "receiptSettlementLineId" INTEGER NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesInvoiceAdvanceAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesInvoiceAdvanceAllocation_salesInvoiceId_receiptSettlementLineId_key" ON "SalesInvoiceAdvanceAllocation"("salesInvoiceId", "receiptSettlementLineId");

-- AddForeignKey
ALTER TABLE "SalesInvoiceAdvanceAllocation" ADD CONSTRAINT "SalesInvoiceAdvanceAllocation_salesInvoiceId_fkey" FOREIGN KEY ("salesInvoiceId") REFERENCES "SalesInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesInvoiceAdvanceAllocation" ADD CONSTRAINT "SalesInvoiceAdvanceAllocation_receiptSettlementLineId_fkey" FOREIGN KEY ("receiptSettlementLineId") REFERENCES "ReceiptSettlementLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
