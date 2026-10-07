-- CreateEnum
CREATE TYPE "AccountingApprovalStatus" AS ENUM ('NONE', 'APPROVED');

-- CreateEnum
CREATE TYPE "AccountingLineRole" AS ENUM ('INSTRUMENT', 'SUBJECT', 'FX', 'FEE');

-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN "accountingStatus" "AccountingApprovalStatus" NOT NULL DEFAULT 'NONE', ADD COLUMN "accountingApprovedAt" TIMESTAMP(3), ADD COLUMN "accountingApprovedById" INTEGER;
ALTER TABLE "Payment" ADD COLUMN "accountingStatus" "AccountingApprovalStatus" NOT NULL DEFAULT 'NONE', ADD COLUMN "accountingApprovedAt" TIMESTAMP(3), ADD COLUMN "accountingApprovedById" INTEGER;

-- CreateTable
CREATE TABLE "ReceiptAccountingLine" (
    "id" SERIAL NOT NULL,
    "receiptId" INTEGER NOT NULL,
    "role" "AccountingLineRole" NOT NULL,
    "instrumentLineId" INTEGER,
    "settlementLineId" INTEGER,
    "accountId" INTEGER NOT NULL,
    "treasurySettingId" INTEGER,
    "goodsSettingId" INTEGER,
    "detail1Code" TEXT,
    "detail2Code" TEXT,
    "detail3Code" TEXT,

    CONSTRAINT "ReceiptAccountingLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAccountingLine" (
    "id" SERIAL NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "role" "AccountingLineRole" NOT NULL,
    "instrumentLineId" INTEGER,
    "settlementLineId" INTEGER,
    "accountId" INTEGER NOT NULL,
    "treasurySettingId" INTEGER,
    "goodsSettingId" INTEGER,
    "detail1Code" TEXT,
    "detail2Code" TEXT,
    "detail3Code" TEXT,

    CONSTRAINT "PaymentAccountingLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReceiptAccountingLine_receiptId_idx" ON "ReceiptAccountingLine"("receiptId");
CREATE INDEX "ReceiptAccountingLine_treasurySettingId_idx" ON "ReceiptAccountingLine"("treasurySettingId");
CREATE INDEX "PaymentAccountingLine_paymentId_idx" ON "PaymentAccountingLine"("paymentId");
CREATE INDEX "PaymentAccountingLine_treasurySettingId_idx" ON "PaymentAccountingLine"("treasurySettingId");

-- یکتایی (پدر، نقش) — ایندکس جزئی؛ Prisma نمی‌تواند مدل کند
CREATE UNIQUE INDEX "ReceiptAccountingLine_instrument_role_unique" ON "ReceiptAccountingLine"("instrumentLineId", "role") WHERE "instrumentLineId" IS NOT NULL;
CREATE UNIQUE INDEX "ReceiptAccountingLine_settlement_role_unique" ON "ReceiptAccountingLine"("settlementLineId", "role") WHERE "settlementLineId" IS NOT NULL;
CREATE UNIQUE INDEX "PaymentAccountingLine_instrument_role_unique" ON "PaymentAccountingLine"("instrumentLineId", "role") WHERE "instrumentLineId" IS NOT NULL;
CREATE UNIQUE INDEX "PaymentAccountingLine_settlement_role_unique" ON "PaymentAccountingLine"("settlementLineId", "role") WHERE "settlementLineId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "ReceiptAccountingLine" ADD CONSTRAINT "ReceiptAccountingLine_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReceiptAccountingLine" ADD CONSTRAINT "ReceiptAccountingLine_instrumentLineId_fkey" FOREIGN KEY ("instrumentLineId") REFERENCES "ReceiptInstrumentLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReceiptAccountingLine" ADD CONSTRAINT "ReceiptAccountingLine_settlementLineId_fkey" FOREIGN KEY ("settlementLineId") REFERENCES "ReceiptSettlementLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReceiptAccountingLine" ADD CONSTRAINT "ReceiptAccountingLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentAccountingLine" ADD CONSTRAINT "PaymentAccountingLine_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentAccountingLine" ADD CONSTRAINT "PaymentAccountingLine_instrumentLineId_fkey" FOREIGN KEY ("instrumentLineId") REFERENCES "PaymentInstrumentLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentAccountingLine" ADD CONSTRAINT "PaymentAccountingLine_settlementLineId_fkey" FOREIGN KEY ("settlementLineId") REFERENCES "PaymentSettlementLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentAccountingLine" ADD CONSTRAINT "PaymentAccountingLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
