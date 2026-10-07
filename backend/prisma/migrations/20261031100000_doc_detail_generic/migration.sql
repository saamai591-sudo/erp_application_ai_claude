-- «تفصیل‌های سند» عمومی شد: کلید نوع سند از enum انبار به متن (برای انواع سند دیگر مثل فاکتور خرید خدمت)
ALTER TABLE "WarehouseDocDetailSetting" ALTER COLUMN "documentType" TYPE TEXT USING "documentType"::text;
