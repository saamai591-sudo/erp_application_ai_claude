-- «تفسیر بارکد» (کالا و خدمت › تنظیمات): هدر (کد، عنوان، طول بارکد، فعال) + آیتم‌ها (نوع، از، تا)
CREATE TYPE "BarcodeSegmentKind" AS ENUM ('ITEM_CODE', 'QUANTITY_INTEGER', 'QUANTITY_DECIMAL', 'BARCODE', 'AMOUNT', 'FIXED', 'SERIAL', 'BATCH');

CREATE TABLE "BarcodeInterpretation" (
  "id" SERIAL PRIMARY KEY,
  "code" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "length" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BarcodeInterpretation_length_check" CHECK ("length" >= 1 AND "length" <= 100)
);
CREATE UNIQUE INDEX "BarcodeInterpretation_code_key" ON "BarcodeInterpretation"("code");
CREATE UNIQUE INDEX "BarcodeInterpretation_title_key" ON "BarcodeInterpretation"("title");
-- دو تفسیر فعال با یک طول مجاز نیست (Prisma نمی‌تواند index جزئی را مدل کند)
CREATE UNIQUE INDEX "BarcodeInterpretation_active_length_key" ON "BarcodeInterpretation"("length") WHERE "isActive";

CREATE TABLE "BarcodeInterpretationItem" (
  "id" SERIAL PRIMARY KEY,
  "interpretationId" INTEGER NOT NULL,
  "rowOrder" INTEGER NOT NULL DEFAULT 0,
  "kind" "BarcodeSegmentKind" NOT NULL,
  "fromPos" INTEGER NOT NULL,
  "toPos" INTEGER NOT NULL,
  CONSTRAINT "BarcodeInterpretationItem_range_check" CHECK ("fromPos" >= 1 AND "toPos" >= "fromPos"),
  CONSTRAINT "BarcodeInterpretationItem_interpretationId_fkey" FOREIGN KEY ("interpretationId") REFERENCES "BarcodeInterpretation"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "BarcodeInterpretationItem_interpretationId_idx" ON "BarcodeInterpretationItem"("interpretationId");
