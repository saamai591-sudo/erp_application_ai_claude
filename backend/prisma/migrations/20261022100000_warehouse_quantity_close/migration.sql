-- «بستن تعدادی موجودی انبار» (عملیات پایان دوره): یک رکورد به‌ازای هر انبار و هر دوره مالی (ممیزی: زمان و کاربر).
CREATE TABLE "WarehouseQuantityClose" (
    "id" SERIAL NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedById" INTEGER,
    "openingDocumentId" INTEGER,
    "lineCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WarehouseQuantityClose_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WarehouseQuantityClose_openingDocumentId_key" ON "WarehouseQuantityClose"("openingDocumentId");

CREATE UNIQUE INDEX "WarehouseQuantityClose_warehouseId_fiscalPeriodId_key" ON "WarehouseQuantityClose"("warehouseId", "fiscalPeriodId");

ALTER TABLE "WarehouseQuantityClose" ADD CONSTRAINT "WarehouseQuantityClose_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WarehouseQuantityClose" ADD CONSTRAINT "WarehouseQuantityClose_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WarehouseQuantityClose" ADD CONSTRAINT "WarehouseQuantityClose_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WarehouseQuantityClose" ADD CONSTRAINT "WarehouseQuantityClose_openingDocumentId_fkey" FOREIGN KEY ("openingDocumentId") REFERENCES "InventoryDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
