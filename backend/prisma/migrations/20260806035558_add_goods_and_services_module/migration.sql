-- CreateEnum
CREATE TYPE "GoodsType" AS ENUM ('GOODS', 'SERVICE');

-- CreateEnum
CREATE TYPE "GoodsAttributeTitleEffect" AS ENUM ('NONE', 'VALUE', 'VALUE_AND_TITLE');

-- CreateEnum
CREATE TYPE "GoodsAccountType" AS ENUM ('SALES_VAT', 'SALES_RECEIVABLE', 'SALES_RETURN', 'SALES_DISCOUNT', 'SALES_REVENUE', 'INVENTORY', 'WAREHOUSE_RECEIPT_CREDIT', 'WAREHOUSE_ISSUE_DEBIT', 'PURCHASE_PAYABLE', 'PURCHASE_CONTROL', 'PURCHASE_VAT');

-- CreateEnum
CREATE TYPE "GoodsRequestNature" AS ENUM ('CENTER_REQUEST', 'PROJECT_REQUEST', 'FIXED_ASSET_REQUEST');

-- AlterTable
ALTER TABLE "Party" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "UnitOfMeasure" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "isWeight" BOOLEAN NOT NULL DEFAULT false,
    "kgEquivalent" DECIMAL(18,6),
    "hasTransactions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnitOfMeasure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseGroup" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hasTransactions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarehouseGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "warehouseGroupId" INTEGER NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "managerId" INTEGER,
    "stockControl" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hasTransactions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsGroupLevel" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "codeLength" INTEGER NOT NULL,
    "affectsGoodsCode" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoodsGroupLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsGroup" (
    "id" SERIAL NOT NULL,
    "parentId" INTEGER,
    "levelId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isLastBranch" BOOLEAN NOT NULL DEFAULT false,
    "affectsGoodsTitle" BOOLEAN NOT NULL DEFAULT false,
    "childCodeLength" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hasTransactions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoodsGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsGroupAttribute" (
    "id" SERIAL NOT NULL,
    "goodsGroupId" INTEGER NOT NULL,
    "attributeId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "affectsCode" BOOLEAN NOT NULL DEFAULT true,
    "titleEffect" "GoodsAttributeTitleEffect" NOT NULL DEFAULT 'NONE',

    CONSTRAINT "GoodsGroupAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsAttribute" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "itemCodeLength" INTEGER NOT NULL,
    "hasTransactions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoodsAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsAttributeItem" (
    "id" SERIAL NOT NULL,
    "attributeId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "GoodsAttributeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingGroup" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "goodsType" "GoodsType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hasTransactions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsServiceAccountingSetting" (
    "id" SERIAL NOT NULL,
    "accountingGroupId" INTEGER NOT NULL,
    "accountType" "GoodsAccountType" NOT NULL,
    "warehouseGroupId" INTEGER,
    "accountId" INTEGER NOT NULL,
    "salesTypeRef" INTEGER,
    "warehouseDocTypeRef" INTEGER,
    "purchaseTypeRef" INTEGER,
    "hasTransactions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoodsServiceAccountingSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsRequestType" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "nature" "GoodsRequestNature" NOT NULL DEFAULT 'CENTER_REQUEST',
    "hasTransactions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoodsRequestType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UnitOfMeasure_code_key" ON "UnitOfMeasure"("code");

-- CreateIndex
CREATE UNIQUE INDEX "UnitOfMeasure_title_key" ON "UnitOfMeasure"("title");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseGroup_code_key" ON "WarehouseGroup"("code");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseGroup_title_key" ON "WarehouseGroup"("title");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_title_key" ON "Warehouse"("title");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsGroupLevel_code_key" ON "GoodsGroupLevel"("code");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsGroupLevel_title_key" ON "GoodsGroupLevel"("title");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsGroupLevel_order_key" ON "GoodsGroupLevel"("order");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsGroup_parentId_code_key" ON "GoodsGroup"("parentId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsGroupAttribute_goodsGroupId_attributeId_key" ON "GoodsGroupAttribute"("goodsGroupId", "attributeId");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsAttribute_code_key" ON "GoodsAttribute"("code");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsAttribute_title_key" ON "GoodsAttribute"("title");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsAttributeItem_attributeId_code_key" ON "GoodsAttributeItem"("attributeId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingGroup_code_key" ON "AccountingGroup"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingGroup_title_key" ON "AccountingGroup"("title");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsRequestType_code_key" ON "GoodsRequestType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsRequestType_title_key" ON "GoodsRequestType"("title");

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_warehouseGroupId_fkey" FOREIGN KEY ("warehouseGroupId") REFERENCES "WarehouseGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsGroup" ADD CONSTRAINT "GoodsGroup_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "GoodsGroupLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsGroup" ADD CONSTRAINT "GoodsGroup_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "GoodsGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsGroupAttribute" ADD CONSTRAINT "GoodsGroupAttribute_goodsGroupId_fkey" FOREIGN KEY ("goodsGroupId") REFERENCES "GoodsGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsGroupAttribute" ADD CONSTRAINT "GoodsGroupAttribute_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "GoodsAttribute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsAttributeItem" ADD CONSTRAINT "GoodsAttributeItem_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "GoodsAttribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsServiceAccountingSetting" ADD CONSTRAINT "GoodsServiceAccountingSetting_accountingGroupId_fkey" FOREIGN KEY ("accountingGroupId") REFERENCES "AccountingGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsServiceAccountingSetting" ADD CONSTRAINT "GoodsServiceAccountingSetting_warehouseGroupId_fkey" FOREIGN KEY ("warehouseGroupId") REFERENCES "WarehouseGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsServiceAccountingSetting" ADD CONSTRAINT "GoodsServiceAccountingSetting_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
