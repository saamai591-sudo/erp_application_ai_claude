-- CreateEnum
CREATE TYPE "TradeLedgerStatus" AS ENUM ('DRAFT', 'APPROVED');

-- CreateTable
CREATE TABLE "TradeLedger" (
    "id" SERIAL NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "status" "TradeLedgerStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedAt" TIMESTAMP(3),
    "approvedById" INTEGER,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradeLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeLedgerDocument" (
    "id" SERIAL NOT NULL,
    "tradeLedgerId" INTEGER NOT NULL,
    "consolidatedDocumentId" INTEGER NOT NULL,

    CONSTRAINT "TradeLedgerDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TradeLedger_fiscalPeriodId_number_key" ON "TradeLedger"("fiscalPeriodId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "TradeLedgerDocument_consolidatedDocumentId_key" ON "TradeLedgerDocument"("consolidatedDocumentId");

-- CreateIndex
CREATE INDEX "TradeLedgerDocument_tradeLedgerId_idx" ON "TradeLedgerDocument"("tradeLedgerId");

-- AddForeignKey
ALTER TABLE "TradeLedger" ADD CONSTRAINT "TradeLedger_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeLedgerDocument" ADD CONSTRAINT "TradeLedgerDocument_tradeLedgerId_fkey" FOREIGN KEY ("tradeLedgerId") REFERENCES "TradeLedger"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeLedgerDocument" ADD CONSTRAINT "TradeLedgerDocument_consolidatedDocumentId_fkey" FOREIGN KEY ("consolidatedDocumentId") REFERENCES "ConsolidatedDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
