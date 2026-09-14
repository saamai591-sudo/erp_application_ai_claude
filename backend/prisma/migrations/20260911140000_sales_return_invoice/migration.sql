-- CreateEnum
CREATE TYPE "SalesReturnInvoiceBasis" AS ENUM ('NO_BASIS', 'SALES_RETURN');

-- CreateTable
CREATE TABLE "SalesReturnInvoice" (
    "id" SERIAL NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "basis" "SalesReturnInvoiceBasis" NOT NULL,
    "customerId" INTEGER NOT NULL,
    "salesTypeId" INTEGER NOT NULL,
    "salesCenterId" INTEGER NOT NULL,
    "currencyId" INTEGER NOT NULL,
    "fxRate" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "description" TEXT,
    "status" "SalesDocStatus" NOT NULL DEFAULT 'DRAFT',
    "journalEntryId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesReturnInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesReturnInvoiceLine" (
    "id" SERIAL NOT NULL,
    "salesReturnInvoiceId" INTEGER NOT NULL,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,
    "sourceInventoryLineId" INTEGER,
    "goodsItemId" INTEGER NOT NULL,
    "unitId" INTEGER NOT NULL,
    "quantity" DECIMAL(36,10) NOT NULL,
    "unitPrice" DECIMAL(36,10) NOT NULL,
    "amount" DECIMAL(36,10) NOT NULL,
    "discount" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "baseAmount" DECIMAL(36,10) NOT NULL,
    "baseDiscount" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "vatAmount" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "description" TEXT,

    CONSTRAINT "SalesReturnInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesReturnInvoice_journalEntryId_key" ON "SalesReturnInvoice"("journalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesReturnInvoice_fiscalPeriodId_number_key" ON "SalesReturnInvoice"("fiscalPeriodId", "number");

-- AddForeignKey
ALTER TABLE "SalesReturnInvoice" ADD CONSTRAINT "SalesReturnInvoice_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReturnInvoice" ADD CONSTRAINT "SalesReturnInvoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReturnInvoice" ADD CONSTRAINT "SalesReturnInvoice_salesTypeId_fkey" FOREIGN KEY ("salesTypeId") REFERENCES "SalesType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReturnInvoice" ADD CONSTRAINT "SalesReturnInvoice_salesCenterId_fkey" FOREIGN KEY ("salesCenterId") REFERENCES "SalesCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReturnInvoice" ADD CONSTRAINT "SalesReturnInvoice_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReturnInvoice" ADD CONSTRAINT "SalesReturnInvoice_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReturnInvoiceLine" ADD CONSTRAINT "SalesReturnInvoiceLine_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReturnInvoiceLine" ADD CONSTRAINT "SalesReturnInvoiceLine_salesReturnInvoiceId_fkey" FOREIGN KEY ("salesReturnInvoiceId") REFERENCES "SalesReturnInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReturnInvoiceLine" ADD CONSTRAINT "SalesReturnInvoiceLine_sourceInventoryLineId_fkey" FOREIGN KEY ("sourceInventoryLineId") REFERENCES "InventoryDocumentLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesReturnInvoiceLine" ADD CONSTRAINT "SalesReturnInvoiceLine_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

