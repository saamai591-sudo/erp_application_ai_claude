-- فروش فروشگاهی (مرحله ۲): سند «فروش فروشگاهی» و ردیف‌هایش
CREATE TYPE "StoreSaleDeliveryStatus" AS ENUM ('NOT_DELIVERED', 'DELIVERED');

CREATE TABLE "StoreSale" (
  "id" SERIAL PRIMARY KEY,
  "fiscalPeriodId" INTEGER NOT NULL,
  "number" INTEGER NOT NULL,
  "date" DATE NOT NULL,
  "stationId" INTEGER NOT NULL,
  "warehouseId" INTEGER,
  "salesTypeId" INTEGER NOT NULL,
  "costCenterId" INTEGER NOT NULL,
  "customerId" INTEGER NOT NULL,
  "description" TEXT,
  "deliveryStatus" "StoreSaleDeliveryStatus" NOT NULL DEFAULT 'NOT_DELIVERED',
  "createdById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoreSale_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StoreSale_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "SalesStation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StoreSale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "StoreSale_fiscalPeriodId_number_key" ON "StoreSale"("fiscalPeriodId", "number");
CREATE INDEX "StoreSale_stationId_date_idx" ON "StoreSale"("stationId", "date");
CREATE INDEX "StoreSale_warehouseId_deliveryStatus_date_idx" ON "StoreSale"("warehouseId", "deliveryStatus", "date");

CREATE TABLE "StoreSaleLine" (
  "id" SERIAL PRIMARY KEY,
  "saleId" INTEGER NOT NULL,
  "rowOrder" INTEGER NOT NULL DEFAULT 0,
  "goodsItemId" INTEGER NOT NULL,
  "unitId" INTEGER NOT NULL,
  "quantity" DECIMAL(36,10) NOT NULL,
  "unitPrice" DECIMAL(36,10) NOT NULL,
  "amount" DECIMAL(36,10) NOT NULL,
  "vatAmount" DECIMAL(36,10) NOT NULL,
  "priceListId" INTEGER,
  "listPrice" DECIMAL(36,10),
  "description" TEXT,
  CONSTRAINT "StoreSaleLine_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "StoreSale"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StoreSaleLine_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StoreSaleLine_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StoreSaleLine_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "SalesPriceList"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "StoreSaleLine_saleId_idx" ON "StoreSaleLine"("saleId");
CREATE INDEX "StoreSaleLine_goodsItemId_idx" ON "StoreSaleLine"("goodsItemId");
