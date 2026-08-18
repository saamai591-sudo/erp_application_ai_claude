-- CreateEnum
CREATE TYPE "PurchaseInvoiceBasis" AS ENUM ('NO_BASIS', 'WAREHOUSE_RECEIPT');

-- CreateEnum
CREATE TYPE "CostAllocationBasis" AS ENUM ('VALUE', 'QUANTITY', 'WEIGHT');

-- CreateTable
CREATE TABLE "PurchaseInvoice" (
    "id" SERIAL NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "vendorInvoiceNumber" TEXT,
    "basis" "PurchaseInvoiceBasis" NOT NULL,
    "partyId" INTEGER NOT NULL,
    "currencyId" INTEGER NOT NULL,
    "description" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseInvoiceLine" (
    "id" SERIAL NOT NULL,
    "purchaseInvoiceId" INTEGER NOT NULL,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,
    "sourceWarehouseReceiptLineId" INTEGER,
    "goodsItemId" INTEGER NOT NULL,
    "unitId" INTEGER NOT NULL,
    "quantity" DECIMAL(36,10) NOT NULL,
    "unitPrice" DECIMAL(36,10) NOT NULL,
    "amount" DECIMAL(36,10) NOT NULL,
    "description" TEXT,

    CONSTRAINT "PurchaseInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseInvoiceOtherCostLine" (
    "id" SERIAL NOT NULL,
    "purchaseInvoiceId" INTEGER NOT NULL,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,
    "serviceId" INTEGER NOT NULL,
    "amount" DECIMAL(36,10) NOT NULL DEFAULT 0,
    "allocationBasis" "CostAllocationBasis",
    "description" TEXT,

    CONSTRAINT "PurchaseInvoiceOtherCostLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseInvoice_fiscalPeriodId_number_key" ON "PurchaseInvoice"("fiscalPeriodId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseInvoiceLine_sourceWarehouseReceiptLineId_key" ON "PurchaseInvoiceLine"("sourceWarehouseReceiptLineId");

-- AddForeignKey
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoiceLine" ADD CONSTRAINT "PurchaseInvoiceLine_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoiceLine" ADD CONSTRAINT "PurchaseInvoiceLine_sourceWarehouseReceiptLineId_fkey" FOREIGN KEY ("sourceWarehouseReceiptLineId") REFERENCES "WarehouseReceiptLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoiceLine" ADD CONSTRAINT "PurchaseInvoiceLine_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoiceLine" ADD CONSTRAINT "PurchaseInvoiceLine_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoiceOtherCostLine" ADD CONSTRAINT "PurchaseInvoiceOtherCostLine_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoiceOtherCostLine" ADD CONSTRAINT "PurchaseInvoiceOtherCostLine_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
