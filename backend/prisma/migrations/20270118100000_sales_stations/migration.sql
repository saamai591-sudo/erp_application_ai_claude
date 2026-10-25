-- فروش فروشگاهی (مرحله ۱): ایستگاه فروش + حوزه‌ی ایستگاه در اعلامیه‌ی قیمت فروش
CREATE TYPE "StoreOffering" AS ENUM ('GOODS', 'SERVICES', 'BOTH');

CREATE TABLE "SalesStation" (
  "id" SERIAL PRIMARY KEY,
  "code" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "offering" "StoreOffering" NOT NULL DEFAULT 'GOODS',
  "cashBoxId" INTEGER NOT NULL,
  "warehouseId" INTEGER,
  "salesTypeId" INTEGER NOT NULL,
  "customerId" INTEGER NOT NULL,
  "costCenterId" INTEGER NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalesStation_cashBoxId_fkey" FOREIGN KEY ("cashBoxId") REFERENCES "CashBox"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SalesStation_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SalesStation_salesTypeId_fkey" FOREIGN KEY ("salesTypeId") REFERENCES "SalesType"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SalesStation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SalesStation_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SalesStation_warehouse_required_for_goods" CHECK ("offering" = 'SERVICES' OR "warehouseId" IS NOT NULL)
);
CREATE UNIQUE INDEX "SalesStation_code_key" ON "SalesStation"("code");
CREATE UNIQUE INDEX "SalesStation_title_key" ON "SalesStation"("title");

CREATE TABLE "SalesPriceListStation" (
  "id" SERIAL PRIMARY KEY,
  "priceListId" INTEGER NOT NULL,
  "stationId" INTEGER NOT NULL,
  "currencyId" INTEGER NOT NULL,
  "effectiveDate" DATE NOT NULL,
  CONSTRAINT "SalesPriceListStation_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "SalesPriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SalesPriceListStation_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "SalesStation"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SalesPriceListStation_priceListId_stationId_key" ON "SalesPriceListStation"("priceListId", "stationId");
CREATE UNIQUE INDEX "SalesPriceListStation_stationId_currencyId_effectiveDate_key" ON "SalesPriceListStation"("stationId", "currencyId", "effectiveDate");
