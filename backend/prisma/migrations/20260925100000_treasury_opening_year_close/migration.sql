-- CreateEnum
CREATE TYPE "TreasuryCloseSection" AS ENUM ('BANK_ACCOUNTS', 'CASH_BOXES', 'RECEIVABLE_CHEQUES', 'PAYABLE_CHEQUES');

-- AlterTable: ChequeItem — دوره مالی، چک والد (انتقال پایان سال) و اطلاعات افتتاحیه
ALTER TABLE "ChequeItem" ADD COLUMN "fiscalPeriodId" INTEGER,
ADD COLUMN "parentChequeId" INTEGER,
ADD COLUMN "isOpening" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "openingReceiptTypeId" INTEGER,
ADD COLUMN "openingPaymentTypeId" INTEGER;

-- پرکردن دوره مالی چک‌های موجود: دوره‌ی سند دریافت/پرداختی که چک را ایجاد کرده، وگرنه دوره‌ای که تاریخ ایجاد در آن است، وگرنه آخرین دوره
UPDATE "ChequeItem" c SET "fiscalPeriodId" = COALESCE(
  (SELECT r."fiscalPeriodId" FROM "ReceiptInstrumentLine" l JOIN "Receipt" r ON r."id" = l."receiptId" WHERE l."chequeItemId" = c."id" LIMIT 1),
  (SELECT p."fiscalPeriodId" FROM "PaymentInstrumentLine" l JOIN "Payment" p ON p."id" = l."paymentId" WHERE l."chequeItemId" = c."id" LIMIT 1),
  (SELECT fp."id" FROM "FiscalPeriod" fp WHERE c."createdAt"::date BETWEEN fp."fromDate" AND fp."toDate" ORDER BY fp."fromDate" DESC LIMIT 1),
  (SELECT "id" FROM "FiscalPeriod" ORDER BY "toDate" DESC LIMIT 1)
);

ALTER TABLE "ChequeItem" ALTER COLUMN "fiscalPeriodId" SET NOT NULL;

-- CreateTable
CREATE TABLE "TreasuryOpening" (
    "id" SERIAL NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TreasuryOpening_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TreasuryOpeningBankAccount" (
    "id" SERIAL NOT NULL,
    "openingId" INTEGER NOT NULL,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,
    "bankAccountId" INTEGER NOT NULL,
    "currencyId" INTEGER NOT NULL,
    "balance" DECIMAL(18,2) NOT NULL,
    "baseBalance" DECIMAL(18,2) NOT NULL,
    CONSTRAINT "TreasuryOpeningBankAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TreasuryOpeningCashBox" (
    "id" SERIAL NOT NULL,
    "openingId" INTEGER NOT NULL,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,
    "cashBoxId" INTEGER NOT NULL,
    "currencyId" INTEGER NOT NULL,
    "balance" DECIMAL(18,2) NOT NULL,
    "baseBalance" DECIMAL(18,2) NOT NULL,
    CONSTRAINT "TreasuryOpeningCashBox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TreasuryYearClose" (
    "id" SERIAL NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "section" "TreasuryCloseSection" NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TreasuryYearClose_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChequeItem_fiscalPeriodId_idx" ON "ChequeItem"("fiscalPeriodId");
CREATE UNIQUE INDEX "TreasuryOpening_fiscalPeriodId_key" ON "TreasuryOpening"("fiscalPeriodId");
CREATE UNIQUE INDEX "TreasuryOpeningBankAccount_openingId_bankAccountId_key" ON "TreasuryOpeningBankAccount"("openingId", "bankAccountId");
CREATE UNIQUE INDEX "TreasuryOpeningCashBox_openingId_cashBoxId_currencyId_key" ON "TreasuryOpeningCashBox"("openingId", "cashBoxId", "currencyId");
CREATE UNIQUE INDEX "TreasuryYearClose_fiscalPeriodId_section_key" ON "TreasuryYearClose"("fiscalPeriodId", "section");

-- AddForeignKey
ALTER TABLE "ChequeItem" ADD CONSTRAINT "ChequeItem_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChequeItem" ADD CONSTRAINT "ChequeItem_parentChequeId_fkey" FOREIGN KEY ("parentChequeId") REFERENCES "ChequeItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChequeItem" ADD CONSTRAINT "ChequeItem_openingReceiptTypeId_fkey" FOREIGN KEY ("openingReceiptTypeId") REFERENCES "ReceiptType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChequeItem" ADD CONSTRAINT "ChequeItem_openingPaymentTypeId_fkey" FOREIGN KEY ("openingPaymentTypeId") REFERENCES "PaymentType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TreasuryOpening" ADD CONSTRAINT "TreasuryOpening_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TreasuryOpeningBankAccount" ADD CONSTRAINT "TreasuryOpeningBankAccount_openingId_fkey" FOREIGN KEY ("openingId") REFERENCES "TreasuryOpening"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TreasuryOpeningBankAccount" ADD CONSTRAINT "TreasuryOpeningBankAccount_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TreasuryOpeningBankAccount" ADD CONSTRAINT "TreasuryOpeningBankAccount_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TreasuryOpeningCashBox" ADD CONSTRAINT "TreasuryOpeningCashBox_openingId_fkey" FOREIGN KEY ("openingId") REFERENCES "TreasuryOpening"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TreasuryOpeningCashBox" ADD CONSTRAINT "TreasuryOpeningCashBox_cashBoxId_fkey" FOREIGN KEY ("cashBoxId") REFERENCES "CashBox"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TreasuryOpeningCashBox" ADD CONSTRAINT "TreasuryOpeningCashBox_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TreasuryYearClose" ADD CONSTRAINT "TreasuryYearClose_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
