-- «درخواست مرخصی»، «درخواست ماموریت» و «درخواست اصلاح تردد» از زیرماژول «عملیات» مدیریت تردد به زیرماژول جدید «درخواست‌های پرسنلی» منتقل شدند.
-- کلید کامل هر Action شامل زیرماژول است (module.subModule.form.action)؛ کلیدهای قدیمی را تغییر نام می‌دهیم تا grantهای موجود نقش‌ها/کاربران حفظ شود
-- (وگرنه sync رجیستری Actionهای قدیمی را همراه grantهایشان حذف می‌کرد).
UPDATE "Action" SET "key" = 'attendance.requests.' || substr("key", char_length('attendance.operations.') + 1)
WHERE "key" LIKE 'attendance.operations.attendance-leave-requests.%'
   OR "key" LIKE 'attendance.operations.attendance-mission-requests.%'
   OR "key" LIKE 'attendance.operations.attendance-correction-requests.%';
