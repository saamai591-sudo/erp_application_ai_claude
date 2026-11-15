-- الگوی شماره‌گذاری بچ تولیدی: قالب با نشانه‌ها + شمارنده‌ی اختیاری؛ روی کالا تعیین می‌شود (فقط کالای بچ‌دار نیمه‌ساخته/محصول)
CREATE TYPE "BatchSeqScope" AS ENUM ('ALL', 'ITEM', 'FISCAL_YEAR', 'ITEM_FISCAL_YEAR');

CREATE TABLE "BatchNumberPattern" (
  "id" SERIAL NOT NULL,
  "code" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "template" TEXT NOT NULL,
  "seqScope" "BatchSeqScope" NOT NULL DEFAULT 'ALL',
  "seqWidth" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BatchNumberPattern_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BatchNumberPattern_code_key" ON "BatchNumberPattern"("code");
CREATE UNIQUE INDEX "BatchNumberPattern_title_key" ON "BatchNumberPattern"("title");

CREATE TABLE "BatchNumberCounter" (
  "id" SERIAL NOT NULL,
  "patternId" INTEGER NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "lastNumber" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "BatchNumberCounter_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BatchNumberCounter_patternId_scopeKey_key" ON "BatchNumberCounter"("patternId", "scopeKey");
ALTER TABLE "BatchNumberCounter" ADD CONSTRAINT "BatchNumberCounter_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "BatchNumberPattern"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GoodsItem" ADD COLUMN "batchPatternId" INTEGER;
ALTER TABLE "GoodsItem" ADD CONSTRAINT "GoodsItem_batchPatternId_fkey" FOREIGN KEY ("batchPatternId") REFERENCES "BatchNumberPattern"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
