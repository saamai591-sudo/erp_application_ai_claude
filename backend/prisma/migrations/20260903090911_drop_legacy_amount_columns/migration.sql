-- DropForeignKey
ALTER TABLE "GoodsPricingAdjustment" DROP CONSTRAINT "GoodsPricingAdjustment_lineId_fkey";

-- DropForeignKey
ALTER TABLE "GoodsPricingAdjustment" DROP CONSTRAINT "GoodsPricingAdjustment_statusId_fkey";

-- AlterTable
ALTER TABLE "InventoryDocumentLine" DROP COLUMN "amount",
DROP COLUMN "unitCost";

-- DropTable
DROP TABLE "GoodsPricingAdjustment";

