-- کارتخوان: درایور اتصال + تراکنش‌های پرداخت (فروش فروشگاهی)
CREATE TYPE "CardReaderDriver" AS ENUM ('MANUAL', 'SIMULATOR');
CREATE TYPE "CardTransactionStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'UNKNOWN');

ALTER TABLE "CardReader" ADD COLUMN "driver" "CardReaderDriver" NOT NULL DEFAULT 'MANUAL';

CREATE TABLE "CardReaderTransaction" (
  "id" SERIAL NOT NULL,
  "requestUid" TEXT NOT NULL,
  "saleId" INTEGER NOT NULL,
  "cardReaderId" INTEGER NOT NULL,
  "driver" "CardReaderDriver" NOT NULL,
  "date" DATE NOT NULL,
  "amount" DECIMAL(36,10) NOT NULL,
  "status" "CardTransactionStatus" NOT NULL DEFAULT 'PENDING',
  "referenceNumber" TEXT,
  "maskedCard" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "receiptId" INTEGER,
  "createdById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "CardReaderTransaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CardReaderTransaction_requestUid_key" ON "CardReaderTransaction"("requestUid");
CREATE UNIQUE INDEX "CardReaderTransaction_receiptId_key" ON "CardReaderTransaction"("receiptId");
CREATE INDEX "CardReaderTransaction_saleId_idx" ON "CardReaderTransaction"("saleId");
ALTER TABLE "CardReaderTransaction" ADD CONSTRAINT "CardReaderTransaction_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "StoreSale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CardReaderTransaction" ADD CONSTRAINT "CardReaderTransaction_cardReaderId_fkey" FOREIGN KEY ("cardReaderId") REFERENCES "CardReader"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CardReaderTransaction" ADD CONSTRAINT "CardReaderTransaction_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "StoreReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
