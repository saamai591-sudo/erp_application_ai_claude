-- تایید تحویل فروش: حواله‌ی انبار فروش فروشگاهی به تحویل وصل می‌شود
ALTER TABLE "InventoryDocument" ADD COLUMN "storeDeliveryId" INTEGER;
ALTER TABLE "InventoryDocument" ADD CONSTRAINT "InventoryDocument_storeDeliveryId_fkey" FOREIGN KEY ("storeDeliveryId") REFERENCES "StoreSaleDelivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreSaleDelivery" ADD COLUMN "confirmedAt" TIMESTAMP(3);
