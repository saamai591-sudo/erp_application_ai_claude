-- «دستور تولید» از زیرماژول «عملیات» مدیریت تولید به زیرماژول «تولید» (کنار آمار و تحویل تولید) منتقل شد.
-- کلید کامل هر Action شامل زیرماژول است (module.subModule.form.action)؛ کلیدهای قدیمی را تغییر نام می‌دهیم تا grantهای موجود نقش‌ها/کاربران حفظ شود
-- (وگرنه sync رجیستری Actionهای قدیمی را همراه grantهایشان حذف می‌کرد).
UPDATE "Action" SET "key" = 'production.output.' || substr("key", char_length('production.operations.') + 1)
WHERE "key" LIKE 'production.operations.production-orders.%';
