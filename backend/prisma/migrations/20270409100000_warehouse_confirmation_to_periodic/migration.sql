-- فرم «تایید انبار» از زیرماژول «عملیات» به زیرماژول «عملیات دوره‌ای» (کلید period-end؛ عنوان قبلی «عملیات پایان دوره») منتقل شد.
-- کلید کامل هر Action شامل زیرماژول است؛ کلیدهای قدیمی را تغییر نام می‌دهیم تا grantهای موجود حفظ شود.
UPDATE "Action" SET "key" = 'inventory.period-end.warehousing-warehouse-confirmation.' || substr("key", char_length('inventory.operations.warehousing-warehouse-confirmation.') + 1)
WHERE "key" LIKE 'inventory.operations.warehousing-warehouse-confirmation.%';
