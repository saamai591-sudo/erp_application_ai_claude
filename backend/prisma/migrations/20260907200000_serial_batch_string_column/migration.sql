-- AlterTable: add the new free-text batch column
ALTER TABLE "Serial" ADD COLUMN "batch" TEXT;

-- Backfill existing rows from the batch they were linked to, before the FK is dropped
UPDATE "Serial" s SET "batch" = b."batchNumber" FROM "Batch" b WHERE s."batchId" = b.id;

-- DropForeignKey
ALTER TABLE "Serial" DROP CONSTRAINT "Serial_batchId_fkey";

-- AlterTable: drop the old FK column
ALTER TABLE "Serial" DROP COLUMN "batchId";
