-- کارتخوان‌های هر ایستگاه فروش + دریافت کارتیِ فروش فروشگاهی
CREATE TABLE "SalesStationCardReader" (
    "id" SERIAL NOT NULL,
    "stationId" INTEGER NOT NULL,
    "cardReaderId" INTEGER NOT NULL,
    CONSTRAINT "SalesStationCardReader_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SalesStationCardReader_stationId_cardReaderId_key" ON "SalesStationCardReader"("stationId", "cardReaderId");
ALTER TABLE "SalesStationCardReader" ADD CONSTRAINT "SalesStationCardReader_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "SalesStation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesStationCardReader" ADD CONSTRAINT "SalesStationCardReader_cardReaderId_fkey" FOREIGN KEY ("cardReaderId") REFERENCES "CardReader"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- دریافت فروشگاهی: نقد (صندوق) یا کارتی (کارتخوان) — دقیقاً یکی
ALTER TABLE "StoreReceipt" ALTER COLUMN "cashBoxId" DROP NOT NULL;
ALTER TABLE "StoreReceipt" ADD COLUMN "cardReaderId" INTEGER;
ALTER TABLE "StoreReceipt" ADD CONSTRAINT "StoreReceipt_cardReaderId_fkey" FOREIGN KEY ("cardReaderId") REFERENCES "CardReader"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreReceipt" ADD CONSTRAINT "StoreReceipt_method_check" CHECK (("cashBoxId" IS NULL) <> ("cardReaderId" IS NULL));
