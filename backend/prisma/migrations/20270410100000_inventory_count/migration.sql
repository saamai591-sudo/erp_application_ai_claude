CREATE TABLE "InventoryCount" (
  "id" SERIAL PRIMARY KEY,
  "number" INTEGER NOT NULL,
  "fiscalPeriodId" INTEGER NOT NULL,
  "issueId" INTEGER NOT NULL,
  "round" INTEGER NOT NULL,
  "date" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryCount_round_check" CHECK ("round" IN (1, 2, 3)),
  CONSTRAINT "InventoryCount_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InventoryCount_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "InventoryCountTagIssue"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "InventoryCount_fiscalPeriodId_number_key" ON "InventoryCount"("fiscalPeriodId", "number");
CREATE UNIQUE INDEX "InventoryCount_issueId_round_key" ON "InventoryCount"("issueId", "round");

CREATE TABLE "InventoryCountLine" (
  "id" SERIAL PRIMARY KEY,
  "countId" INTEGER NOT NULL,
  "tagId" INTEGER NOT NULL,
  "quantity" DECIMAL(36,10),
  CONSTRAINT "InventoryCountLine_countId_fkey" FOREIGN KEY ("countId") REFERENCES "InventoryCount"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InventoryCountLine_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "InventoryCountTag"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "InventoryCountLine_countId_tagId_key" ON "InventoryCountLine"("countId", "tagId");
