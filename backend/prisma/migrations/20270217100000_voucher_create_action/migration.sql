-- «ثبت بنِ تکی» اکشن پایه‌ی «ایجاد» فرم «بن‌کارت‌ها» شد؛ هر که «صدور» داشت، «ایجاد» را هم می‌گیرد (اگر کلید جدید از قبل ساخته شده باشد).
INSERT INTO "RoleAction" ("roleId", "actionId")
SELECT ra."roleId", n."id" FROM "RoleAction" ra
JOIN "Action" o ON o."id" = ra."actionId" AND o."key" = 'customer-club.operations.vouchers.issue'
JOIN "Action" n ON n."key" = 'customer-club.operations.vouchers.create'
ON CONFLICT DO NOTHING;
INSERT INTO "UserAction" ("userId", "actionId")
SELECT ua."userId", n."id" FROM "UserAction" ua
JOIN "Action" o ON o."id" = ua."actionId" AND o."key" = 'customer-club.operations.vouchers.issue'
JOIN "Action" n ON n."key" = 'customer-club.operations.vouchers.create'
ON CONFLICT DO NOTHING;
