-- ویترین کالا (فروش فروشگاهی): سایدبار کاشی‌های فروش سریع در فرم فروش / برگشت فروش بدون مبنا؛ تخصیص چند‌به‌چند به ایستگاه‌ها

CREATE TABLE "StoreShowcase" (
  "id" SERIAL PRIMARY KEY,
  "code" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "StoreShowcase_code_key" ON "StoreShowcase"("code");
CREATE UNIQUE INDEX "StoreShowcase_title_key" ON "StoreShowcase"("title");

CREATE TABLE "StoreShowcaseItem" (
  "id" SERIAL PRIMARY KEY,
  "showcaseId" INTEGER NOT NULL,
  "goodsItemId" INTEGER NOT NULL,
  "displayTitle" TEXT NOT NULL,
  "rowOrder" INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX "StoreShowcaseItem_showcaseId_goodsItemId_key" ON "StoreShowcaseItem"("showcaseId", "goodsItemId");
CREATE INDEX "StoreShowcaseItem_goodsItemId_idx" ON "StoreShowcaseItem"("goodsItemId");
ALTER TABLE "StoreShowcaseItem" ADD CONSTRAINT "StoreShowcaseItem_showcaseId_fkey" FOREIGN KEY ("showcaseId") REFERENCES "StoreShowcase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreShowcaseItem" ADD CONSTRAINT "StoreShowcaseItem_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SalesStationShowcase" (
  "id" SERIAL PRIMARY KEY,
  "stationId" INTEGER NOT NULL,
  "showcaseId" INTEGER NOT NULL,
  "rowOrder" INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX "SalesStationShowcase_stationId_showcaseId_key" ON "SalesStationShowcase"("stationId", "showcaseId");
CREATE INDEX "SalesStationShowcase_showcaseId_idx" ON "SalesStationShowcase"("showcaseId");
ALTER TABLE "SalesStationShowcase" ADD CONSTRAINT "SalesStationShowcase_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "SalesStation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesStationShowcase" ADD CONSTRAINT "SalesStationShowcase_showcaseId_fkey" FOREIGN KEY ("showcaseId") REFERENCES "StoreShowcase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
