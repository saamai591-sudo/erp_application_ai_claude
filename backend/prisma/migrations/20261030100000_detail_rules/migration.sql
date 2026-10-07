-- CreateEnum
CREATE TYPE "DetailRuleSource" AS ENUM ('FIXED', 'FROM_DOCUMENT');

-- CreateTable
CREATE TABLE "DetailRuleHeader" (
    "id" SERIAL NOT NULL,
    "settingId" INTEGER NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "byWarehouse" BOOLEAN NOT NULL DEFAULT false,
    "byGoodsGroup" BOOLEAN NOT NULL DEFAULT false,
    "byParty" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DetailRuleHeader_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetailRuleRow" (
    "id" SERIAL NOT NULL,
    "headerId" INTEGER NOT NULL,
    "warehouseId" INTEGER,
    "goodsGroupId" INTEGER,
    "partyDetailCode" TEXT,
    "slot1Source" "DetailRuleSource",
    "slot1Code" TEXT,
    "slot2Source" "DetailRuleSource",
    "slot2Code" TEXT,
    "slot3Source" "DetailRuleSource",
    "slot3Code" TEXT,

    CONSTRAINT "DetailRuleRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DetailRuleHeader_settingId_effectiveDate_key" ON "DetailRuleHeader"("settingId", "effectiveDate");

-- CreateIndex
CREATE INDEX "DetailRuleRow_headerId_idx" ON "DetailRuleRow"("headerId");

-- یکتایی ترکیب شرط‌ها در هر هدر (خالی هم یک مقدار حساب می‌شود ⇒ فقط یک ردیف «بقیه»)؛ Prisma نمی‌تواند مدل کند
CREATE UNIQUE INDEX "DetailRuleRow_header_conditions_unique" ON "DetailRuleRow"("headerId", "warehouseId", "goodsGroupId", "partyDetailCode") NULLS NOT DISTINCT;

-- AddForeignKey
ALTER TABLE "DetailRuleHeader" ADD CONSTRAINT "DetailRuleHeader_settingId_fkey" FOREIGN KEY ("settingId") REFERENCES "GoodsServiceAccountingSetting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetailRuleRow" ADD CONSTRAINT "DetailRuleRow_headerId_fkey" FOREIGN KEY ("headerId") REFERENCES "DetailRuleHeader"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetailRuleRow" ADD CONSTRAINT "DetailRuleRow_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetailRuleRow" ADD CONSTRAINT "DetailRuleRow_goodsGroupId_fkey" FOREIGN KEY ("goodsGroupId") REFERENCES "GoodsGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
