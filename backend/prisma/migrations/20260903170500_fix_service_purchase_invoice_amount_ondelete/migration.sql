-- DropForeignKey
ALTER TABLE "DocumentItemAmount" DROP CONSTRAINT "DocumentItemAmount_servicePurchaseInvoiceAllocationId_fkey";

-- AddForeignKey
ALTER TABLE "DocumentItemAmount" ADD CONSTRAINT "DocumentItemAmount_servicePurchaseInvoiceAllocationId_fkey" FOREIGN KEY ("servicePurchaseInvoiceAllocationId") REFERENCES "ServicePurchaseInvoiceLineAllocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

