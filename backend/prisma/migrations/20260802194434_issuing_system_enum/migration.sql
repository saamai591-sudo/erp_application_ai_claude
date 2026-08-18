/*
  Warnings:

  - The `issuingSystem` column on the `JournalEntry` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "IssuingSystem" AS ENUM ('ACCOUNTING', 'ACCOUNTING_EXCEL_IMPORT', 'ACCOUNT_CLOSING', 'OPENING_CLOSING');

-- AlterTable
ALTER TABLE "JournalEntry" DROP COLUMN "issuingSystem",
ADD COLUMN     "issuingSystem" "IssuingSystem" NOT NULL DEFAULT 'ACCOUNTING';
