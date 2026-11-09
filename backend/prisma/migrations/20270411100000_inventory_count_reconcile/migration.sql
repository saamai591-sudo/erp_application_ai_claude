-- سندهای رسید اضافی / حواله کسری که «مغایرت‌گیری» شمارش انبار صادر کرده؛ فقط از همان شمارش قابل حذف‌اند
ALTER TABLE "InventoryDocument" ADD COLUMN "countId" INTEGER;
ALTER TABLE "InventoryDocument" ADD CONSTRAINT "InventoryDocument_countId_fkey" FOREIGN KEY ("countId") REFERENCES "InventoryCount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "InventoryDocument_countId_idx" ON "InventoryDocument"("countId");
