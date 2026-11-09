-- «دریافت تضمین» و «پرداخت تضمین» (مدیریت خزانه › تضامین)
CREATE TYPE "GuaranteeBasis" AS ENUM ('NO_BASIS', 'PURCHASE_ORDER');
CREATE TYPE "GuaranteeInstrumentType" AS ENUM ('CHEQUE', 'PROMISSORY', 'LETTER');

CREATE TABLE "GuaranteeDocument" (
  "id" SERIAL NOT NULL,
  "direction" "GuaranteeDirection" NOT NULL,
  "fiscalPeriodId" INTEGER NOT NULL,
  "number" INTEGER NOT NULL,
  "date" DATE NOT NULL,
  "partyId" INTEGER NOT NULL,
  "basis" "GuaranteeBasis" NOT NULL DEFAULT 'NO_BASIS',
  "purchaseOrderId" INTEGER,
  "cashBoxId" INTEGER,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuaranteeDocument_pkey" PRIMARY KEY ("id"),
  -- مبنا «سفارش خرید» فقط با سفارش، و بدون مبنا بدون سفارش
  CONSTRAINT "GuaranteeDocument_basis_chk" CHECK (("basis" = 'PURCHASE_ORDER') = ("purchaseOrderId" IS NOT NULL))
);
CREATE UNIQUE INDEX "GuaranteeDocument_direction_fiscalPeriodId_number_key" ON "GuaranteeDocument"("direction", "fiscalPeriodId", "number");
ALTER TABLE "GuaranteeDocument" ADD CONSTRAINT "GuaranteeDocument_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GuaranteeDocument" ADD CONSTRAINT "GuaranteeDocument_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GuaranteeDocument" ADD CONSTRAINT "GuaranteeDocument_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GuaranteeDocument" ADD CONSTRAINT "GuaranteeDocument_cashBoxId_fkey" FOREIGN KEY ("cashBoxId") REFERENCES "CashBox"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "GuaranteeInstrument" (
  "id" SERIAL NOT NULL,
  "documentId" INTEGER NOT NULL,
  "rowOrder" INTEGER NOT NULL DEFAULT 0,
  "type" "GuaranteeInstrumentType" NOT NULL,
  "number" TEXT NOT NULL,
  "guaranteeTypeId" INTEGER NOT NULL,
  "dueDate" DATE,
  "series" TEXT,
  "amount" DECIMAL(18,2) NOT NULL,
  "currencyId" INTEGER NOT NULL,
  "fxRate" DECIMAL(18,6) NOT NULL DEFAULT 1,
  "baseAmount" DECIMAL(36,10) NOT NULL,
  "bankBranchId" INTEGER,
  "bankAccountId" INTEGER,
  "bankPartyId" INTEGER,
  "branchCode" TEXT,
  "branchName" TEXT,
  "description" TEXT,
  CONSTRAINT "GuaranteeInstrument_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GuaranteeInstrument_documentId_idx" ON "GuaranteeInstrument"("documentId");
ALTER TABLE "GuaranteeInstrument" ADD CONSTRAINT "GuaranteeInstrument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "GuaranteeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuaranteeInstrument" ADD CONSTRAINT "GuaranteeInstrument_guaranteeTypeId_fkey" FOREIGN KEY ("guaranteeTypeId") REFERENCES "GuaranteeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GuaranteeInstrument" ADD CONSTRAINT "GuaranteeInstrument_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GuaranteeInstrument" ADD CONSTRAINT "GuaranteeInstrument_bankBranchId_fkey" FOREIGN KEY ("bankBranchId") REFERENCES "BankBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GuaranteeInstrument" ADD CONSTRAINT "GuaranteeInstrument_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GuaranteeInstrument" ADD CONSTRAINT "GuaranteeInstrument_bankPartyId_fkey" FOREIGN KEY ("bankPartyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
