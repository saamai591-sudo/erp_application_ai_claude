-- «انتقال به صندوق»: انتقال چک‌های دریافتیِ «در دست» بین صندوق‌ها (رویداد چرخه‌ی عمر چک؛ بدون سند حسابداری)
CREATE TABLE "CashBoxTransfer" (
  "id" SERIAL NOT NULL,
  "fiscalPeriodId" INTEGER NOT NULL,
  "number" INTEGER NOT NULL,
  "date" DATE NOT NULL,
  "fromCashBoxId" INTEGER NOT NULL,
  "toCashBoxId" INTEGER NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CashBoxTransfer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CashBoxTransfer_different_boxes_check" CHECK ("fromCashBoxId" <> "toCashBoxId")
);
CREATE UNIQUE INDEX "CashBoxTransfer_fiscalPeriodId_number_key" ON "CashBoxTransfer"("fiscalPeriodId", "number");
ALTER TABLE "CashBoxTransfer" ADD CONSTRAINT "CashBoxTransfer_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashBoxTransfer" ADD CONSTRAINT "CashBoxTransfer_fromCashBoxId_fkey" FOREIGN KEY ("fromCashBoxId") REFERENCES "CashBox"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashBoxTransfer" ADD CONSTRAINT "CashBoxTransfer_toCashBoxId_fkey" FOREIGN KEY ("toCashBoxId") REFERENCES "CashBox"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CashBoxTransferLine" (
  "id" SERIAL NOT NULL,
  "transferId" INTEGER NOT NULL,
  "rowOrder" INTEGER NOT NULL DEFAULT 0,
  "chequeItemId" INTEGER NOT NULL,
  "chequeStep" INTEGER,
  CONSTRAINT "CashBoxTransferLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CashBoxTransferLine_transferId_idx" ON "CashBoxTransferLine"("transferId");
CREATE INDEX "CashBoxTransferLine_chequeItemId_idx" ON "CashBoxTransferLine"("chequeItemId");
ALTER TABLE "CashBoxTransferLine" ADD CONSTRAINT "CashBoxTransferLine_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "CashBoxTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashBoxTransferLine" ADD CONSTRAINT "CashBoxTransferLine_chequeItemId_fkey" FOREIGN KEY ("chequeItemId") REFERENCES "ChequeItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
