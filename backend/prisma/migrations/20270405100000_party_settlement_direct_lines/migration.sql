-- «اعلامیه بدهکار بستانکار»: ردیف‌ها مستقیم به هدر وصل می‌شوند (partySettlementId) و دو سند حاوی پنهان (Receipt/Payment با شماره‌ی منفی) حذف می‌شوند.
-- مهاجرت داده: ردیف‌های هر حاوی (موضوع و ردیف حسابداری) به هدرِ مربوط منتقل می‌شود، بعد حاوی‌ها پاک می‌شوند.

-- ۱) ستون‌های جدید و اختیاری‌شدن receiptId/paymentId
ALTER TABLE "ReceiptSettlementLine" ADD COLUMN "partySettlementId" INTEGER;
ALTER TABLE "ReceiptSettlementLine" ALTER COLUMN "receiptId" DROP NOT NULL;
ALTER TABLE "PaymentSettlementLine" ADD COLUMN "partySettlementId" INTEGER;
ALTER TABLE "PaymentSettlementLine" ALTER COLUMN "paymentId" DROP NOT NULL;
ALTER TABLE "ReceiptAccountingLine" ADD COLUMN "partySettlementId" INTEGER;
ALTER TABLE "ReceiptAccountingLine" ALTER COLUMN "receiptId" DROP NOT NULL;
ALTER TABLE "PaymentAccountingLine" ADD COLUMN "partySettlementId" INTEGER;
ALTER TABLE "PaymentAccountingLine" ALTER COLUMN "paymentId" DROP NOT NULL;

-- ۲) انتقال ردیف‌ها از حاوی‌های پنهان به هدر
UPDATE "ReceiptSettlementLine" l SET "partySettlementId" = ps."id", "receiptId" = NULL FROM "PartySettlement" ps WHERE l."receiptId" = ps."receiptId";
UPDATE "PaymentSettlementLine" l SET "partySettlementId" = ps."id", "paymentId" = NULL FROM "PartySettlement" ps WHERE l."paymentId" = ps."paymentId";
UPDATE "ReceiptAccountingLine" l SET "partySettlementId" = ps."id", "receiptId" = NULL FROM "PartySettlement" ps WHERE l."receiptId" = ps."receiptId";
UPDATE "PaymentAccountingLine" l SET "partySettlementId" = ps."id", "paymentId" = NULL FROM "PartySettlement" ps WHERE l."paymentId" = ps."paymentId";

-- ۳) حذف حاوی‌ها: اول FK هدر به آن‌ها برداشته می‌شود
ALTER TABLE "PartySettlement" DROP CONSTRAINT "PartySettlement_receiptId_fkey";
ALTER TABLE "PartySettlement" DROP CONSTRAINT "PartySettlement_paymentId_fkey";
DELETE FROM "Payment" WHERE "id" IN (SELECT "paymentId" FROM "PartySettlement");
DELETE FROM "Receipt" WHERE "id" IN (SELECT "receiptId" FROM "PartySettlement");
DROP INDEX "PartySettlement_receiptId_key";
DROP INDEX "PartySettlement_paymentId_key";
ALTER TABLE "PartySettlement" DROP COLUMN "receiptId";
ALTER TABLE "PartySettlement" DROP COLUMN "paymentId";

-- ۴) کلید خارجی، ایندکس و قید «دقیقاً یکی از والدها»
ALTER TABLE "ReceiptSettlementLine" ADD CONSTRAINT "ReceiptSettlementLine_partySettlementId_fkey" FOREIGN KEY ("partySettlementId") REFERENCES "PartySettlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentSettlementLine" ADD CONSTRAINT "PaymentSettlementLine_partySettlementId_fkey" FOREIGN KEY ("partySettlementId") REFERENCES "PartySettlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReceiptAccountingLine" ADD CONSTRAINT "ReceiptAccountingLine_partySettlementId_fkey" FOREIGN KEY ("partySettlementId") REFERENCES "PartySettlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentAccountingLine" ADD CONSTRAINT "PaymentAccountingLine_partySettlementId_fkey" FOREIGN KEY ("partySettlementId") REFERENCES "PartySettlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ReceiptSettlementLine_partySettlementId_idx" ON "ReceiptSettlementLine"("partySettlementId");
CREATE INDEX "PaymentSettlementLine_partySettlementId_idx" ON "PaymentSettlementLine"("partySettlementId");
CREATE INDEX "ReceiptAccountingLine_partySettlementId_idx" ON "ReceiptAccountingLine"("partySettlementId");
CREATE INDEX "PaymentAccountingLine_partySettlementId_idx" ON "PaymentAccountingLine"("partySettlementId");
ALTER TABLE "ReceiptSettlementLine" ADD CONSTRAINT "ReceiptSettlementLine_one_parent_check" CHECK (("receiptId" IS NULL) <> ("partySettlementId" IS NULL));
ALTER TABLE "PaymentSettlementLine" ADD CONSTRAINT "PaymentSettlementLine_one_parent_check" CHECK (("paymentId" IS NULL) <> ("partySettlementId" IS NULL));
ALTER TABLE "ReceiptAccountingLine" ADD CONSTRAINT "ReceiptAccountingLine_one_parent_check" CHECK (("receiptId" IS NULL) <> ("partySettlementId" IS NULL));
ALTER TABLE "PaymentAccountingLine" ADD CONSTRAINT "PaymentAccountingLine_one_parent_check" CHECK (("paymentId" IS NULL) <> ("partySettlementId" IS NULL));
