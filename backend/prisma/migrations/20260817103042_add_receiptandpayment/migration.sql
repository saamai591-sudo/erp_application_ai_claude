-- CreateEnum
CREATE TYPE "PaymentInstrumentType" AS ENUM ('CASH', 'BANK_TRANSFER', 'CHEQUE', 'POS');

-- CreateEnum
CREATE TYPE "TreasuryDocStatus" AS ENUM ('DRAFT', 'APPROVED');

-- CreateEnum
CREATE TYPE "ChequeDirection" AS ENUM ('RECEIVABLE', 'PAYABLE');

-- CreateEnum
CREATE TYPE "ChequeStatus" AS ENUM ('IN_HAND', 'IN_COLLECTION', 'ISSUED', 'CLEARED', 'BOUNCED', 'ENDORSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ChequeItem" (
    "id" SERIAL NOT NULL,
    "direction" "ChequeDirection" NOT NULL,
    "number" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "bankBranchId" INTEGER,
    "ownerBankAccountId" INTEGER,
    "partyId" INTEGER NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currencyId" INTEGER NOT NULL,
    "status" "ChequeStatus" NOT NULL DEFAULT 'IN_HAND',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChequeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" SERIAL NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "partyId" INTEGER NOT NULL,
    "currencyId" INTEGER NOT NULL,
    "description" TEXT,
    "status" "TreasuryDocStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptInstrumentLine" (
    "id" SERIAL NOT NULL,
    "receiptId" INTEGER NOT NULL,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,
    "type" "PaymentInstrumentType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "cashBoxId" INTEGER,
    "bankAccountId" INTEGER,
    "referenceNumber" TEXT,
    "chequeItemId" INTEGER,
    "chequeNumber" TEXT,
    "chequeDueDate" DATE,
    "chequeBankBranchId" INTEGER,
    "posTerminal" TEXT,
    "description" TEXT,

    CONSTRAINT "ReceiptInstrumentLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptSettlementLine" (
    "id" SERIAL NOT NULL,
    "receiptId" INTEGER NOT NULL,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,
    "salesInvoiceId" INTEGER,
    "amount" DECIMAL(18,2) NOT NULL,
    "description" TEXT,

    CONSTRAINT "ReceiptSettlementLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "partyId" INTEGER NOT NULL,
    "currencyId" INTEGER NOT NULL,
    "description" TEXT,
    "status" "TreasuryDocStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentInstrumentLine" (
    "id" SERIAL NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,
    "type" "PaymentInstrumentType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "cashBoxId" INTEGER,
    "bankAccountId" INTEGER,
    "referenceNumber" TEXT,
    "chequeItemId" INTEGER,
    "chequeNumber" TEXT,
    "chequeDueDate" DATE,
    "chequeBankBranchId" INTEGER,
    "posTerminal" TEXT,
    "description" TEXT,

    CONSTRAINT "PaymentInstrumentLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSettlementLine" (
    "id" SERIAL NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,
    "purchaseInvoiceId" INTEGER,
    "amount" DECIMAL(18,2) NOT NULL,
    "description" TEXT,

    CONSTRAINT "PaymentSettlementLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_fiscalPeriodId_number_key" ON "Receipt"("fiscalPeriodId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_fiscalPeriodId_number_key" ON "Payment"("fiscalPeriodId", "number");

-- AddForeignKey
ALTER TABLE "ChequeItem" ADD CONSTRAINT "ChequeItem_bankBranchId_fkey" FOREIGN KEY ("bankBranchId") REFERENCES "BankBranch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChequeItem" ADD CONSTRAINT "ChequeItem_ownerBankAccountId_fkey" FOREIGN KEY ("ownerBankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChequeItem" ADD CONSTRAINT "ChequeItem_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChequeItem" ADD CONSTRAINT "ChequeItem_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptInstrumentLine" ADD CONSTRAINT "ReceiptInstrumentLine_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptInstrumentLine" ADD CONSTRAINT "ReceiptInstrumentLine_cashBoxId_fkey" FOREIGN KEY ("cashBoxId") REFERENCES "CashBox"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptInstrumentLine" ADD CONSTRAINT "ReceiptInstrumentLine_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptInstrumentLine" ADD CONSTRAINT "ReceiptInstrumentLine_chequeItemId_fkey" FOREIGN KEY ("chequeItemId") REFERENCES "ChequeItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptInstrumentLine" ADD CONSTRAINT "ReceiptInstrumentLine_chequeBankBranchId_fkey" FOREIGN KEY ("chequeBankBranchId") REFERENCES "BankBranch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptSettlementLine" ADD CONSTRAINT "ReceiptSettlementLine_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptSettlementLine" ADD CONSTRAINT "ReceiptSettlementLine_salesInvoiceId_fkey" FOREIGN KEY ("salesInvoiceId") REFERENCES "SalesInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentInstrumentLine" ADD CONSTRAINT "PaymentInstrumentLine_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentInstrumentLine" ADD CONSTRAINT "PaymentInstrumentLine_cashBoxId_fkey" FOREIGN KEY ("cashBoxId") REFERENCES "CashBox"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentInstrumentLine" ADD CONSTRAINT "PaymentInstrumentLine_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentInstrumentLine" ADD CONSTRAINT "PaymentInstrumentLine_chequeItemId_fkey" FOREIGN KEY ("chequeItemId") REFERENCES "ChequeItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentInstrumentLine" ADD CONSTRAINT "PaymentInstrumentLine_chequeBankBranchId_fkey" FOREIGN KEY ("chequeBankBranchId") REFERENCES "BankBranch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSettlementLine" ADD CONSTRAINT "PaymentSettlementLine_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentSettlementLine" ADD CONSTRAINT "PaymentSettlementLine_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "PurchaseInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
