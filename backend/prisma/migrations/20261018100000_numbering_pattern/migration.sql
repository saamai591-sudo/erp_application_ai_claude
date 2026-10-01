-- «الگوی شماره‌گذاری» (تنظیمات): مالک دنباله‌ی شماره‌ی مشترک اسناد فاکتور فروش / برگشت از فروش
CREATE TYPE "NumberingForm" AS ENUM ('SALES_INVOICE', 'SALES_RETURN');

CREATE TABLE "NumberingPattern" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "hasTaxMemory" BOOLEAN NOT NULL DEFAULT false,
    "taxMemoryId" INTEGER,
    "resetPerFiscalYear" BOOLEAN NOT NULL DEFAULT false,
    "restrictEarlierDates" BOOLEAN NOT NULL DEFAULT false,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "seedFiscalPeriodId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NumberingPattern_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NumberingPattern_title_key" ON "NumberingPattern"("title");
ALTER TABLE "NumberingPattern" ADD CONSTRAINT "NumberingPattern_taxMemoryId_fkey" FOREIGN KEY ("taxMemoryId") REFERENCES "TaxMemory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "NumberingPatternItem" (
    "id" SERIAL NOT NULL,
    "patternId" INTEGER NOT NULL,
    "form" "NumberingForm" NOT NULL,
    "salesTypeId" INTEGER NOT NULL,
    "salesCenterId" INTEGER NOT NULL,
    CONSTRAINT "NumberingPatternItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NumberingPatternItem_form_salesTypeId_salesCenterId_key" ON "NumberingPatternItem"("form", "salesTypeId", "salesCenterId");
ALTER TABLE "NumberingPatternItem" ADD CONSTRAINT "NumberingPatternItem_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "NumberingPattern"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NumberingPatternItem" ADD CONSTRAINT "NumberingPatternItem_salesTypeId_fkey" FOREIGN KEY ("salesTypeId") REFERENCES "SalesType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NumberingPatternItem" ADD CONSTRAINT "NumberingPatternItem_salesCenterId_fkey" FOREIGN KEY ("salesCenterId") REFERENCES "SalesCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "NumberingPatternCounter" (
    "id" SERIAL NOT NULL,
    "patternId" INTEGER NOT NULL,
    "scopeKey" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL,
    CONSTRAINT "NumberingPatternCounter_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "NumberingPatternCounter_patternId_scopeKey_key" ON "NumberingPatternCounter"("patternId", "scopeKey");
ALTER TABLE "NumberingPatternCounter" ADD CONSTRAINT "NumberingPatternCounter_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "NumberingPattern"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- اسناد: شماره‌ی الگودار در محدوده‌ی (الگو، دوره مالی) یکتاست؛ اسناد بدون الگو مثل قبل در هر دوره مالی یکتا می‌مانند (ایندکس یکتای جزئی).
-- داده‌ی موجود دست‌نخورده است (numberingPatternId همه NULL می‌ماند و قید قبلی عیناً با ایندکس جزئی حفظ می‌شود).
ALTER TABLE "SalesInvoice" ADD COLUMN "numberingPatternId" INTEGER;
ALTER TABLE "SalesReturnInvoice" ADD COLUMN "numberingPatternId" INTEGER;
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_numberingPatternId_fkey" FOREIGN KEY ("numberingPatternId") REFERENCES "NumberingPattern"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesReturnInvoice" ADD CONSTRAINT "SalesReturnInvoice_numberingPatternId_fkey" FOREIGN KEY ("numberingPatternId") REFERENCES "NumberingPattern"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX "SalesInvoice_fiscalPeriodId_number_key";
DROP INDEX "SalesReturnInvoice_fiscalPeriodId_number_key";
CREATE INDEX "SalesInvoice_fiscalPeriodId_number_idx" ON "SalesInvoice"("fiscalPeriodId", "number");
CREATE INDEX "SalesReturnInvoice_fiscalPeriodId_number_idx" ON "SalesReturnInvoice"("fiscalPeriodId", "number");
CREATE UNIQUE INDEX "SalesInvoice_pattern_period_number_key" ON "SalesInvoice"("numberingPatternId", "fiscalPeriodId", "number");
CREATE UNIQUE INDEX "SalesReturnInvoice_pattern_period_number_key" ON "SalesReturnInvoice"("numberingPatternId", "fiscalPeriodId", "number");
CREATE UNIQUE INDEX "SalesInvoice_legacy_number_key" ON "SalesInvoice"("fiscalPeriodId", "number") WHERE "numberingPatternId" IS NULL;
CREATE UNIQUE INDEX "SalesReturnInvoice_legacy_number_key" ON "SalesReturnInvoice"("fiscalPeriodId", "number") WHERE "numberingPatternId" IS NULL;
