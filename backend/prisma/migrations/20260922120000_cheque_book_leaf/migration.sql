-- CreateEnum
CREATE TYPE "ChequeBookLeafStatus" AS ENUM ('RAW', 'ISSUED', 'VOID');

-- CreateTable
CREATE TABLE "ChequeBookLeaf" (
    "id" SERIAL NOT NULL,
    "bankAccountId" INTEGER NOT NULL,
    "series" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "printTemplate" TEXT,
    "status" "ChequeBookLeafStatus" NOT NULL DEFAULT 'RAW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChequeBookLeaf_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChequeBookLeaf_bankAccountId_number_key" ON "ChequeBookLeaf"("bankAccountId", "number");

-- AddForeignKey
ALTER TABLE "ChequeBookLeaf" ADD CONSTRAINT "ChequeBookLeaf_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "PaymentInstrumentLine" ADD COLUMN "chequeBookLeafId" INTEGER;

-- AddForeignKey
ALTER TABLE "PaymentInstrumentLine" ADD CONSTRAINT "PaymentInstrumentLine_chequeBookLeafId_fkey" FOREIGN KEY ("chequeBookLeafId") REFERENCES "ChequeBookLeaf"("id") ON DELETE SET NULL ON UPDATE CASCADE;
