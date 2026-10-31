-- «حواله فروش فروشگاهی» و «برگشت حواله فروش فروشگاهی» اسناد انبارند: از ماژول «فروش فروشگاهی» به «مدیریت موجودی و انبار» (حواله انبار / برگشت حواله) منتقل شدند.
-- کلید کامل Action شامل ماژول و زیرماژول است؛ کلیدهای قدیمی را تغییر نام می‌دهیم تا grantهای موجود حفظ شود (وگرنه sync رجیستری آن‌ها را با grantها حذف می‌کرد).
UPDATE "Action" SET "key" = 'inventory.outbound-issues.store-sale-issues.view'
WHERE "key" = 'store-sales.operations.store-sale-issues.view';
UPDATE "Action" SET "key" = 'inventory.issue-returns.store-sale-returns.view'
WHERE "key" = 'store-sales.operations.store-sale-returns.view';

-- طرف مقابل حواله‌های فروش فروشگاهی که تا امروز ساخته شده‌اند = مرکز هزینه‌ی ایستگاه فروش همان تحویل (تفصیل پایه‌ی این نوع سند)
UPDATE "InventoryDocument" d
SET "detailCode" = cc."detailCode"
FROM "StoreSaleDelivery" sd
JOIN "SalesStation" st ON st."id" = sd."stationId"
JOIN "CostCenter" cc ON cc."id" = st."costCenterId"
WHERE d."storeDeliveryId" = sd."id" AND d."detailCode" IS NULL;
