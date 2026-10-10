-- سریال لایسنس روی حافظه‌ی مالیاتی (گره‌زدن ارسال به لایسنس) و ممیزی روی صورتحساب‌های ارسالی
ALTER TABLE "TaxMemory" ADD COLUMN "licenseSerial" TEXT;
ALTER TABLE "TaxInvoice" ADD COLUMN "licenseSerial" TEXT, ADD COLUMN "serverBindingHash" TEXT;
