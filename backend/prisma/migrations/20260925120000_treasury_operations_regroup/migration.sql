-- «عملیات» خزانه‌داری به سه زیرماژول «دریافت»، «پرداخت» و «عملیات دوره‌ای» تقسیم شد. کلید کامل هر Action شامل کلید زیرماژول است
-- (module.subModule.form.action)، پس کلیدهای قدیمی را تغییر نام می‌دهیم تا grantهای موجود نقش‌ها/کاربران (RoleAction/UserAction با
-- شناسه‌ی Action) حفظ شود؛ وگرنه sync رجیستری Actionهای قدیمی را همراه grantهایشان حذف می‌کرد.
UPDATE "Action" SET "key" = 'treasury.receipt-ops.' || substr("key", char_length('treasury.operations.') + 1)
WHERE "key" LIKE 'treasury.operations.receipts.%'
   OR "key" LIKE 'treasury.operations.cheques.%'
   OR "key" LIKE 'treasury.operations.cheque-deposits.%'
   OR "key" LIKE 'treasury.operations.cheque-deposit-returns.%'
   OR "key" LIKE 'treasury.operations.cheque-clearings-receivable.%';

UPDATE "Action" SET "key" = 'treasury.payment-ops.' || substr("key", char_length('treasury.operations.') + 1)
WHERE "key" LIKE 'treasury.operations.payments.%'
   OR "key" LIKE 'treasury.operations.cheque-clearings-payable.%';

UPDATE "Action" SET "key" = 'treasury.periodic-ops.' || substr("key", char_length('treasury.operations.') + 1)
WHERE "key" LIKE 'treasury.operations.treasury-openings.%'
   OR "key" LIKE 'treasury.operations.treasury-year-close.%';
