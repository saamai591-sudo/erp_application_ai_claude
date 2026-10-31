-- «وضعیت پیش‌فرض فاکتورهای تسویه‌نشده» ایستگاه فروش: پیش‌فرض وضعیت فروش‌های تسویه‌نشده در تحویل فروش (SETTLED معنی ندارد)
ALTER TABLE "SalesStation" ADD COLUMN "defaultUnsettledStatus" "StoreSettlementStatus" NOT NULL DEFAULT 'TO_CUSTOMER';
ALTER TABLE "SalesStation" ADD CONSTRAINT "SalesStation_defaultUnsettledStatus_check" CHECK ("defaultUnsettledStatus" <> 'SETTLED');
