-- فرم‌های «گروه حسابداری»، «حسابداری کالا و خدمت»، «تفصیل‌های سند» و «قواعد تفصیل» از زیرماژول «تنظیمات» کالا و خدمت به زیرماژول جدید
-- «تنظیمات حسابداری» (accounting-settings) منتقل شدند. کلید کامل هر Action شامل زیرماژول است؛ کلیدهای قدیمی را تغییر نام می‌دهیم تا
-- grantهای موجود نقش‌ها/کاربران حفظ شود (وگرنه sync رجیستری Actionهای قدیمی را همراه grantهایشان حذف می‌کرد).
UPDATE "Action" SET "key" = 'goods-services.accounting-settings.' || substr("key", char_length('goods-services.config.') + 1)
WHERE "key" LIKE 'goods-services.config.accounting-groups.%'
   OR "key" LIKE 'goods-services.config.goods-service-accounting.%'
   OR "key" LIKE 'goods-services.config.warehouse-doc-details.%'
   OR "key" LIKE 'goods-services.config.detail-rules.%';
