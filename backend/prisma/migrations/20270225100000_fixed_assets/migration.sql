-- دارایی ثابت: رسید دارایی، گروه، پلاک، اجزا و موقعیت + نوع تفصیل «دارایی ثابت»

-- CreateEnum
CREATE TYPE "AssetReceiptBasis" AS ENUM ('NO_BASIS', 'WAREHOUSE_ISSUE', 'DELIVERY_AUTHORIZATION');

-- CreateEnum
CREATE TYPE "FixedAssetStatus" AS ENUM ('ACTIVE', 'DISPOSED');

-- CreateTable
CREATE TABLE "AssetGroup" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetReceipt" (
    "id" SERIAL NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "basis" "AssetReceiptBasis" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetReceiptLine" (
    "id" SERIAL NOT NULL,
    "assetReceiptId" INTEGER NOT NULL,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,
    "goodsItemId" INTEGER NOT NULL,
    "unitId" INTEGER NOT NULL,
    "quantity" DECIMAL(36,10) NOT NULL,
    "amount" DECIMAL(36,10),
    "description" TEXT,
    "sourceInventoryLineId" INTEGER,
    "sourceDeliveryAuthorizationLineId" INTEGER,

    CONSTRAINT "AssetReceiptLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedAsset" (
    "id" SERIAL NOT NULL,
    "detailCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "assetGroupId" INTEGER NOT NULL,
    "cost" DECIMAL(36,10) NOT NULL,
    "acquisitionDate" DATE NOT NULL,
    "inServiceDate" DATE NOT NULL,
    "status" "FixedAssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FixedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedAssetComponent" (
    "id" SERIAL NOT NULL,
    "assetId" INTEGER NOT NULL,
    "receiptLineId" INTEGER,
    "quantity" DECIMAL(36,10) NOT NULL,
    "amount" DECIMAL(36,10) NOT NULL,
    "description" TEXT,

    CONSTRAINT "FixedAssetComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetPosition" (
    "id" SERIAL NOT NULL,
    "assetId" INTEGER NOT NULL,
    "fromDate" DATE NOT NULL,
    "costCenterId" INTEGER NOT NULL,
    "projectId" INTEGER,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetPosition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssetGroup_code_key" ON "AssetGroup"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AssetGroup_title_key" ON "AssetGroup"("title");

-- CreateIndex
CREATE UNIQUE INDEX "AssetReceipt_fiscalPeriodId_number_key" ON "AssetReceipt"("fiscalPeriodId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "FixedAsset_detailCode_key" ON "FixedAsset"("detailCode");

-- CreateIndex
CREATE UNIQUE INDEX "AssetPosition_assetId_fromDate_key" ON "AssetPosition"("assetId", "fromDate");

-- AddForeignKey
ALTER TABLE "AssetReceipt" ADD CONSTRAINT "AssetReceipt_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetReceiptLine" ADD CONSTRAINT "AssetReceiptLine_assetReceiptId_fkey" FOREIGN KEY ("assetReceiptId") REFERENCES "AssetReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetReceiptLine" ADD CONSTRAINT "AssetReceiptLine_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetReceiptLine" ADD CONSTRAINT "AssetReceiptLine_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetReceiptLine" ADD CONSTRAINT "AssetReceiptLine_sourceInventoryLineId_fkey" FOREIGN KEY ("sourceInventoryLineId") REFERENCES "InventoryDocumentLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetReceiptLine" ADD CONSTRAINT "AssetReceiptLine_sourceDeliveryAuthorizationLineId_fkey" FOREIGN KEY ("sourceDeliveryAuthorizationLineId") REFERENCES "DeliveryAuthorizationLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_assetGroupId_fkey" FOREIGN KEY ("assetGroupId") REFERENCES "AssetGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAssetComponent" ADD CONSTRAINT "FixedAssetComponent_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FixedAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAssetComponent" ADD CONSTRAINT "FixedAssetComponent_receiptLineId_fkey" FOREIGN KEY ("receiptLineId") REFERENCES "AssetReceiptLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetPosition" ADD CONSTRAINT "AssetPosition_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FixedAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetPosition" ADD CONSTRAINT "AssetPosition_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetPosition" ADD CONSTRAINT "AssetPosition_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- نوع تفصیل «دارایی ثابت» (کد ۹؛ کدهای ۶ رقمی تا با کدهای ۵ رقمی سایر انواع برخورد نکند)
INSERT INTO "DetailType" ("code", "title", "codeLength", "startNumber", "endNumber")
VALUES (9, 'دارایی ثابت', 6, 100001, 999999)
ON CONFLICT ("code") DO NOTHING;
