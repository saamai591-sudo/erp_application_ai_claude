-- AlterEnum
ALTER TYPE "DocumentAmountPriceType" ADD VALUE 'INBOUND_RELATED_COST';

-- AlterTable
ALTER TABLE "DocumentItemAmount" ADD COLUMN     "servicePurchaseInvoiceAllocationId" INTEGER;

-- CreateTable
CREATE TABLE "ServicePurchaseInvoice" (
    "id" SERIAL NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "vendorInvoiceNumber" TEXT,
    "partyId" INTEGER NOT NULL,
    "currencyId" INTEGER NOT NULL,
    "description" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'DRAFT',
    "approverId" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServicePurchaseInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePurchaseInvoiceLine" (
    "id" SERIAL NOT NULL,
    "servicePurchaseInvoiceId" INTEGER NOT NULL,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,
    "serviceId" INTEGER NOT NULL,
    "amount" DECIMAL(36,10) NOT NULL,
    "basis" "PurchaseInvoiceBasis" NOT NULL DEFAULT 'NO_BASIS',
    "sourceReceiptDocumentId" INTEGER,
    "allocationMethod" "CostAllocationBasis",
    "description" TEXT,

    CONSTRAINT "ServicePurchaseInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePurchaseInvoiceLineAllocation" (
    "id" SERIAL NOT NULL,
    "servicePurchaseInvoiceLineId" INTEGER NOT NULL,
    "inventoryDocumentLineId" INTEGER NOT NULL,
    "allocatedAmount" DECIMAL(36,10) NOT NULL,

    CONSTRAINT "ServicePurchaseInvoiceLineAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServicePurchaseInvoice_fiscalPeriodId_number_key" ON "ServicePurchaseInvoice"("fiscalPeriodId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "ServicePurchaseInvoiceLineAllocation_servicePurchaseInvoice_key" ON "ServicePurchaseInvoiceLineAllocation"("servicePurchaseInvoiceLineId", "inventoryDocumentLineId");

-- AddForeignKey
ALTER TABLE "ServicePurchaseInvoice" ADD CONSTRAINT "ServicePurchaseInvoice_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePurchaseInvoice" ADD CONSTRAINT "ServicePurchaseInvoice_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePurchaseInvoice" ADD CONSTRAINT "ServicePurchaseInvoice_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePurchaseInvoice" ADD CONSTRAINT "ServicePurchaseInvoice_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePurchaseInvoiceLine" ADD CONSTRAINT "ServicePurchaseInvoiceLine_servicePurchaseInvoiceId_fkey" FOREIGN KEY ("servicePurchaseInvoiceId") REFERENCES "ServicePurchaseInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePurchaseInvoiceLine" ADD CONSTRAINT "ServicePurchaseInvoiceLine_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePurchaseInvoiceLine" ADD CONSTRAINT "ServicePurchaseInvoiceLine_sourceReceiptDocumentId_fkey" FOREIGN KEY ("sourceReceiptDocumentId") REFERENCES "InventoryDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePurchaseInvoiceLineAllocation" ADD CONSTRAINT "ServicePurchaseInvoiceLineAllocation_servicePurchaseInvoic_fkey" FOREIGN KEY ("servicePurchaseInvoiceLineId") REFERENCES "ServicePurchaseInvoiceLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePurchaseInvoiceLineAllocation" ADD CONSTRAINT "ServicePurchaseInvoiceLineAllocation_inventoryDocumentLine_fkey" FOREIGN KEY ("inventoryDocumentLineId") REFERENCES "InventoryDocumentLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentItemAmount" ADD CONSTRAINT "DocumentItemAmount_servicePurchaseInvoiceAllocationId_fkey" FOREIGN KEY ("servicePurchaseInvoiceAllocationId") REFERENCES "ServicePurchaseInvoiceLineAllocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

