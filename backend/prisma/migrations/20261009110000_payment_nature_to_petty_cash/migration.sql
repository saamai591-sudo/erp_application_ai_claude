-- AlterEnum
ALTER TYPE "PaymentNature" ADD VALUE 'TO_PETTY_CASH';

-- AlterTable
ALTER TABLE "PaymentSettlementLine" ADD COLUMN "custodianId" INTEGER;

-- AddForeignKey
ALTER TABLE "PaymentSettlementLine" ADD CONSTRAINT "PaymentSettlementLine_custodianId_fkey" FOREIGN KEY ("custodianId") REFERENCES "PettyCashCustodian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
