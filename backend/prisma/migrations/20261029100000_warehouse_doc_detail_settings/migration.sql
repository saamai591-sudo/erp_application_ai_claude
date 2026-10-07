-- CreateTable
CREATE TABLE "WarehouseDocDetailSetting" (
    "id" SERIAL NOT NULL,
    "documentType" "InventoryDocumentType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarehouseDocDetailSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseDocDetailSettingItem" (
    "id" SERIAL NOT NULL,
    "settingId" INTEGER NOT NULL,
    "detailTypeId" INTEGER NOT NULL,
    "showInItem" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "WarehouseDocDetailSettingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryDocumentDetail" (
    "id" SERIAL NOT NULL,
    "documentId" INTEGER NOT NULL,
    "lineId" INTEGER,
    "detailTypeId" INTEGER NOT NULL,
    "detailCode" TEXT NOT NULL,

    CONSTRAINT "InventoryDocumentDetail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseDocDetailSetting_documentType_key" ON "WarehouseDocDetailSetting"("documentType");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseDocDetailSettingItem_settingId_detailTypeId_key" ON "WarehouseDocDetailSettingItem"("settingId", "detailTypeId");

-- CreateIndex
CREATE INDEX "InventoryDocumentDetail_documentId_idx" ON "InventoryDocumentDetail"("documentId");

-- CreateIndex
CREATE INDEX "InventoryDocumentDetail_lineId_idx" ON "InventoryDocumentDetail"("lineId");

-- یکتایی (ایندکس جزئی؛ Prisma نمی‌تواند مدل کند): هر نوع تفصیل در هدر یک بار و در هر ردیف یک بار
CREATE UNIQUE INDEX "InventoryDocumentDetail_header_unique" ON "InventoryDocumentDetail"("documentId", "detailTypeId") WHERE "lineId" IS NULL;
CREATE UNIQUE INDEX "InventoryDocumentDetail_line_unique" ON "InventoryDocumentDetail"("lineId", "detailTypeId") WHERE "lineId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "WarehouseDocDetailSettingItem" ADD CONSTRAINT "WarehouseDocDetailSettingItem_settingId_fkey" FOREIGN KEY ("settingId") REFERENCES "WarehouseDocDetailSetting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseDocDetailSettingItem" ADD CONSTRAINT "WarehouseDocDetailSettingItem_detailTypeId_fkey" FOREIGN KEY ("detailTypeId") REFERENCES "DetailType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryDocumentDetail" ADD CONSTRAINT "InventoryDocumentDetail_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "InventoryDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryDocumentDetail" ADD CONSTRAINT "InventoryDocumentDetail_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "InventoryDocumentLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryDocumentDetail" ADD CONSTRAINT "InventoryDocumentDetail_detailTypeId_fkey" FOREIGN KEY ("detailTypeId") REFERENCES "DetailType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
