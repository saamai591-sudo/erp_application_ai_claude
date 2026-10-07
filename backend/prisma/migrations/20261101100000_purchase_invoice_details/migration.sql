-- CreateTable
CREATE TABLE "PurchaseInvoiceDetail" (
    "id" SERIAL NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "lineId" INTEGER,
    "costLineId" INTEGER,
    "detailTypeId" INTEGER NOT NULL,
    "detailCode" TEXT NOT NULL,

    CONSTRAINT "PurchaseInvoiceDetail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseInvoiceDetail_invoiceId_idx" ON "PurchaseInvoiceDetail"("invoiceId");

-- CreateIndex
CREATE INDEX "PurchaseInvoiceDetail_lineId_idx" ON "PurchaseInvoiceDetail"("lineId");

-- CreateIndex
CREATE INDEX "PurchaseInvoiceDetail_costLineId_idx" ON "PurchaseInvoiceDetail"("costLineId");

-- یکتایی (ایندکس جزئی؛ Prisma نمی‌تواند مدل کند): هر نوع تفصیل در هدر یک بار، در هر ردیف کالا یک بار، در هر ردیف سایر هزینه‌ها یک بار
CREATE UNIQUE INDEX "PurchaseInvoiceDetail_header_unique" ON "PurchaseInvoiceDetail"("invoiceId", "detailTypeId") WHERE "lineId" IS NULL AND "costLineId" IS NULL;
CREATE UNIQUE INDEX "PurchaseInvoiceDetail_line_unique" ON "PurchaseInvoiceDetail"("lineId", "detailTypeId") WHERE "lineId" IS NOT NULL;
CREATE UNIQUE INDEX "PurchaseInvoiceDetail_costline_unique" ON "PurchaseInvoiceDetail"("costLineId", "detailTypeId") WHERE "costLineId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "PurchaseInvoiceDetail" ADD CONSTRAINT "PurchaseInvoiceDetail_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoiceDetail" ADD CONSTRAINT "PurchaseInvoiceDetail_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "PurchaseInvoiceLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoiceDetail" ADD CONSTRAINT "PurchaseInvoiceDetail_costLineId_fkey" FOREIGN KEY ("costLineId") REFERENCES "PurchaseCostLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoiceDetail" ADD CONSTRAINT "PurchaseInvoiceDetail_detailTypeId_fkey" FOREIGN KEY ("detailTypeId") REFERENCES "DetailType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
