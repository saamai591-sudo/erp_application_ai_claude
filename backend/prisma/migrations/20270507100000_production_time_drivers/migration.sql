-- مبناهای زمانی تسهیم + «زمان‌بندی تولید» (مرکز × کالا × مبنا)؛ ساعت استاندارد فرمول ساخت و دستور تولید حذف می‌شود
ALTER TYPE "CostPoolBasis" RENAME VALUE 'STANDARD_HOURS' TO 'TIME_DRIVER';

CREATE TABLE "CostTimeDriver" (
  "id" SERIAL PRIMARY KEY,
  "code" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "CostTimeDriver_code_key" ON "CostTimeDriver"("code");
CREATE UNIQUE INDEX "CostTimeDriver_title_key" ON "CostTimeDriver"("title");

ALTER TABLE "CostAccountRule" ADD COLUMN "driverId" INTEGER;
CREATE INDEX "CostAccountRule_driverId_idx" ON "CostAccountRule"("driverId");
ALTER TABLE "CostAccountRule" ADD CONSTRAINT "CostAccountRule_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "CostTimeDriver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- قاعده‌ی قدیمی با مبنای «ساعت استاندارد» (اگر بود) به یک مبنای زمانی هم‌نام وصل می‌شود
INSERT INTO "CostTimeDriver" ("code", "title", "updatedAt")
SELECT 1, 'ساعت استاندارد', CURRENT_TIMESTAMP WHERE EXISTS (SELECT 1 FROM "CostAccountRule" WHERE "basis" = 'TIME_DRIVER');
UPDATE "CostAccountRule" SET "driverId" = (SELECT "id" FROM "CostTimeDriver" WHERE "code" = 1) WHERE "basis" = 'TIME_DRIVER';
ALTER TABLE "CostAccountRule" ADD CONSTRAINT "CostAccountRule_driver_basis_check" CHECK (("basis" = 'TIME_DRIVER') = ("driverId" IS NOT NULL));

CREATE TABLE "ProductionTimeSheet" (
  "id" SERIAL PRIMARY KEY,
  "costCenterId" INTEGER NOT NULL,
  "fromReportingPeriodId" INTEGER NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "ProductionTimeSheet_costCenterId_fromReportingPeriodId_key" ON "ProductionTimeSheet"("costCenterId", "fromReportingPeriodId");
ALTER TABLE "ProductionTimeSheet" ADD CONSTRAINT "ProductionTimeSheet_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionTimeSheet" ADD CONSTRAINT "ProductionTimeSheet_fromReportingPeriodId_fkey" FOREIGN KEY ("fromReportingPeriodId") REFERENCES "ReportingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ProductionTimeLine" (
  "id" SERIAL PRIMARY KEY,
  "sheetId" INTEGER NOT NULL,
  "goodsItemId" INTEGER NOT NULL,
  "driverId" INTEGER NOT NULL,
  "minutesPerUnit" DECIMAL(36,10) NOT NULL,
  CONSTRAINT "ProductionTimeLine_nonneg_check" CHECK ("minutesPerUnit" >= 0)
);
CREATE UNIQUE INDEX "ProductionTimeLine_sheetId_goodsItemId_driverId_key" ON "ProductionTimeLine"("sheetId", "goodsItemId", "driverId");
CREATE INDEX "ProductionTimeLine_goodsItemId_idx" ON "ProductionTimeLine"("goodsItemId");
CREATE INDEX "ProductionTimeLine_driverId_idx" ON "ProductionTimeLine"("driverId");
ALTER TABLE "ProductionTimeLine" ADD CONSTRAINT "ProductionTimeLine_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "ProductionTimeSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionTimeLine" ADD CONSTRAINT "ProductionTimeLine_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionTimeLine" ADD CONSTRAINT "ProductionTimeLine_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "CostTimeDriver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Bom" DROP COLUMN "standardHours";
ALTER TABLE "ProductionOrder" DROP COLUMN "standardHours";
