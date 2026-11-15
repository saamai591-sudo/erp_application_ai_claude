-- تولید: مقدارهای تازه‌ی enum (نوع مبلغ رسید تولید، سیستم صادرکننده، نوع حساب کالای در جریان ساخت)
-- AlterEnum
ALTER TYPE "DocumentAmountPriceType" ADD VALUE 'PRODUCTION_COSTING';

-- AlterEnum
ALTER TYPE "GoodsAccountType" ADD VALUE 'PRODUCTION_WIP';

-- AlterEnum
ALTER TYPE "IssuingSystem" ADD VALUE 'PRODUCTION';
