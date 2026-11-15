-- هزینه‌ی انتقالی: بخشی از مواد که نیمه‌ساخته‌ی تحویل‌گرفته از مرکز قبل است (در گزارش از «مواد» جدا می‌شود)
ALTER TABLE "ProductionCostCenterItem" ADD COLUMN "transferredCost" DECIMAL(36,10) NOT NULL DEFAULT 0;
ALTER TABLE "ProductionCostComponent" ADD COLUMN "transferredAmount" DECIMAL(36,10) NOT NULL DEFAULT 0;
