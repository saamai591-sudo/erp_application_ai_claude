-- «بستن حسابداری موجودی» (عملیات پایان دوره): یک رکورد به‌ازای هر دوره مالی + لاگ ممیزی بستن/برگشت
CREATE TYPE "InventoryAccountingCloseAction" AS ENUM ('CLOSE', 'REVERSE');

CREATE TABLE "InventoryAccountingClose" (
    "id" SERIAL NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "nextFiscalPeriodId" INTEGER NOT NULL,
    "openingDate" DATE NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedById" INTEGER,
    "warehouseCount" INTEGER NOT NULL DEFAULT 0,
    "lineCount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(36,10) NOT NULL DEFAULT 0,

    CONSTRAINT "InventoryAccountingClose_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryAccountingCloseLog" (
    "id" SERIAL NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "action" "InventoryAccountingCloseAction" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,

    CONSTRAINT "InventoryAccountingCloseLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InventoryAccountingClose_fiscalPeriodId_key" ON "InventoryAccountingClose"("fiscalPeriodId");

ALTER TABLE "InventoryAccountingClose" ADD CONSTRAINT "InventoryAccountingClose_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryAccountingClose" ADD CONSTRAINT "InventoryAccountingClose_nextFiscalPeriodId_fkey" FOREIGN KEY ("nextFiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryAccountingClose" ADD CONSTRAINT "InventoryAccountingClose_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryAccountingCloseLog" ADD CONSTRAINT "InventoryAccountingCloseLog_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryAccountingCloseLog" ADD CONSTRAINT "InventoryAccountingCloseLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
