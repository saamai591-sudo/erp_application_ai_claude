-- برگشت فروش فروشگاهی بدون مبنا (مثلاً فروش‌های قبل از راه‌اندازی سیستم) + شیفت/تاریخ شروع شیفت مثل فروش

ALTER TABLE "StoreSaleReturn" ALTER COLUMN "saleId" DROP NOT NULL;
ALTER TABLE "StoreSaleReturn" ADD COLUMN "shiftId" INTEGER;
ALTER TABLE "StoreSaleReturn" ADD COLUMN "shiftDate" DATE;
ALTER TABLE "StoreSaleReturn" ADD COLUMN "customerId" INTEGER;
ALTER TABLE "StoreSaleReturn" ADD COLUMN "salesTypeId" INTEGER;
ALTER TABLE "StoreSaleReturn" ADD COLUMN "costCenterId" INTEGER;

UPDATE "StoreSaleReturn" r SET
  "customerId" = s."customerId",
  "salesTypeId" = s."salesTypeId",
  "costCenterId" = s."costCenterId",
  "shiftId" = s."shiftId",
  "shiftDate" = s."shiftDate"
FROM "StoreSale" s WHERE s."id" = r."saleId";

ALTER TABLE "StoreSaleReturn" ALTER COLUMN "customerId" SET NOT NULL;
ALTER TABLE "StoreSaleReturn" ALTER COLUMN "salesTypeId" SET NOT NULL;
ALTER TABLE "StoreSaleReturn" ALTER COLUMN "costCenterId" SET NOT NULL;
ALTER TABLE "StoreSaleReturn" ADD CONSTRAINT "StoreSaleReturn_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "SalesShift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreSaleReturn" ADD CONSTRAINT "StoreSaleReturn_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StoreSaleReturnLine" ALTER COLUMN "saleLineId" DROP NOT NULL;
ALTER TABLE "StoreSaleReturnLine" ADD COLUMN "goodsItemId" INTEGER;
ALTER TABLE "StoreSaleReturnLine" ADD COLUMN "unitId" INTEGER;
ALTER TABLE "StoreSaleReturnLine" ADD COLUMN "unitPrice" DECIMAL(36,10);
ALTER TABLE "StoreSaleReturnLine" ADD COLUMN "priceListId" INTEGER;
ALTER TABLE "StoreSaleReturnLine" ADD COLUMN "listPrice" DECIMAL(36,10);

UPDATE "StoreSaleReturnLine" rl SET
  "goodsItemId" = sl."goodsItemId",
  "unitId" = sl."unitId",
  "unitPrice" = sl."unitPrice"
FROM "StoreSaleLine" sl WHERE sl."id" = rl."saleLineId";

ALTER TABLE "StoreSaleReturnLine" ALTER COLUMN "goodsItemId" SET NOT NULL;
ALTER TABLE "StoreSaleReturnLine" ALTER COLUMN "unitId" SET NOT NULL;
ALTER TABLE "StoreSaleReturnLine" ALTER COLUMN "unitPrice" SET NOT NULL;
ALTER TABLE "StoreSaleReturnLine" ADD CONSTRAINT "StoreSaleReturnLine_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreSaleReturnLine" ADD CONSTRAINT "StoreSaleReturnLine_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreSaleReturnLine" ADD CONSTRAINT "StoreSaleReturnLine_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "SalesPriceList"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "StoreSaleReturnLine_goodsItemId_idx" ON "StoreSaleReturnLine"("goodsItemId");
