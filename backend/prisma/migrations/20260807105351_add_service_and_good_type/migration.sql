-- CreateEnum
CREATE TYPE "GoodsItemKind" AS ENUM ('GOODS', 'SERVICE');

-- CreateTable
CREATE TABLE "GoodsItem" (
    "id" SERIAL NOT NULL,
    "kind" "GoodsItemKind" NOT NULL,
    "goodsGroupId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "fullCode" TEXT NOT NULL,
    "rawTitle" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "mainUnitId" INTEGER NOT NULL,
    "weightUnitId" INTEGER,
    "weightRatio" DECIMAL(18,6),
    "technicalSpec" TEXT,
    "barcode" TEXT,
    "reorderControl" BOOLEAN NOT NULL DEFAULT false,
    "reorderPoint" DECIMAL(18,6),
    "hasSerialNumber" BOOLEAN NOT NULL DEFAULT false,
    "hasExpiryDate" BOOLEAN NOT NULL DEFAULT false,
    "isSerialTracked" BOOLEAN NOT NULL DEFAULT false,
    "isExpiryTracked" BOOLEAN NOT NULL DEFAULT false,
    "isBatchTracked" BOOLEAN NOT NULL DEFAULT false,
    "isLocationTracked" BOOLEAN NOT NULL DEFAULT false,
    "accountingGroupId" INTEGER NOT NULL,
    "isSpecial" BOOLEAN NOT NULL DEFAULT false,
    "taxRate" DECIMAL(9,4),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hasTransactions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoodsItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsItemAttributeValue" (
    "id" SERIAL NOT NULL,
    "goodsItemId" INTEGER NOT NULL,
    "attributeId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,

    CONSTRAINT "GoodsItemAttributeValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoodsItem_fullCode_key" ON "GoodsItem"("fullCode");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsItem_goodsGroupId_code_key" ON "GoodsItem"("goodsGroupId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsItemAttributeValue_goodsItemId_attributeId_key" ON "GoodsItemAttributeValue"("goodsItemId", "attributeId");

-- AddForeignKey
ALTER TABLE "GoodsItem" ADD CONSTRAINT "GoodsItem_goodsGroupId_fkey" FOREIGN KEY ("goodsGroupId") REFERENCES "GoodsGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsItem" ADD CONSTRAINT "GoodsItem_mainUnitId_fkey" FOREIGN KEY ("mainUnitId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsItem" ADD CONSTRAINT "GoodsItem_weightUnitId_fkey" FOREIGN KEY ("weightUnitId") REFERENCES "UnitOfMeasure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsItem" ADD CONSTRAINT "GoodsItem_accountingGroupId_fkey" FOREIGN KEY ("accountingGroupId") REFERENCES "AccountingGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsItemAttributeValue" ADD CONSTRAINT "GoodsItemAttributeValue_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsItemAttributeValue" ADD CONSTRAINT "GoodsItemAttributeValue_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "GoodsAttribute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsItemAttributeValue" ADD CONSTRAINT "GoodsItemAttributeValue_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "GoodsAttributeItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
