-- حساب‌های بانکی قابل دریافتِ ایستگاه فروش + دریافت حواله و شماره پیگیری در دریافت فروشگاهی
CREATE TABLE "SalesStationBankAccount" (
    "id" SERIAL NOT NULL,
    "stationId" INTEGER NOT NULL,
    "bankAccountId" INTEGER NOT NULL,
    CONSTRAINT "SalesStationBankAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SalesStationBankAccount_stationId_bankAccountId_key" ON "SalesStationBankAccount"("stationId", "bankAccountId");
ALTER TABLE "SalesStationBankAccount" ADD CONSTRAINT "SalesStationBankAccount_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "SalesStation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesStationBankAccount" ADD CONSTRAINT "SalesStationBankAccount_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StoreReceipt" ADD COLUMN "bankAccountId" INTEGER, ADD COLUMN "referenceNumber" TEXT;
ALTER TABLE "StoreReceipt" ADD CONSTRAINT "StoreReceipt_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- دقیقاً یکی از: صندوق (نقد) / کارتخوان / حساب بانکی (حواله)
ALTER TABLE "StoreReceipt" DROP CONSTRAINT "StoreReceipt_method_check";
ALTER TABLE "StoreReceipt" ADD CONSTRAINT "StoreReceipt_method_check" CHECK (("cashBoxId" IS NOT NULL)::int + ("cardReaderId" IS NOT NULL)::int + ("bankAccountId" IS NOT NULL)::int = 1);
