-- AlterTable
ALTER TABLE "WarehouseIssue" ADD COLUMN     "costCenterId" INTEGER,
ADD COLUMN     "projectId" INTEGER;

-- AlterTable
ALTER TABLE "WarehouseReceipt" ADD COLUMN     "partyId" INTEGER;

-- AddForeignKey
ALTER TABLE "WarehouseReceipt" ADD CONSTRAINT "WarehouseReceipt_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseIssue" ADD CONSTRAINT "WarehouseIssue_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseIssue" ADD CONSTRAINT "WarehouseIssue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
