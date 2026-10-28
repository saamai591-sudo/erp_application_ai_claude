-- ردیف ابزار نوع POS در سند دریافت: کارتخوان انتخاب‌شده (حساب بانکی از کارتخوان می‌آید)
ALTER TABLE "ReceiptInstrumentLine" ADD COLUMN "cardReaderId" INTEGER;
ALTER TABLE "ReceiptInstrumentLine" ADD CONSTRAINT "ReceiptInstrumentLine_cardReaderId_fkey" FOREIGN KEY ("cardReaderId") REFERENCES "CardReader"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
