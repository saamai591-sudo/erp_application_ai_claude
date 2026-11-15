-- بازبینی کد تولید: فقط معین‌های دارای تفصیل مرکز هزینه ← تسهیم بین مراکز حذف شد؛ همه‌ی هزینه‌ها مستقیم‌اند
ALTER TYPE "CostPoolBasis" RENAME TO "CostRuleBasis";

ALTER TABLE "ProductionCostCenter" RENAME COLUMN "conversionDirect" TO "conversionCost";
UPDATE "ProductionCostCenter" SET "conversionCost" = "conversionCost" + "conversionAllocated";
ALTER TABLE "ProductionCostCenter" DROP COLUMN "conversionAllocated";

ALTER TABLE "ProductionCostAccountAlloc" DROP COLUMN "direct";
ALTER TABLE "ProductionCostAccountAlloc" DROP COLUMN "basisValue";
