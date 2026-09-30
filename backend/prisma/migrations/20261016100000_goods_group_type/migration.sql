-- «نوع گروه» (کالا/خدمت) روی گروه‌های ریشه‌ی گروه کالا/خدمت
CREATE TYPE "GoodsGroupType" AS ENUM ('PRODUCT', 'SERVICE');
ALTER TABLE "GoodsGroup" ADD COLUMN "groupType" "GoodsGroupType";

-- داده‌ی موجود: هر ریشه «کالا» می‌شود، مگر آن‌که زیردرختش فقط خدمت داشته باشد (فقط این ستون نوشته می‌شود؛ هیچ کالا/خدمتی تغییر نمی‌کند).
-- ریشه‌ای که هر دو نوع را دارد «کالا» می‌ماند و در فرم گروه قابل اصلاح است.
WITH RECURSIVE tree AS (
  SELECT g."id", g."id" AS "rootId" FROM "GoodsGroup" g WHERE g."parentId" IS NULL
  UNION ALL
  SELECT c."id", t."rootId" FROM "GoodsGroup" c JOIN tree t ON c."parentId" = t."id"
),
kinds AS (
  SELECT t."rootId",
         bool_or(i."kind" = 'SERVICE') AS "hasService",
         bool_or(i."kind" = 'GOODS') AS "hasGoods"
  FROM tree t JOIN "GoodsItem" i ON i."goodsGroupId" = t."id"
  GROUP BY t."rootId"
)
UPDATE "GoodsGroup" g
SET "groupType" = CASE WHEN k."hasService" AND NOT k."hasGoods" THEN 'SERVICE'::"GoodsGroupType" ELSE 'PRODUCT'::"GoodsGroupType" END
FROM (SELECT g2."id", k."hasService", k."hasGoods" FROM "GoodsGroup" g2 LEFT JOIN kinds k ON k."rootId" = g2."id" WHERE g2."parentId" IS NULL) k
WHERE g."id" = k."id";
