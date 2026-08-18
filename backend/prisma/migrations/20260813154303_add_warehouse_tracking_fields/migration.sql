-- AlterTable
ALTER TABLE "InitialInventoryLine" ADD COLUMN     "batchNumber" TEXT,
ADD COLUMN     "expiryDate" DATE,
ADD COLUMN     "physicalLocation" TEXT,
ADD COLUMN     "serialNumber" TEXT;

-- AlterTable
ALTER TABLE "WarehouseAdjustmentLine" ADD COLUMN     "batchNumber" TEXT,
ADD COLUMN     "expiryDate" DATE,
ADD COLUMN     "physicalLocation" TEXT,
ADD COLUMN     "serialNumber" TEXT;

-- AlterTable
ALTER TABLE "WarehouseIssueLine" ADD COLUMN     "batchNumber" TEXT,
ADD COLUMN     "expiryDate" DATE,
ADD COLUMN     "physicalLocation" TEXT,
ADD COLUMN     "serialNumber" TEXT;

-- AlterTable
ALTER TABLE "WarehouseReceiptLine" ADD COLUMN     "batchNumber" TEXT,
ADD COLUMN     "expiryDate" DATE,
ADD COLUMN     "physicalLocation" TEXT,
ADD COLUMN     "serialNumber" TEXT;

-- AlterTable
ALTER TABLE "WarehouseTransferLine" ADD COLUMN     "batchNumber" TEXT,
ADD COLUMN     "expiryDate" DATE,
ADD COLUMN     "physicalLocation" TEXT,
ADD COLUMN     "serialNumber" TEXT;
