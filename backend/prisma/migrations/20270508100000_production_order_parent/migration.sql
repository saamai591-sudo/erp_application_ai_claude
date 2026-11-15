-- دستور تولید: پیوند اختیاری «دستور مادر» (دستورهای سطح پایین‌ترِ ساخته‌شده برای کسری اجزا)
ALTER TABLE "ProductionOrder" ADD COLUMN "parentOrderId" INTEGER;
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_parentOrderId_fkey" FOREIGN KEY ("parentOrderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_not_own_parent" CHECK ("parentOrderId" IS NULL OR "parentOrderId" <> "id");
CREATE INDEX "ProductionOrder_parentOrderId_idx" ON "ProductionOrder"("parentOrderId");
