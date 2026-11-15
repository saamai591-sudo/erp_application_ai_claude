-- تفصیل «سفارش خرید» (نوع تفصیل ۱۰): هر سفارش خرید یک کد تفصیل دارد که سیستم می‌دهد؛ عنوان از خود سفارش ساخته می‌شود (ذخیره‌ی جدا ندارد).
ALTER TABLE "PurchaseOrder" ADD COLUMN "detailCode" TEXT;
CREATE UNIQUE INDEX "PurchaseOrder_detailCode_key" ON "PurchaseOrder"("detailCode");

INSERT INTO "DetailType" ("code", "title", "codeLength", "startNumber", "endNumber", "manualEntry")
VALUES (10, 'سفارش خرید', 6, 200000, 299999, false)
ON CONFLICT DO NOTHING;

-- مهاجرت داده: برای سفارش‌های خرید موجود کد تفصیل ساخته می‌شود (به ترتیب شناسه، پس از بزرگ‌ترین کد ۶رقمیِ بازه‌ی این نوع که قبلاً در سیستم ثبت شده)
WITH base AS (
  SELECT GREATEST(199999, COALESCE((SELECT MAX(code::int) FROM "DetailCodeUsage" WHERE code ~ '^[0-9]{6}$' AND code::int BETWEEN 200000 AND 299999), 199999)) AS n
),
numbered AS (
  SELECT po."id", (SELECT n FROM base) + ROW_NUMBER() OVER (ORDER BY po."id") AS n
  FROM "PurchaseOrder" po
  WHERE po."detailCode" IS NULL
)
UPDATE "PurchaseOrder" po SET "detailCode" = numbered.n::text FROM numbered WHERE numbered."id" = po."id";

INSERT INTO "DetailCodeUsage" ("code", "detailTypeId", "entityTable", "entityId")
SELECT po."detailCode", (SELECT "id" FROM "DetailType" WHERE "code" = 10), 'PurchaseOrder', po."id"
FROM "PurchaseOrder" po
WHERE po."detailCode" IS NOT NULL AND EXISTS (SELECT 1 FROM "DetailType" WHERE "code" = 10)
ON CONFLICT DO NOTHING;
