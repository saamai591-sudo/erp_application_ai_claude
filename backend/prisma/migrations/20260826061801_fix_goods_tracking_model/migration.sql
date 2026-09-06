-- CreateEnum
CREATE TYPE "GoodsTrackingMethod" AS ENUM ('NONE', 'BATCH', 'SERIAL');

-- AlterTable
ALTER TABLE "GoodsItem" DROP COLUMN "hasExpiryDate",
DROP COLUMN "hasSerialNumber",
DROP COLUMN "isBatchTracked",
DROP COLUMN "isExpiryTracked",
DROP COLUMN "isSerialTracked",
ADD COLUMN     "trackingMethod" "GoodsTrackingMethod" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "Serial" ADD COLUMN     "batchId" INTEGER,
ADD COLUMN     "expiryDate" DATE;

-- AddForeignKey
ALTER TABLE "Serial" ADD CONSTRAINT "Serial_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

