-- CreateEnum
CREATE TYPE "PurchaseRouteNature" AS ENUM ('TENDER', 'INQUIRY', 'NO_FORMALITY', 'EXCLUSIVE');

-- CreateTable
CREATE TABLE "PurchaseRoute" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "nature" "PurchaseRouteNature" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hasTransactions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseGroup" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hasTransactions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "partyId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hasTransactions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseGroupSupplier" (
    "id" SERIAL NOT NULL,
    "purchaseGroupId" INTEGER NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PurchaseGroupSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseGroupGoodsItem" (
    "id" SERIAL NOT NULL,
    "purchaseGroupId" INTEGER NOT NULL,
    "goodsItemId" INTEGER NOT NULL,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PurchaseGroupGoodsItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseExpert" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hasTransactions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseExpert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseExpertGroup" (
    "id" SERIAL NOT NULL,
    "purchaseExpertId" INTEGER NOT NULL,
    "purchaseGroupId" INTEGER NOT NULL,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PurchaseExpertGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRoute_code_key" ON "PurchaseRoute"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRoute_title_key" ON "PurchaseRoute"("title");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseGroup_code_key" ON "PurchaseGroup"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseGroup_title_key" ON "PurchaseGroup"("title");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_partyId_key" ON "Supplier"("partyId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseGroupSupplier_purchaseGroupId_supplierId_key" ON "PurchaseGroupSupplier"("purchaseGroupId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseGroupGoodsItem_purchaseGroupId_goodsItemId_key" ON "PurchaseGroupGoodsItem"("purchaseGroupId", "goodsItemId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseExpert_code_key" ON "PurchaseExpert"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseExpert_userId_key" ON "PurchaseExpert"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseExpertGroup_purchaseExpertId_purchaseGroupId_key" ON "PurchaseExpertGroup"("purchaseExpertId", "purchaseGroupId");

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseGroupSupplier" ADD CONSTRAINT "PurchaseGroupSupplier_purchaseGroupId_fkey" FOREIGN KEY ("purchaseGroupId") REFERENCES "PurchaseGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseGroupSupplier" ADD CONSTRAINT "PurchaseGroupSupplier_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseGroupGoodsItem" ADD CONSTRAINT "PurchaseGroupGoodsItem_purchaseGroupId_fkey" FOREIGN KEY ("purchaseGroupId") REFERENCES "PurchaseGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseGroupGoodsItem" ADD CONSTRAINT "PurchaseGroupGoodsItem_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseExpert" ADD CONSTRAINT "PurchaseExpert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseExpertGroup" ADD CONSTRAINT "PurchaseExpertGroup_purchaseExpertId_fkey" FOREIGN KEY ("purchaseExpertId") REFERENCES "PurchaseExpert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseExpertGroup" ADD CONSTRAINT "PurchaseExpertGroup_purchaseGroupId_fkey" FOREIGN KEY ("purchaseGroupId") REFERENCES "PurchaseGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
