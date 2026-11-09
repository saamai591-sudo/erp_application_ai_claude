-- Useful life is entered in years (was months)
ALTER TABLE "FixedAsset" ADD COLUMN "usefulLifeYears" INTEGER;
UPDATE "FixedAsset" SET "usefulLifeYears" = GREATEST(1, ROUND("usefulLifeMonths" / 12.0)::int) WHERE "usefulLifeMonths" IS NOT NULL;
ALTER TABLE "FixedAsset" DROP COLUMN "usefulLifeMonths";
