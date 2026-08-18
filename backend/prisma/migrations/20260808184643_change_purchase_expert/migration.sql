/*
  Warnings:

  - You are about to drop the column `userId` on the `PurchaseExpert` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[partyId]` on the table `PurchaseExpert` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `partyId` to the `PurchaseExpert` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "PurchaseExpert" DROP CONSTRAINT "PurchaseExpert_userId_fkey";

-- DropIndex
DROP INDEX "PurchaseExpert_userId_key";

-- AlterTable
ALTER TABLE "PurchaseExpert" DROP COLUMN "userId",
ADD COLUMN     "partyId" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseExpert_partyId_key" ON "PurchaseExpert"("partyId");

-- AddForeignKey
ALTER TABLE "PurchaseExpert" ADD CONSTRAINT "PurchaseExpert_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
