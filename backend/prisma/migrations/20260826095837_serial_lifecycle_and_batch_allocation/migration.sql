-- CreateEnum
CREATE TYPE "SerialStatus" AS ENUM ('DEFINED', 'RECEIVED', 'EXITED');

-- DropForeignKey
ALTER TABLE "InventoryDocumentLine" DROP CONSTRAINT "InventoryDocumentLine_batchId_fkey";

-- AlterTable
ALTER TABLE "InventoryDocumentLine" DROP COLUMN "batchId";

-- AlterTable
ALTER TABLE "InventoryLineSerial" ADD COLUMN     "serialStep" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Serial" ADD COLUMN     "status" "SerialStatus" NOT NULL DEFAULT 'DEFINED',
ADD COLUMN     "step" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "InventoryLineBatch" (
    "id" SERIAL NOT NULL,
    "lineId" INTEGER NOT NULL,
    "batchId" INTEGER NOT NULL,
    "quantity" DECIMAL(36,10) NOT NULL,

    CONSTRAINT "InventoryLineBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLineBatch_lineId_batchId_key" ON "InventoryLineBatch"("lineId", "batchId");

-- AddForeignKey
ALTER TABLE "InventoryLineBatch" ADD CONSTRAINT "InventoryLineBatch_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "InventoryDocumentLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLineBatch" ADD CONSTRAINT "InventoryLineBatch_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

