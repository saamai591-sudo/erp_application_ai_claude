-- اعلامیه قیمت فروش (فاز اول): اعلامیه، دامنه‌ی مرکز×نوع، ردیف قیمت، پله‌ی مقدار + ستون‌های ممیزی قیمت روی ردیف پیش‌فاکتور
-- CreateEnum
CREATE TYPE "SalesPriceRuleEffect" AS ENUM ('ABSOLUTE', 'PERCENT');

-- CreateEnum
CREATE TYPE "SalesQuotePriceSource" AS ENUM ('MANUAL', 'LIST', 'RULE');

-- AlterTable
ALTER TABLE "SalesQuoteLine" ADD COLUMN     "basePrice" DECIMAL(36,10),
ADD COLUMN     "listPrice" DECIMAL(36,10),
ADD COLUMN     "priceListId" INTEGER,
ADD COLUMN     "priceRuleId" INTEGER,
ADD COLUMN     "priceSource" "SalesQuotePriceSource" NOT NULL DEFAULT 'MANUAL';

-- CreateTable
CREATE TABLE "SalesPriceList" (
    "id" SERIAL NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "currencyId" INTEGER NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesPriceList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesPriceListScope" (
    "id" SERIAL NOT NULL,
    "priceListId" INTEGER NOT NULL,
    "salesCenterId" INTEGER NOT NULL,
    "salesTypeId" INTEGER NOT NULL,
    "currencyId" INTEGER NOT NULL,
    "effectiveDate" DATE NOT NULL,

    CONSTRAINT "SalesPriceListScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesPriceListLine" (
    "id" SERIAL NOT NULL,
    "priceListId" INTEGER NOT NULL,
    "goodsItemId" INTEGER NOT NULL,
    "price" DECIMAL(36,10) NOT NULL,

    CONSTRAINT "SalesPriceListLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesPriceRule" (
    "id" SERIAL NOT NULL,
    "priceListId" INTEGER NOT NULL,
    "goodsItemId" INTEGER NOT NULL,
    "minQuantity" DECIMAL(36,10) NOT NULL,
    "effect" "SalesPriceRuleEffect" NOT NULL,
    "value" DECIMAL(36,10) NOT NULL,

    CONSTRAINT "SalesPriceRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesPriceList_number_key" ON "SalesPriceList"("number");

-- CreateIndex
CREATE INDEX "SalesPriceListScope_salesCenterId_salesTypeId_effectiveDate_idx" ON "SalesPriceListScope"("salesCenterId", "salesTypeId", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "SalesPriceListScope_priceListId_salesCenterId_salesTypeId_key" ON "SalesPriceListScope"("priceListId", "salesCenterId", "salesTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesPriceListScope_salesCenterId_salesTypeId_currencyId_ef_key" ON "SalesPriceListScope"("salesCenterId", "salesTypeId", "currencyId", "effectiveDate");

-- CreateIndex
CREATE INDEX "SalesPriceListLine_goodsItemId_idx" ON "SalesPriceListLine"("goodsItemId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesPriceListLine_priceListId_goodsItemId_key" ON "SalesPriceListLine"("priceListId", "goodsItemId");

-- CreateIndex
CREATE INDEX "SalesPriceRule_goodsItemId_idx" ON "SalesPriceRule"("goodsItemId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesPriceRule_priceListId_goodsItemId_minQuantity_key" ON "SalesPriceRule"("priceListId", "goodsItemId", "minQuantity");

-- AddForeignKey
ALTER TABLE "SalesQuoteLine" ADD CONSTRAINT "SalesQuoteLine_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "SalesPriceList"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesQuoteLine" ADD CONSTRAINT "SalesQuoteLine_priceRuleId_fkey" FOREIGN KEY ("priceRuleId") REFERENCES "SalesPriceRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPriceList" ADD CONSTRAINT "SalesPriceList_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPriceListScope" ADD CONSTRAINT "SalesPriceListScope_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "SalesPriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPriceListScope" ADD CONSTRAINT "SalesPriceListScope_salesCenterId_fkey" FOREIGN KEY ("salesCenterId") REFERENCES "SalesCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPriceListScope" ADD CONSTRAINT "SalesPriceListScope_salesTypeId_fkey" FOREIGN KEY ("salesTypeId") REFERENCES "SalesType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPriceListLine" ADD CONSTRAINT "SalesPriceListLine_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "SalesPriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPriceListLine" ADD CONSTRAINT "SalesPriceListLine_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPriceRule" ADD CONSTRAINT "SalesPriceRule_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "SalesPriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPriceRule" ADD CONSTRAINT "SalesPriceRule_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
