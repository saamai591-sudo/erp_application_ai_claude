-- تخفیف ردیف پیش‌فاکتور و سفارش فروش (مبلغی، به ارز هدر؛ پیش‌فرض صفر، پس داده‌ی قبلی تغییر نمی‌کند)
ALTER TABLE "SalesQuoteLine" ADD COLUMN "discount" DECIMAL(36,10) NOT NULL DEFAULT 0;
ALTER TABLE "SalesOrderLine" ADD COLUMN "discount" DECIMAL(36,10) NOT NULL DEFAULT 0;
