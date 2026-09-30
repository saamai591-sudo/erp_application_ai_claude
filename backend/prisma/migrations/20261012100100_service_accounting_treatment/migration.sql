-- «نحوه حسابداری» خدمت (هزینه / بهای موجودی) و خدمتِ تنظیم «خرید خدمت» در حسابداری کالا و خدمت.
CREATE TYPE "ServiceAccountingTreatment" AS ENUM ('EXPENSE', 'INVENTORY_COST');

ALTER TABLE "GoodsItem" ADD COLUMN "accountingTreatment" "ServiceAccountingTreatment";

ALTER TABLE "GoodsServiceAccountingSetting" ADD COLUMN "serviceId" INTEGER;
ALTER TABLE "GoodsServiceAccountingSetting"
  ADD CONSTRAINT "GoodsServiceAccountingSetting_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "GoodsServiceAccountingSetting_serviceId_idx" ON "GoodsServiceAccountingSetting"("serviceId");

-- داده‌ی موجود: هر خدمت پیش‌فرض «هزینه» است؛ خدمتی که تاکنون در ردیفی با مبنای «رسید انبار» استفاده شده «بهای موجودی» می‌شود
UPDATE "GoodsItem" SET "accountingTreatment" = 'EXPENSE' WHERE "kind" = 'SERVICE';
UPDATE "GoodsItem" g SET "accountingTreatment" = 'INVENTORY_COST'
WHERE g."kind" = 'SERVICE'
  AND EXISTS (SELECT 1 FROM "PurchaseCostLine" l WHERE l."serviceId" = g."id" AND l."basis" = 'WAREHOUSE_RECEIPT');

-- تا اینجا معین بدهکارِ خدمتِ «هزینه» از «کنترل خرید» گروه حسابداری‌اش (به تفکیک نوع خرید) خوانده می‌شد. برای اینکه رفتار فعلی حفظ شود،
-- اگر همه‌ی رکوردهای «کنترل خرید» گروه حسابداریِ یک خدمت به یک معین واحد اشاره کنند، همان معین به‌عنوان تنظیم «خرید خدمت» همان خدمت ثبت
-- می‌شود؛ خدماتی که گروهشان چند معین متفاوت (به تفکیک نوع خرید) دارد، دستی تعریف می‌شوند.
INSERT INTO "GoodsServiceAccountingSetting" ("accountingGroupId", "accountType", "accountId", "serviceId", "hasTransactions", "createdAt")
SELECT NULL, 'SERVICE_PURCHASE', m."accountId", g."id", false, CURRENT_TIMESTAMP
FROM "GoodsItem" g
JOIN (
  SELECT "accountingGroupId", MIN("accountId") AS "accountId"
  FROM "GoodsServiceAccountingSetting"
  WHERE "accountType" = 'PURCHASE_CONTROL'
  GROUP BY "accountingGroupId"
  HAVING COUNT(DISTINCT "accountId") = 1
) m ON m."accountingGroupId" = g."accountingGroupId"
WHERE g."kind" = 'SERVICE' AND g."accountingTreatment" = 'EXPENSE';
