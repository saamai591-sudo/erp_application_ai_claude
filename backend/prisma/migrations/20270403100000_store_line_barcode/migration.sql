-- بارکدی که ردیف فروش/برگشت فروش فروشگاهی از آن آمده؛ اگر «تفسیر بارکد» مبلغ (فی) داشته باشد، فیِ ردیف از همان می‌آید و بر فی اعلامیه‌ی قیمت مقدم است
ALTER TABLE "StoreSaleLine" ADD COLUMN "barcode" TEXT;
ALTER TABLE "StoreSaleReturnLine" ADD COLUMN "barcode" TEXT;
