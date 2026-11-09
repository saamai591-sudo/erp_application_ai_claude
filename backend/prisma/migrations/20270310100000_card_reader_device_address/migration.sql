-- آدرس دستگاه کارتخوان (اختیاری؛ خالی = پیدا کردن خودکار با شماره پایانه)
ALTER TABLE "CardReader" ADD COLUMN "deviceIp" TEXT, ADD COLUMN "devicePort" INTEGER;
