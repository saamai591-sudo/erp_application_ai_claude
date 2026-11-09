-- «عملیات ضمانت‌نامه دریافتی/پرداختی» (تمدید، تقلیل، افزایش) — فقط ابزار ضمانت‌نامه
CREATE TYPE "GuaranteeOperationKind" AS ENUM ('EXTEND', 'REDUCE', 'INCREASE');

CREATE TABLE "GuaranteeOperation" (
  "id" SERIAL NOT NULL,
  "direction" "GuaranteeDirection" NOT NULL,
  "fiscalPeriodId" INTEGER NOT NULL,
  "number" INTEGER NOT NULL,
  "date" DATE NOT NULL,
  "partyId" INTEGER NOT NULL,
  "kind" "GuaranteeOperationKind" NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuaranteeOperation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GuaranteeOperation_direction_fiscalPeriodId_number_key" ON "GuaranteeOperation"("direction", "fiscalPeriodId", "number");
ALTER TABLE "GuaranteeOperation" ADD CONSTRAINT "GuaranteeOperation_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GuaranteeOperation" ADD CONSTRAINT "GuaranteeOperation_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "GuaranteeOperationLine" (
  "id" SERIAL NOT NULL,
  "operationId" INTEGER NOT NULL,
  "instrumentId" INTEGER NOT NULL,
  "rowOrder" INTEGER NOT NULL DEFAULT 0,
  "newDueDate" DATE,
  "changeAmount" DECIMAL(18,2),
  CONSTRAINT "GuaranteeOperationLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GuaranteeOperationLine_operationId_idx" ON "GuaranteeOperationLine"("operationId");
CREATE INDEX "GuaranteeOperationLine_instrumentId_idx" ON "GuaranteeOperationLine"("instrumentId");
ALTER TABLE "GuaranteeOperationLine" ADD CONSTRAINT "GuaranteeOperationLine_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "GuaranteeOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuaranteeOperationLine" ADD CONSTRAINT "GuaranteeOperationLine_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "GuaranteeInstrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
