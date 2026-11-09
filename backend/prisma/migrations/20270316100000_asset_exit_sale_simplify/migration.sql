-- Sale exit works like the other exits (book value to the group's sale gain/loss account): drop counter account and sale amount
ALTER TABLE "AssetExitType" DROP CONSTRAINT "AssetExitType_counterAccountId_fkey";
ALTER TABLE "AssetExitType" DROP COLUMN "counterAccountId";
ALTER TABLE "AssetExitItem" DROP COLUMN "saleAmount";
