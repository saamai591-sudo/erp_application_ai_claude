-- شماره ثبت طرف‌حساب و تاریخ اعتبار پیش‌فاکتور (برای چاپ)
ALTER TABLE "Party" ADD COLUMN "registrationNumber" TEXT;
ALTER TABLE "SalesQuote" ADD COLUMN "validUntil" DATE;
