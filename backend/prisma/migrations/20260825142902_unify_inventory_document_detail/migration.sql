-- InventoryDocument: replace the three separate partyId/costCenterId/projectId FK columns with a
-- single detailCode string, matching the existing "detail" pattern already used by JournalEntryLine
-- (detail1Code/detail2Code/detail3Code) and resolved through DetailCodeUsage. Every document type
-- only ever sets exactly one of the three today, so no data is lost by unifying them.

-- AlterTable: add the new column first so we can migrate data into it before dropping the old ones
ALTER TABLE "InventoryDocument" ADD COLUMN     "detailCode" TEXT;

-- Data migration: carry over existing partyId/costCenterId values as their entity's detailCode
UPDATE "InventoryDocument" d
SET "detailCode" = p."detailCode"
FROM "Party" p
WHERE d."partyId" = p."id";

UPDATE "InventoryDocument" d
SET "detailCode" = cc."detailCode"
FROM "CostCenter" cc
WHERE d."costCenterId" = cc."id";

-- (projectId has no non-null rows at migration time, nothing to carry over)

-- DropForeignKey
ALTER TABLE "InventoryDocument" DROP CONSTRAINT "InventoryDocument_costCenterId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryDocument" DROP CONSTRAINT "InventoryDocument_partyId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryDocument" DROP CONSTRAINT "InventoryDocument_projectId_fkey";

-- AlterTable
ALTER TABLE "InventoryDocument" DROP COLUMN "costCenterId",
DROP COLUMN "partyId",
DROP COLUMN "projectId";

-- Project: replace the plain serial "code" with a proper "detailCode", joining the same registry as
-- Party/CostCenter/BankAccount/CashBox so it can be referenced via InventoryDocument.detailCode too.
-- No Project rows exist yet, so no data migration is needed for this column.

-- DropIndex
DROP INDEX "Project_code_key";

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "code",
ADD COLUMN     "detailCode" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Project_detailCode_key" ON "Project"("detailCode");

-- Register "پروژه" (Project) as a new detail type (code 8), in a numeric range (900-999) that does
-- not overlap any currently configured detail type range.
INSERT INTO "DetailType" ("code", "title", "codeLength", "startNumber", "endNumber", "manualEntry")
VALUES (8, 'پروژه', 5, 900, 999, false)
ON CONFLICT ("code") DO NOTHING;
