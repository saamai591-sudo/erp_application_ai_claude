CREATE TYPE "InventoryCountCondition" AS ENUM ('ALL_ITEMS', 'FIRST_STOCK_DIFF', 'SECOND_STOCK_DIFF', 'FIRST_SECOND_DIFF');

CREATE TABLE "InventoryCountMethod" (
  "id" SERIAL PRIMARY KEY,
  "number" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "countTimes" INTEGER NOT NULL,
  "minStock" DECIMAL(36,10),
  "secondCondition" "InventoryCountCondition",
  "thirdCondition" "InventoryCountCondition",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryCountMethod_countTimes_check" CHECK ("countTimes" IN (1, 2, 3))
);
CREATE UNIQUE INDEX "InventoryCountMethod_number_key" ON "InventoryCountMethod"("number");
CREATE UNIQUE INDEX "InventoryCountMethod_title_key" ON "InventoryCountMethod"("title");

CREATE TABLE "InventoryCountTagIssue" (
  "id" SERIAL PRIMARY KEY,
  "number" INTEGER NOT NULL,
  "fiscalPeriodId" INTEGER NOT NULL,
  "warehouseId" INTEGER NOT NULL,
  "methodId" INTEGER NOT NULL,
  "date" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryCountTagIssue_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InventoryCountTagIssue_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InventoryCountTagIssue_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "InventoryCountMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "InventoryCountTagIssue_fiscalPeriodId_number_key" ON "InventoryCountTagIssue"("fiscalPeriodId", "number");

CREATE TABLE "InventoryCountTag" (
  "id" SERIAL PRIMARY KEY,
  "issueId" INTEGER NOT NULL,
  "tagNumber" INTEGER NOT NULL,
  "goodsItemId" INTEGER NOT NULL,
  CONSTRAINT "InventoryCountTag_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "InventoryCountTagIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InventoryCountTag_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "InventoryCountTag_tagNumber_key" ON "InventoryCountTag"("tagNumber");
CREATE UNIQUE INDEX "InventoryCountTag_issueId_goodsItemId_key" ON "InventoryCountTag"("issueId", "goodsItemId");
