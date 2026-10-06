-- CreateEnum
CREATE TYPE "ConsolidationRangeMode" AS ENUM ('BY_DATE', 'BY_DOCUMENT');

-- CreateEnum
CREATE TYPE "ConsolidationType" AS ENUM ('DAILY', 'MONTHLY');

-- CreateTable
CREATE TABLE "JournalConsolidationRun" (
    "id" SERIAL NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "rangeMode" "ConsolidationRangeMode" NOT NULL,
    "type" "ConsolidationType" NOT NULL,
    "fromDate" DATE,
    "toDate" DATE,
    "fromNumber" INTEGER,
    "toNumber" INTEGER,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalConsolidationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsolidatedDocument" (
    "id" SERIAL NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "runId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "type" "ConsolidationType" NOT NULL,
    "boundaryKey" TEXT,
    "description" TEXT,
    "sourceCount" INTEGER NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "fromNumber" INTEGER NOT NULL,
    "toNumber" INTEGER NOT NULL,
    "totalDebit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalCredit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsolidatedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsolidatedDocumentSource" (
    "id" SERIAL NOT NULL,
    "consolidatedDocumentId" INTEGER NOT NULL,
    "journalEntryId" INTEGER NOT NULL,

    CONSTRAINT "ConsolidatedDocumentSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsolidatedDocument_runId_idx" ON "ConsolidatedDocument"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsolidatedDocument_fiscalPeriodId_number_key" ON "ConsolidatedDocument"("fiscalPeriodId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "ConsolidatedDocumentSource_journalEntryId_key" ON "ConsolidatedDocumentSource"("journalEntryId");

-- CreateIndex
CREATE INDEX "ConsolidatedDocumentSource_consolidatedDocumentId_idx" ON "ConsolidatedDocumentSource"("consolidatedDocumentId");

-- AddForeignKey
ALTER TABLE "JournalConsolidationRun" ADD CONSTRAINT "JournalConsolidationRun_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsolidatedDocument" ADD CONSTRAINT "ConsolidatedDocument_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsolidatedDocument" ADD CONSTRAINT "ConsolidatedDocument_runId_fkey" FOREIGN KEY ("runId") REFERENCES "JournalConsolidationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsolidatedDocumentSource" ADD CONSTRAINT "ConsolidatedDocumentSource_consolidatedDocumentId_fkey" FOREIGN KEY ("consolidatedDocumentId") REFERENCES "ConsolidatedDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsolidatedDocumentSource" ADD CONSTRAINT "ConsolidatedDocumentSource_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
