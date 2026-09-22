-- AlterEnum
ALTER TYPE "PaymentBasisType" ADD VALUE 'SALES_INVOICE';
ALTER TYPE "PaymentBasisType" ADD VALUE 'PURCHASE_ORDER';

-- Payment: ارز از هدر به ردیف‌های ابزار منتقل شد؛ سند حسابداری اضافه شد
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_currencyId_fkey";
ALTER TABLE "Payment" DROP COLUMN "currencyId";
ALTER TABLE "Payment" ADD COLUMN "journalEntryId" INTEGER;
CREATE UNIQUE INDEX "Payment_journalEntryId_key" ON "Payment"("journalEntryId");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ChequeItem: نوع چک
ALTER TABLE "ChequeItem" ADD COLUMN "receivableChequeTypeId" INTEGER;
ALTER TABLE "ChequeItem" ADD COLUMN "payableChequeTypeId" INTEGER;
ALTER TABLE "ChequeItem" ADD CONSTRAINT "ChequeItem_receivableChequeTypeId_fkey" FOREIGN KEY ("receivableChequeTypeId") REFERENCES "ReceivableChequeType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChequeItem" ADD CONSTRAINT "ChequeItem_payableChequeTypeId_fkey" FOREIGN KEY ("payableChequeTypeId") REFERENCES "PayableChequeType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PaymentInstrumentLine: ارز/نرخ/معادل پایه و نوع چک پرداختی (جدول در زمان این مایگریشن خالی است)
ALTER TABLE "PaymentInstrumentLine" ADD COLUMN "currencyId" INTEGER NOT NULL;
ALTER TABLE "PaymentInstrumentLine" ADD COLUMN "fxRate" DECIMAL(18,6) NOT NULL DEFAULT 1;
ALTER TABLE "PaymentInstrumentLine" ADD COLUMN "baseAmount" DECIMAL(36,10) NOT NULL;
ALTER TABLE "PaymentInstrumentLine" ADD COLUMN "payableChequeTypeId" INTEGER;
ALTER TABLE "PaymentInstrumentLine" ADD CONSTRAINT "PaymentInstrumentLine_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentInstrumentLine" ADD CONSTRAINT "PaymentInstrumentLine_payableChequeTypeId_fkey" FOREIGN KEY ("payableChequeTypeId") REFERENCES "PayableChequeType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PaymentSettlementLine: موضوعات پرداخت (هم‌الگوی ReceiptSettlementLine)
ALTER TABLE "PaymentSettlementLine" DROP CONSTRAINT "PaymentSettlementLine_paymentTypeId_fkey";
ALTER TABLE "PaymentSettlementLine" ALTER COLUMN "paymentTypeId" SET NOT NULL;
ALTER TABLE "PaymentSettlementLine" ADD COLUMN "instrumentLineId" INTEGER NOT NULL;
ALTER TABLE "PaymentSettlementLine" ADD COLUMN "partyId" INTEGER NOT NULL;
ALTER TABLE "PaymentSettlementLine" ADD COLUMN "salesInvoiceId" INTEGER;
ALTER TABLE "PaymentSettlementLine" ADD COLUMN "purchaseOrderId" INTEGER;
ALTER TABLE "PaymentSettlementLine" ADD COLUMN "currencyId" INTEGER NOT NULL;
ALTER TABLE "PaymentSettlementLine" ADD COLUMN "fxRate" DECIMAL(18,6) NOT NULL DEFAULT 1;
ALTER TABLE "PaymentSettlementLine" ADD COLUMN "exchangeGainLoss" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "PaymentSettlementLine" ADD CONSTRAINT "PaymentSettlementLine_paymentTypeId_fkey" FOREIGN KEY ("paymentTypeId") REFERENCES "PaymentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentSettlementLine" ADD CONSTRAINT "PaymentSettlementLine_instrumentLineId_fkey" FOREIGN KEY ("instrumentLineId") REFERENCES "PaymentInstrumentLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentSettlementLine" ADD CONSTRAINT "PaymentSettlementLine_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentSettlementLine" ADD CONSTRAINT "PaymentSettlementLine_salesInvoiceId_fkey" FOREIGN KEY ("salesInvoiceId") REFERENCES "SalesInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentSettlementLine" ADD CONSTRAINT "PaymentSettlementLine_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentSettlementLine" ADD CONSTRAINT "PaymentSettlementLine_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- نوع سند سیستمی «اعلامیه پرداخت» (هم‌راستا با seed.ts) — فقط اگر هنوز وجود ندارد و عنوان آن برای رکورد دیگری گرفته نشده باشد
INSERT INTO "DocumentType" ("code", "title", "isSystem", "systemKey")
SELECT COALESCE(MAX("code"), 0) + 1, 'اعلامیه پرداخت', true, 'PAYMENT'
FROM "DocumentType"
WHERE NOT EXISTS (SELECT 1 FROM "DocumentType" WHERE "systemKey" = 'PAYMENT')
  AND NOT EXISTS (SELECT 1 FROM "DocumentType" WHERE "title" = 'اعلامیه پرداخت');
