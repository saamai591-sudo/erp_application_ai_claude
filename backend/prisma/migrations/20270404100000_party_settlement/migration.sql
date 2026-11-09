-- «اعلامیه بدهکار بستانکار» (تسویه بین طرف‌حساب‌ها بدون ابزار): هدر مشترک دو سند حاوی پنهان (Receipt و Payment)
-- ردیف‌های موضوعات بدون ابزار: instrumentLineId اختیاری می‌شود؛ ردیف پرداخت با sourceReceiptLineId به ردیف دریافت وصل می‌شود
ALTER TABLE "ReceiptSettlementLine" ALTER COLUMN "instrumentLineId" DROP NOT NULL;
ALTER TABLE "PaymentSettlementLine" ALTER COLUMN "instrumentLineId" DROP NOT NULL;
ALTER TABLE "PaymentSettlementLine" ADD COLUMN "sourceReceiptLineId" INTEGER;
ALTER TABLE "PaymentSettlementLine" ADD CONSTRAINT "PaymentSettlementLine_sourceReceiptLineId_fkey" FOREIGN KEY ("sourceReceiptLineId") REFERENCES "ReceiptSettlementLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "PaymentSettlementLine_sourceReceiptLineId_idx" ON "PaymentSettlementLine"("sourceReceiptLineId");
-- هر ردیف پرداخت یا ابزار دارد یا ردیف دریافت مبدأ؛ هر دو هم‌زمان نه
ALTER TABLE "PaymentSettlementLine" ADD CONSTRAINT "PaymentSettlementLine_instrument_or_source_check" CHECK ("instrumentLineId" IS NULL OR "sourceReceiptLineId" IS NULL);

CREATE TABLE "PartySettlement" (
  "id" SERIAL PRIMARY KEY,
  "fiscalPeriodId" INTEGER NOT NULL,
  "number" INTEGER NOT NULL,
  "date" DATE NOT NULL,
  "description" TEXT,
  "receiptId" INTEGER NOT NULL,
  "paymentId" INTEGER NOT NULL,
  "accountingStatus" "AccountingApprovalStatus" NOT NULL DEFAULT 'NONE',
  "accountingApprovedAt" TIMESTAMP(3),
  "accountingApprovedById" INTEGER,
  "journalEntryId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PartySettlement_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PartySettlement_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PartySettlement_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PartySettlement_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PartySettlement_receiptId_key" ON "PartySettlement"("receiptId");
CREATE UNIQUE INDEX "PartySettlement_paymentId_key" ON "PartySettlement"("paymentId");
CREATE UNIQUE INDEX "PartySettlement_journalEntryId_key" ON "PartySettlement"("journalEntryId");
CREATE UNIQUE INDEX "PartySettlement_fiscalPeriodId_number_key" ON "PartySettlement"("fiscalPeriodId", "number");
