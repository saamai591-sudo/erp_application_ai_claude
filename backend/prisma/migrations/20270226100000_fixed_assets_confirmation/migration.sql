-- Fixed assets: receipt status, asset confirmation fields, depreciation inputs
CREATE TYPE "DepreciationMethod" AS ENUM ('STRAIGHT_LINE', 'DECLINING');

ALTER TABLE "AssetReceipt" ADD COLUMN     "finalizedAt" TIMESTAMP(3),
ADD COLUMN     "status" "WarehouseDocStatus" NOT NULL DEFAULT 'REGISTERED';

ALTER TABLE "FixedAsset" ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "confirmedById" INTEGER,
ADD COLUMN     "depreciationMethod" "DepreciationMethod",
ADD COLUMN     "depreciationRatePercent" DECIMAL(9,4),
ADD COLUMN     "salvageValue" DECIMAL(36,10),
ADD COLUMN     "usefulLifeMonths" INTEGER,
ALTER COLUMN "cost" DROP NOT NULL;

ALTER TABLE "FixedAssetComponent" ALTER COLUMN "amount" DROP NOT NULL;
