-- بچ در تولید (سطح ۱): بچ تولیدی به دستور تولید وصل می‌شود و ردیف آمار تولید بچ می‌گیرد.
-- ستون قدیمی productionReferenceId هیچ‌جا مقداردهی نمی‌شد و با ستون FK واقعی productionOrderId جایگزین می‌شود.
ALTER TABLE "Batch" DROP COLUMN "productionReferenceId";
ALTER TABLE "Batch" ADD COLUMN "productionOrderId" INTEGER;
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Batch_productionOrderId_idx" ON "Batch"("productionOrderId");

ALTER TABLE "ProductionStatLine" ADD COLUMN "batchId" INTEGER;
ALTER TABLE "ProductionStatLine" ADD CONSTRAINT "ProductionStatLine_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "ProductionStatLine_batchId_idx" ON "ProductionStatLine"("batchId");
