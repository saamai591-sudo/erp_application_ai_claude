-- تحویل فروش (فروش فروشگاهی)
CREATE TYPE "StoreDeliveryStatus" AS ENUM ('REGISTERED', 'CONFIRMED', 'ACCOUNTED');
CREATE TYPE "StoreSettlementStatus" AS ENUM ('SETTLED', 'TO_CUSTOMER', 'TO_ISSUER', 'CASH_SHORTAGE');

CREATE TABLE "StoreSaleDelivery" (
    "id" SERIAL NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "stationId" INTEGER NOT NULL,
    "status" "StoreDeliveryStatus" NOT NULL DEFAULT 'REGISTERED',
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StoreSaleDelivery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StoreSaleDelivery_fiscalPeriodId_number_key" ON "StoreSaleDelivery"("fiscalPeriodId", "number");
CREATE INDEX "StoreSaleDelivery_stationId_date_idx" ON "StoreSaleDelivery"("stationId", "date");
ALTER TABLE "StoreSaleDelivery" ADD CONSTRAINT "StoreSaleDelivery_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreSaleDelivery" ADD CONSTRAINT "StoreSaleDelivery_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "SalesStation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "StoreSaleDeliverySale" (
    "id" SERIAL NOT NULL,
    "deliveryId" INTEGER NOT NULL,
    "saleId" INTEGER NOT NULL,
    "amount" DECIMAL(36,10) NOT NULL,
    "vat" DECIMAL(36,10) NOT NULL,
    "paidByMethod" JSONB NOT NULL,
    "creditAmount" DECIMAL(36,10) NOT NULL,
    "unsettledAmount" DECIMAL(36,10) NOT NULL,
    "settlementStatus" "StoreSettlementStatus" NOT NULL,
    CONSTRAINT "StoreSaleDeliverySale_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StoreSaleDeliverySale_saleId_key" ON "StoreSaleDeliverySale"("saleId");
ALTER TABLE "StoreSaleDeliverySale" ADD CONSTRAINT "StoreSaleDeliverySale_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "StoreSaleDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreSaleDeliverySale" ADD CONSTRAINT "StoreSaleDeliverySale_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "StoreSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StoreSale" ADD COLUMN "deliveryId" INTEGER;
ALTER TABLE "StoreSale" ADD CONSTRAINT "StoreSale_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "StoreSaleDelivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StoreReceipt" ADD COLUMN "deliveryId" INTEGER;
ALTER TABLE "StoreReceipt" ADD CONSTRAINT "StoreReceipt_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "StoreSaleDelivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;
