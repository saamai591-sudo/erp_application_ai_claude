-- CreateEnum
CREATE TYPE "ChequeClearingOutcome" AS ENUM ('CLEARED', 'BOUNCED');

-- CreateTable
CREATE TABLE "ChequeDeposit" (
    "id" SERIAL NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "bankAccountId" INTEGER NOT NULL,
    "description" TEXT,
    "status" "TreasuryDocStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChequeDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChequeDepositLine" (
    "id" SERIAL NOT NULL,
    "chequeDepositId" INTEGER NOT NULL,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,
    "chequeItemId" INTEGER NOT NULL,

    CONSTRAINT "ChequeDepositLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChequeDepositReturn" (
    "id" SERIAL NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT,
    "status" "TreasuryDocStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChequeDepositReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChequeDepositReturnLine" (
    "id" SERIAL NOT NULL,
    "chequeDepositReturnId" INTEGER NOT NULL,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,
    "chequeItemId" INTEGER NOT NULL,

    CONSTRAINT "ChequeDepositReturnLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChequeClearingReceivable" (
    "id" SERIAL NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT,
    "status" "TreasuryDocStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChequeClearingReceivable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChequeClearingReceivableLine" (
    "id" SERIAL NOT NULL,
    "chequeClearingReceivableId" INTEGER NOT NULL,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,
    "chequeItemId" INTEGER NOT NULL,
    "outcome" "ChequeClearingOutcome" NOT NULL,

    CONSTRAINT "ChequeClearingReceivableLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChequeClearingPayable" (
    "id" SERIAL NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT,
    "status" "TreasuryDocStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChequeClearingPayable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChequeClearingPayableLine" (
    "id" SERIAL NOT NULL,
    "chequeClearingPayableId" INTEGER NOT NULL,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,
    "chequeItemId" INTEGER NOT NULL,
    "outcome" "ChequeClearingOutcome" NOT NULL,

    CONSTRAINT "ChequeClearingPayableLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChequeDeposit_fiscalPeriodId_number_key" ON "ChequeDeposit"("fiscalPeriodId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "ChequeDepositReturn_fiscalPeriodId_number_key" ON "ChequeDepositReturn"("fiscalPeriodId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "ChequeClearingReceivable_fiscalPeriodId_number_key" ON "ChequeClearingReceivable"("fiscalPeriodId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "ChequeClearingPayable_fiscalPeriodId_number_key" ON "ChequeClearingPayable"("fiscalPeriodId", "number");

-- AddForeignKey
ALTER TABLE "ChequeDeposit" ADD CONSTRAINT "ChequeDeposit_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChequeDeposit" ADD CONSTRAINT "ChequeDeposit_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChequeDepositLine" ADD CONSTRAINT "ChequeDepositLine_chequeDepositId_fkey" FOREIGN KEY ("chequeDepositId") REFERENCES "ChequeDeposit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChequeDepositLine" ADD CONSTRAINT "ChequeDepositLine_chequeItemId_fkey" FOREIGN KEY ("chequeItemId") REFERENCES "ChequeItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChequeDepositReturn" ADD CONSTRAINT "ChequeDepositReturn_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChequeDepositReturnLine" ADD CONSTRAINT "ChequeDepositReturnLine_chequeDepositReturnId_fkey" FOREIGN KEY ("chequeDepositReturnId") REFERENCES "ChequeDepositReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChequeDepositReturnLine" ADD CONSTRAINT "ChequeDepositReturnLine_chequeItemId_fkey" FOREIGN KEY ("chequeItemId") REFERENCES "ChequeItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChequeClearingReceivable" ADD CONSTRAINT "ChequeClearingReceivable_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChequeClearingReceivableLine" ADD CONSTRAINT "ChequeClearingReceivableLine_chequeClearingReceivableId_fkey" FOREIGN KEY ("chequeClearingReceivableId") REFERENCES "ChequeClearingReceivable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChequeClearingReceivableLine" ADD CONSTRAINT "ChequeClearingReceivableLine_chequeItemId_fkey" FOREIGN KEY ("chequeItemId") REFERENCES "ChequeItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChequeClearingPayable" ADD CONSTRAINT "ChequeClearingPayable_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChequeClearingPayableLine" ADD CONSTRAINT "ChequeClearingPayableLine_chequeClearingPayableId_fkey" FOREIGN KEY ("chequeClearingPayableId") REFERENCES "ChequeClearingPayable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChequeClearingPayableLine" ADD CONSTRAINT "ChequeClearingPayableLine_chequeItemId_fkey" FOREIGN KEY ("chequeItemId") REFERENCES "ChequeItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
