-- AlterEnum
ALTER TYPE "PaymentNature" ADD VALUE 'TO_BANK';
ALTER TYPE "PaymentNature" ADD VALUE 'TO_CASH_BOX';

-- AlterTable
ALTER TABLE "PaymentSettlementLine" ALTER COLUMN "partyId" DROP NOT NULL;
ALTER TABLE "PaymentSettlementLine" ADD COLUMN "bankAccountId" INTEGER,
ADD COLUMN "cashBoxId" INTEGER;

-- AddForeignKey
ALTER TABLE "PaymentSettlementLine" ADD CONSTRAINT "PaymentSettlementLine_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentSettlementLine" ADD CONSTRAINT "PaymentSettlementLine_cashBoxId_fkey" FOREIGN KEY ("cashBoxId") REFERENCES "CashBox"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
