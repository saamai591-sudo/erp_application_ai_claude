/*
  Warnings:

  - You are about to drop the column `purchaseTypeRef` on the `GoodsServiceAccountingSetting` table (its values were placeholder numeric codes typed by hand, per the pre-purchase-module convention — not real references, so nothing meaningful survives the drop).
  - Added the required column `purchaseTypeId` to the `PurchaseInvoice` table — backfilled below to the seeded "داخلی" (domestic) PurchaseType before being made NOT NULL, since the table already has rows.

*/
-- CreateEnum
CREATE TYPE "PurchaseNature" AS ENUM ('IMPORTED', 'DOMESTIC');

-- CreateTable
CREATE TABLE "PurchaseType" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "nature" "PurchaseNature" NOT NULL,
    "hasTransactions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseType_code_key" ON "PurchaseType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseType_title_key" ON "PurchaseType"("title");

-- Seed the one domestic purchase type required to backfill existing purchase invoices below
INSERT INTO "PurchaseType" ("code", "title", "nature") VALUES (1, 'داخلی', 'DOMESTIC');

-- AlterTable: GoodsServiceAccountingSetting.purchaseTypeRef -> purchaseTypeId (real FK now, old placeholder values dropped)
ALTER TABLE "GoodsServiceAccountingSetting" DROP COLUMN "purchaseTypeRef",
ADD COLUMN     "purchaseTypeId" INTEGER;

-- AlterTable: PurchaseInvoice — add nullable, backfill to the domestic type, then enforce NOT NULL
ALTER TABLE "PurchaseInvoice" ADD COLUMN "purchaseTypeId" INTEGER;
UPDATE "PurchaseInvoice" SET "purchaseTypeId" = (SELECT "id" FROM "PurchaseType" WHERE "title" = 'داخلی');
ALTER TABLE "PurchaseInvoice" ALTER COLUMN "purchaseTypeId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "GoodsServiceAccountingSetting" ADD CONSTRAINT "GoodsServiceAccountingSetting_purchaseTypeId_fkey" FOREIGN KEY ("purchaseTypeId") REFERENCES "PurchaseType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseInvoice" ADD CONSTRAINT "PurchaseInvoice_purchaseTypeId_fkey" FOREIGN KEY ("purchaseTypeId") REFERENCES "PurchaseType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
