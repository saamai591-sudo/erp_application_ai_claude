-- CreateEnum
CREATE TYPE "TreasuryAccountType" AS ENUM ('BANK_ACCOUNT', 'BANK_FEE', 'CASH_BOX', 'RECEIVABLE_CHEQUE', 'PAYABLE_CHEQUE', 'RECEIPT_SUBJECT', 'PAYMENT_SUBJECT');

-- CreateTable
CREATE TABLE "TreasuryAccountSetting" (
    "id" SERIAL NOT NULL,
    "accountType" "TreasuryAccountType" NOT NULL,
    "bankAccountId" INTEGER,
    "cashBoxId" INTEGER,
    "receivableChequeTypeId" INTEGER,
    "payableChequeTypeId" INTEGER,
    "receiptTypeId" INTEGER,
    "paymentTypeId" INTEGER,
    "accountId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreasuryAccountSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TreasuryAccountSetting_accountType_bankAccountId_key" ON "TreasuryAccountSetting"("accountType", "bankAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "TreasuryAccountSetting_accountType_cashBoxId_key" ON "TreasuryAccountSetting"("accountType", "cashBoxId");

-- CreateIndex
CREATE UNIQUE INDEX "TreasuryAccountSetting_accountType_receivableChequeTypeId_key" ON "TreasuryAccountSetting"("accountType", "receivableChequeTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "TreasuryAccountSetting_accountType_payableChequeTypeId_key" ON "TreasuryAccountSetting"("accountType", "payableChequeTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "TreasuryAccountSetting_accountType_receiptTypeId_key" ON "TreasuryAccountSetting"("accountType", "receiptTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "TreasuryAccountSetting_accountType_paymentTypeId_key" ON "TreasuryAccountSetting"("accountType", "paymentTypeId");

-- AddForeignKey
ALTER TABLE "TreasuryAccountSetting" ADD CONSTRAINT "TreasuryAccountSetting_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryAccountSetting" ADD CONSTRAINT "TreasuryAccountSetting_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryAccountSetting" ADD CONSTRAINT "TreasuryAccountSetting_cashBoxId_fkey" FOREIGN KEY ("cashBoxId") REFERENCES "CashBox"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryAccountSetting" ADD CONSTRAINT "TreasuryAccountSetting_receivableChequeTypeId_fkey" FOREIGN KEY ("receivableChequeTypeId") REFERENCES "ReceivableChequeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryAccountSetting" ADD CONSTRAINT "TreasuryAccountSetting_payableChequeTypeId_fkey" FOREIGN KEY ("payableChequeTypeId") REFERENCES "PayableChequeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryAccountSetting" ADD CONSTRAINT "TreasuryAccountSetting_receiptTypeId_fkey" FOREIGN KEY ("receiptTypeId") REFERENCES "ReceiptType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreasuryAccountSetting" ADD CONSTRAINT "TreasuryAccountSetting_paymentTypeId_fkey" FOREIGN KEY ("paymentTypeId") REFERENCES "PaymentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
