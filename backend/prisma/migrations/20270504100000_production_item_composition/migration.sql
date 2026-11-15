-- ترکیب بهای موجودی آخر دوره‌ی هر کالای تولیدی (دفتر ترکیب کالا)
CREATE TABLE "ProductionItemComposition" (
    "id" SERIAL NOT NULL,
    "runId" INTEGER NOT NULL,
    "goodsItemId" INTEGER NOT NULL,
    "nodeId" INTEGER,
    "amount" DECIMAL(36,10) NOT NULL DEFAULT 0,
    CONSTRAINT "ProductionItemComposition_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProductionItemComposition_runId_goodsItemId_idx" ON "ProductionItemComposition"("runId", "goodsItemId");
ALTER TABLE "ProductionItemComposition" ADD CONSTRAINT "ProductionItemComposition_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ProductionCostRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductionItemComposition" ADD CONSTRAINT "ProductionItemComposition_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionItemComposition" ADD CONSTRAINT "ProductionItemComposition_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "CostStructureNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
