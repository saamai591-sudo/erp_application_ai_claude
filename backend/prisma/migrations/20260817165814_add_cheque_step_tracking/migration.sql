-- AlterTable
ALTER TABLE "ChequeClearingPayableLine" ADD COLUMN     "chequeStep" INTEGER;

-- AlterTable
ALTER TABLE "ChequeClearingReceivableLine" ADD COLUMN     "chequeStep" INTEGER;

-- AlterTable
ALTER TABLE "ChequeDepositLine" ADD COLUMN     "chequeStep" INTEGER;

-- AlterTable
ALTER TABLE "ChequeDepositReturnLine" ADD COLUMN     "chequeStep" INTEGER;

-- AlterTable
ALTER TABLE "ChequeItem" ADD COLUMN     "step" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "PaymentInstrumentLine" ADD COLUMN     "chequeStep" INTEGER;

-- AlterTable
ALTER TABLE "ReceiptInstrumentLine" ADD COLUMN     "chequeStep" INTEGER;
