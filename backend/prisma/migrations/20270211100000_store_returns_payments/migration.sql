-- برگشت فروش فروشگاهی + پرداخت فروشگاهی (بازپرداخت به مشتری) + ردیف «برگشت فروش» در تحویل فروش

CREATE TABLE "StoreSaleReturn" (
  "id" SERIAL PRIMARY KEY,
  "fiscalPeriodId" INTEGER NOT NULL,
  "number" INTEGER NOT NULL,
  "date" DATE NOT NULL,
  "saleId" INTEGER NOT NULL,
  "stationId" INTEGER NOT NULL,
  "warehouseId" INTEGER,
  "description" TEXT,
  "deliveryId" INTEGER,
  "createdById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "StoreSaleReturn_fiscalPeriodId_number_key" ON "StoreSaleReturn"("fiscalPeriodId", "number");
CREATE INDEX "StoreSaleReturn_saleId_idx" ON "StoreSaleReturn"("saleId");
CREATE INDEX "StoreSaleReturn_stationId_date_idx" ON "StoreSaleReturn"("stationId", "date");
ALTER TABLE "StoreSaleReturn" ADD CONSTRAINT "StoreSaleReturn_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "StoreSale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreSaleReturn" ADD CONSTRAINT "StoreSaleReturn_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "StoreSaleDelivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "StoreSaleReturnLine" (
  "id" SERIAL PRIMARY KEY,
  "returnId" INTEGER NOT NULL,
  "rowOrder" INTEGER NOT NULL DEFAULT 0,
  "saleLineId" INTEGER NOT NULL,
  "quantity" DECIMAL(36,10) NOT NULL,
  "amount" DECIMAL(36,10) NOT NULL,
  "vatAmount" DECIMAL(36,10) NOT NULL
);
CREATE INDEX "StoreSaleReturnLine_returnId_idx" ON "StoreSaleReturnLine"("returnId");
CREATE INDEX "StoreSaleReturnLine_saleLineId_idx" ON "StoreSaleReturnLine"("saleLineId");
ALTER TABLE "StoreSaleReturnLine" ADD CONSTRAINT "StoreSaleReturnLine_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "StoreSaleReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreSaleReturnLine" ADD CONSTRAINT "StoreSaleReturnLine_saleLineId_fkey" FOREIGN KEY ("saleLineId") REFERENCES "StoreSaleLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "StorePayment" (
  "id" SERIAL PRIMARY KEY,
  "fiscalPeriodId" INTEGER NOT NULL,
  "number" INTEGER NOT NULL,
  "date" DATE NOT NULL,
  "returnId" INTEGER NOT NULL,
  "stationId" INTEGER NOT NULL,
  "cashBoxId" INTEGER,
  "bankAccountId" INTEGER,
  "referenceNumber" TEXT,
  "amount" DECIMAL(36,10) NOT NULL,
  "description" TEXT,
  "deliveryId" INTEGER,
  "createdById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StorePayment_one_method_check" CHECK (("cashBoxId" IS NOT NULL) <> ("bankAccountId" IS NOT NULL))
);
CREATE UNIQUE INDEX "StorePayment_fiscalPeriodId_number_key" ON "StorePayment"("fiscalPeriodId", "number");
CREATE INDEX "StorePayment_returnId_idx" ON "StorePayment"("returnId");
ALTER TABLE "StorePayment" ADD CONSTRAINT "StorePayment_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "StoreSaleReturn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StorePayment" ADD CONSTRAINT "StorePayment_cashBoxId_fkey" FOREIGN KEY ("cashBoxId") REFERENCES "CashBox"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StorePayment" ADD CONSTRAINT "StorePayment_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StorePayment" ADD CONSTRAINT "StorePayment_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "StoreSaleDelivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ردیف تحویل: فروش یا برگشت فروش (دقیقاً یکی)
ALTER TABLE "StoreSaleDeliverySale" ALTER COLUMN "saleId" DROP NOT NULL;
ALTER TABLE "StoreSaleDeliverySale" ADD COLUMN "returnId" INTEGER;
CREATE UNIQUE INDEX "StoreSaleDeliverySale_returnId_key" ON "StoreSaleDeliverySale"("returnId");
ALTER TABLE "StoreSaleDeliverySale" ADD CONSTRAINT "StoreSaleDeliverySale_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "StoreSaleReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreSaleDeliverySale" ADD CONSTRAINT "StoreSaleDeliverySale_one_kind_check" CHECK (("saleId" IS NOT NULL) <> ("returnId" IS NOT NULL));
