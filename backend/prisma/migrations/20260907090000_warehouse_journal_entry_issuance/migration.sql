-- CreateTable
CREATE TABLE "WarehouseJournalEntryIssuance" (
    "id" SERIAL NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "toDate" DATE NOT NULL,
    "accountingGroupIds" TEXT,
    "rowCount" INTEGER NOT NULL,
    "journalEntryId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarehouseJournalEntryIssuance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseJournalEntryIssuance_journalEntryId_key" ON "WarehouseJournalEntryIssuance"("journalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseJournalEntryIssuance_fiscalPeriodId_number_key" ON "WarehouseJournalEntryIssuance"("fiscalPeriodId", "number");

-- AddForeignKey
ALTER TABLE "WarehouseJournalEntryIssuance" ADD CONSTRAINT "WarehouseJournalEntryIssuance_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseJournalEntryIssuance" ADD CONSTRAINT "WarehouseJournalEntryIssuance_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
