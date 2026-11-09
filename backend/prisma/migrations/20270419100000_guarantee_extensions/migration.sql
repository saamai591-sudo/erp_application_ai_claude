-- تمدید ضمانت‌نامه: دو فرم جدا و بدون سند حسابداری؛ عملیات ضمانت‌نامه از این پس تقلیل / افزایش / ابطال است و سند حسابداری دارد
CREATE TABLE "GuaranteeExtension" (
  "id" SERIAL NOT NULL,
  "direction" "GuaranteeDirection" NOT NULL,
  "fiscalPeriodId" INTEGER NOT NULL,
  "number" INTEGER NOT NULL,
  "date" DATE NOT NULL,
  "partyId" INTEGER NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "legacyOperationId" INTEGER,
  CONSTRAINT "GuaranteeExtension_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GuaranteeExtension_direction_fiscalPeriodId_number_key" ON "GuaranteeExtension"("direction", "fiscalPeriodId", "number");
ALTER TABLE "GuaranteeExtension" ADD CONSTRAINT "GuaranteeExtension_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GuaranteeExtension" ADD CONSTRAINT "GuaranteeExtension_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "GuaranteeExtensionLine" (
  "id" SERIAL NOT NULL,
  "extensionId" INTEGER NOT NULL,
  "instrumentId" INTEGER NOT NULL,
  "rowOrder" INTEGER NOT NULL DEFAULT 0,
  "newDueDate" DATE NOT NULL,
  CONSTRAINT "GuaranteeExtensionLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GuaranteeExtensionLine_extensionId_idx" ON "GuaranteeExtensionLine"("extensionId");
CREATE INDEX "GuaranteeExtensionLine_instrumentId_idx" ON "GuaranteeExtensionLine"("instrumentId");
ALTER TABLE "GuaranteeExtensionLine" ADD CONSTRAINT "GuaranteeExtensionLine_extensionId_fkey" FOREIGN KEY ("extensionId") REFERENCES "GuaranteeExtension"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuaranteeExtensionLine" ADD CONSTRAINT "GuaranteeExtensionLine_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "GuaranteeInstrument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- انتقال عملیات «تمدید» موجود (اگر باشد) به فرم تمدید
INSERT INTO "GuaranteeExtension" ("direction", "fiscalPeriodId", "number", "date", "partyId", "description", "createdAt", "updatedAt", "legacyOperationId")
SELECT "direction", "fiscalPeriodId", "number", "date", "partyId", "description", "createdAt", "updatedAt", "id" FROM "GuaranteeOperation" WHERE "kind" = 'EXTEND';
INSERT INTO "GuaranteeExtensionLine" ("extensionId", "instrumentId", "rowOrder", "newDueDate")
SELECT e."id", l."instrumentId", l."rowOrder", l."newDueDate"
FROM "GuaranteeOperationLine" l JOIN "GuaranteeExtension" e ON e."legacyOperationId" = l."operationId" WHERE l."newDueDate" IS NOT NULL;
DELETE FROM "GuaranteeOperation" WHERE "kind" = 'EXTEND';
ALTER TABLE "GuaranteeExtension" DROP COLUMN "legacyOperationId";

-- نوع عملیات: REDUCE / INCREASE / CANCEL
ALTER TYPE "GuaranteeOperationKind" RENAME TO "GuaranteeOperationKind_old";
CREATE TYPE "GuaranteeOperationKind" AS ENUM ('REDUCE', 'INCREASE', 'CANCEL');
ALTER TABLE "GuaranteeOperation" ALTER COLUMN "kind" TYPE "GuaranteeOperationKind" USING ("kind"::text::"GuaranteeOperationKind");
DROP TYPE "GuaranteeOperationKind_old";
ALTER TABLE "GuaranteeOperationLine" DROP COLUMN "newDueDate";

-- سند حسابداری عملیات
ALTER TABLE "GuaranteeOperation" ADD COLUMN "journalEntryId" INTEGER;
CREATE UNIQUE INDEX "GuaranteeOperation_journalEntryId_key" ON "GuaranteeOperation"("journalEntryId");
ALTER TABLE "GuaranteeOperation" ADD CONSTRAINT "GuaranteeOperation_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
