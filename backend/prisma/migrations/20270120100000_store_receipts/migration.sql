-- فروش فروشگاهی (مرحله ۳): دریافت فروشگاهی (نقد، وابسته به یک فروش)
CREATE TABLE "StoreReceipt" (
  "id" SERIAL PRIMARY KEY,
  "fiscalPeriodId" INTEGER NOT NULL,
  "number" INTEGER NOT NULL,
  "date" DATE NOT NULL,
  "saleId" INTEGER NOT NULL,
  "stationId" INTEGER NOT NULL,
  "cashBoxId" INTEGER NOT NULL,
  "amount" DECIMAL(36,10) NOT NULL,
  "description" TEXT,
  "createdById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoreReceipt_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "StoreReceipt_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StoreReceipt_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "StoreSale"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StoreReceipt_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "SalesStation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StoreReceipt_cashBoxId_fkey" FOREIGN KEY ("cashBoxId") REFERENCES "CashBox"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "StoreReceipt_fiscalPeriodId_number_key" ON "StoreReceipt"("fiscalPeriodId", "number");
CREATE INDEX "StoreReceipt_saleId_idx" ON "StoreReceipt"("saleId");
