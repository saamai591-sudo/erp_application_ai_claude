-- مبنای آمار تولید: NO_BASIS | PRODUCTION_ORDER
CREATE TYPE "ProductionStatBasis" AS ENUM ('NO_BASIS', 'PRODUCTION_ORDER');

ALTER TABLE "ProductionStat" ADD COLUMN "basis" "ProductionStatBasis" NOT NULL DEFAULT 'NO_BASIS';

-- آمارهایی که همه‌ی ردیف‌هایشان دستور دارند بر مبنای دستورند؛ آمار مخلوط (بعضی ردیف‌ها بی‌دستور) «بدون مبنا» می‌ماند
UPDATE "ProductionStat" s SET "basis" = 'PRODUCTION_ORDER'
WHERE EXISTS (SELECT 1 FROM "ProductionStatLine" l WHERE l."statId" = s.id)
  AND NOT EXISTS (SELECT 1 FROM "ProductionStatLine" l WHERE l."statId" = s.id AND l."productionOrderId" IS NULL);
