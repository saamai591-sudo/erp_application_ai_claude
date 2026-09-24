-- فرم‌های «نقش کاربری»، «کاربر»، «نوع تفصیل»، «ساختار سازمانی» و «مناطق جغرافیایی» از ماژول «تنظیمات» به زیرماژول «تنظیمات» ماژول
-- «اطلاعات پایه» منتقل شدند. کلید کامل هر Action شامل ماژول و زیرماژول است (module.subModule.form.action)، پس کلیدهای قدیمی را تغییر
-- نام می‌دهیم تا grantهای موجود نقش‌ها/کاربران (RoleAction/UserAction با شناسه‌ی Action) حفظ شود؛ وگرنه sync رجیستری Actionهای قدیمی را
-- همراه grantهایشان حذف می‌کرد.
UPDATE "Action" SET "key" = 'master-data.settings.' || substr("key", char_length('settings.operations.') + 1)
WHERE "key" LIKE 'settings.operations.roles.%'
   OR "key" LIKE 'settings.operations.users.%'
   OR "key" LIKE 'settings.operations.detail-types.%'
   OR "key" LIKE 'settings.operations.org-structure.%'
   OR "key" LIKE 'settings.operations.geo.%';
