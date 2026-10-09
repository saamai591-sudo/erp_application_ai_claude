-- فاکتور خرید خدمات به‌عنوان سند مبنا در اعلامیه پرداخت، پرداخت تنخواه و خلاصه‌ی تنخواه (افزایشی؛ داده‌ی موجود دست‌نخورده)
ALTER TABLE "PaymentSettlementLine" ADD COLUMN "servicePurchaseInvoiceId" INTEGER;
ALTER TABLE "PettyCashPayment" ADD COLUMN "servicePurchaseInvoiceId" INTEGER;
ALTER TABLE "PettyCashSummaryLine" ADD COLUMN "servicePurchaseInvoiceId" INTEGER;

ALTER TABLE "PaymentSettlementLine" ADD CONSTRAINT "PaymentSettlementLine_servicePurchaseInvoiceId_fkey" FOREIGN KEY ("servicePurchaseInvoiceId") REFERENCES "ServicePurchaseInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PettyCashPayment" ADD CONSTRAINT "PettyCashPayment_servicePurchaseInvoiceId_fkey" FOREIGN KEY ("servicePurchaseInvoiceId") REFERENCES "ServicePurchaseInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PettyCashSummaryLine" ADD CONSTRAINT "PettyCashSummaryLine_servicePurchaseInvoiceId_fkey" FOREIGN KEY ("servicePurchaseInvoiceId") REFERENCES "ServicePurchaseInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
