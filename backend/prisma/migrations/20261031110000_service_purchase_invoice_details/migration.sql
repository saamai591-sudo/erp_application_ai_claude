-- CreateTable
CREATE TABLE "ServicePurchaseInvoiceDetail" (
    "id" SERIAL NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "lineId" INTEGER,
    "detailTypeId" INTEGER NOT NULL,
    "detailCode" TEXT NOT NULL,

    CONSTRAINT "ServicePurchaseInvoiceDetail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServicePurchaseInvoiceDetail_invoiceId_idx" ON "ServicePurchaseInvoiceDetail"("invoiceId");

-- CreateIndex
CREATE INDEX "ServicePurchaseInvoiceDetail_lineId_idx" ON "ServicePurchaseInvoiceDetail"("lineId");

-- یکتایی (ایندکس جزئی؛ Prisma نمی‌تواند مدل کند): هر نوع تفصیل در هدر یک بار و در هر ردیف یک بار
CREATE UNIQUE INDEX "ServicePurchaseInvoiceDetail_header_unique" ON "ServicePurchaseInvoiceDetail"("invoiceId", "detailTypeId") WHERE "lineId" IS NULL;
CREATE UNIQUE INDEX "ServicePurchaseInvoiceDetail_line_unique" ON "ServicePurchaseInvoiceDetail"("lineId", "detailTypeId") WHERE "lineId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "ServicePurchaseInvoiceDetail" ADD CONSTRAINT "ServicePurchaseInvoiceDetail_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "ServicePurchaseInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePurchaseInvoiceDetail" ADD CONSTRAINT "ServicePurchaseInvoiceDetail_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "PurchaseCostLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePurchaseInvoiceDetail" ADD CONSTRAINT "ServicePurchaseInvoiceDetail_detailTypeId_fkey" FOREIGN KEY ("detailTypeId") REFERENCES "DetailType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
