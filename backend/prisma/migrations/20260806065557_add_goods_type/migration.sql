/*
  Warnings:

  - The values [GOODS] on the enum `GoodsType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "GoodsType_new" AS ENUM ('RAW_MATERIAL', 'SEMI_FINISHED', 'PRODUCT', 'SUPPLIES', 'SERVICE', 'CONTRACT_GOODS', 'SCRAP', 'FIXED_ASSET', 'TRADE_GOODS');
ALTER TABLE "AccountingGroup" ALTER COLUMN "goodsType" TYPE "GoodsType_new" USING ("goodsType"::text::"GoodsType_new");
ALTER TYPE "GoodsType" RENAME TO "GoodsType_old";
ALTER TYPE "GoodsType_new" RENAME TO "GoodsType";
DROP TYPE "GoodsType_old";
COMMIT;
