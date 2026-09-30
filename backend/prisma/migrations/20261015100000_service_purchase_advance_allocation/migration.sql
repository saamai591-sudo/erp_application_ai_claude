-- تخصیص پیش‌پرداخت به فاکتور خرید خدمات (هم‌الگوی PurchaseInvoiceAdvanceAllocation)
CREATE TABLE "ServicePurchaseInvoiceAdvanceAllocation" (
    "id" SERIAL NOT NULL,
    "servicePurchaseInvoiceId" INTEGER NOT NULL,
    "paymentSettlementLineId" INTEGER NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServicePurchaseInvoiceAdvanceAllocation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SPIAdvanceAlloc_invoice_line_key" ON "ServicePurchaseInvoiceAdvanceAllocation"("servicePurchaseInvoiceId", "paymentSettlementLineId");
ALTER TABLE "ServicePurchaseInvoiceAdvanceAllocation" ADD CONSTRAINT "SPIAdvanceAlloc_invoiceId_fkey" FOREIGN KEY ("servicePurchaseInvoiceId") REFERENCES "ServicePurchaseInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServicePurchaseInvoiceAdvanceAllocation" ADD CONSTRAINT "SPIAdvanceAlloc_lineId_fkey" FOREIGN KEY ("paymentSettlementLineId") REFERENCES "PaymentSettlementLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
