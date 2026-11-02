-- «صدور بن‌کارت» فرم جدا نیست؛ اکشن گروهی «صدور» روی فرم «بن‌کارت‌ها» است.
-- کلید قدیمی «ایجاد» را تغییر نام می‌دهیم تا grantهای موجود حفظ شود (وگرنه sync رجیستری آن را با grantها حذف می‌کرد).
-- اگر کلید جدید از قبل ساخته شده باشد (سرور با رجیستری جدید بالا آمده)، grantهای قدیمی به آن منتقل می‌شوند.
UPDATE "Action" SET "key" = 'customer-club.operations.vouchers.issue'
WHERE "key" = 'customer-club.operations.voucher-batches.create'
  AND NOT EXISTS (SELECT 1 FROM "Action" WHERE "key" = 'customer-club.operations.vouchers.issue');

INSERT INTO "RoleAction" ("roleId", "actionId")
SELECT ra."roleId", n."id" FROM "RoleAction" ra
JOIN "Action" o ON o."id" = ra."actionId" AND o."key" = 'customer-club.operations.voucher-batches.create'
JOIN "Action" n ON n."key" = 'customer-club.operations.vouchers.issue'
ON CONFLICT DO NOTHING;
INSERT INTO "UserAction" ("userId", "actionId")
SELECT ua."userId", n."id" FROM "UserAction" ua
JOIN "Action" o ON o."id" = ua."actionId" AND o."key" = 'customer-club.operations.voucher-batches.create'
JOIN "Action" n ON n."key" = 'customer-club.operations.vouchers.issue'
ON CONFLICT DO NOTHING;
