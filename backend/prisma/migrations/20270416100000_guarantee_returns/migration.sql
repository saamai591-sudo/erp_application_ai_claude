-- «استرداد دریافت تضمین» / «استرداد پرداخت تضمین» (فقط چک و سفته؛ سند حسابداری = معکوس سند دریافت/پرداخت)
CREATE TABLE "GuaranteeReturn" (
  "id" SERIAL NOT NULL,
  "direction" "GuaranteeDirection" NOT NULL,
  "fiscalPeriodId" INTEGER NOT NULL,
  "number" INTEGER NOT NULL,
  "date" DATE NOT NULL,
  "partyId" INTEGER NOT NULL,
  "description" TEXT,
  "journalEntryId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuaranteeReturn_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GuaranteeReturn_direction_fiscalPeriodId_number_key" ON "GuaranteeReturn"("direction", "fiscalPeriodId", "number");
CREATE UNIQUE INDEX "GuaranteeReturn_journalEntryId_key" ON "GuaranteeReturn"("journalEntryId");
ALTER TABLE "GuaranteeReturn" ADD CONSTRAINT "GuaranteeReturn_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GuaranteeReturn" ADD CONSTRAINT "GuaranteeReturn_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GuaranteeReturn" ADD CONSTRAINT "GuaranteeReturn_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "GuaranteeReturnLine" (
  "id" SERIAL NOT NULL,
  "returnId" INTEGER NOT NULL,
  "instrumentId" INTEGER NOT NULL,
  "rowOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "GuaranteeReturnLine_pkey" PRIMARY KEY ("id")
);
-- هر ابزار فقط یک بار قابل استرداد است
CREATE UNIQUE INDEX "GuaranteeReturnLine_instrumentId_key" ON "GuaranteeReturnLine"("instrumentId");
CREATE INDEX "GuaranteeReturnLine_returnId_idx" ON "GuaranteeReturnLine"("returnId");
ALTER TABLE "GuaranteeReturnLine" ADD CONSTRAINT "GuaranteeReturnLine_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "GuaranteeReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuaranteeReturnLine" ADD CONSTRAINT "GuaranteeReturnLine_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "GuaranteeInstrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
