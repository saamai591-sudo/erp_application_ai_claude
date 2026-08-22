-- AlterTable
ALTER TABLE "PurchaseInvoice" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approverId" INTEGER;

-- AddForeignKey
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
