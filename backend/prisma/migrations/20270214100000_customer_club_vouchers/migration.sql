-- باشگاه مشتریان › بن‌کارت (بنِ صادرشده توسط خودمان): نوع بن، دسته‌ی صدور، بن (سریال)، فروش بن به سازمان + روش دریافت «بن» در فروش فروشگاهی

ALTER TYPE "TreasuryAccountType" ADD VALUE IF NOT EXISTS 'VOUCHER_LIABILITY';
ALTER TYPE "TreasuryAccountType" ADD VALUE IF NOT EXISTS 'VOUCHER_RECEIVABLE';

CREATE TYPE "VoucherStatus" AS ENUM ('CREATED', 'SOLD', 'USED', 'VOID');

CREATE TABLE "VoucherType" (
  "id" SERIAL PRIMARY KEY,
  "code" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "faceValue" DECIMAL(36,10) NOT NULL,
  "validityDays" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "VoucherType_code_key" ON "VoucherType"("code");
CREATE UNIQUE INDEX "VoucherType_title_key" ON "VoucherType"("title");

CREATE TABLE "VoucherBatch" (
  "id" SERIAL PRIMARY KEY,
  "number" INTEGER NOT NULL,
  "typeId" INTEGER NOT NULL,
  "date" DATE NOT NULL,
  "count" INTEGER NOT NULL,
  "validUntil" DATE,
  "description" TEXT,
  "createdById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "VoucherBatch_number_key" ON "VoucherBatch"("number");
ALTER TABLE "VoucherBatch" ADD CONSTRAINT "VoucherBatch_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "VoucherType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "VoucherSale" (
  "id" SERIAL PRIMARY KEY,
  "fiscalPeriodId" INTEGER NOT NULL,
  "number" INTEGER NOT NULL,
  "date" DATE NOT NULL,
  "customerId" INTEGER NOT NULL,
  "description" TEXT,
  "journalEntryId" INTEGER,
  "createdById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "VoucherSale_fiscalPeriodId_number_key" ON "VoucherSale"("fiscalPeriodId", "number");
CREATE INDEX "VoucherSale_customerId_idx" ON "VoucherSale"("customerId");
ALTER TABLE "VoucherSale" ADD CONSTRAINT "VoucherSale_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VoucherSale" ADD CONSTRAINT "VoucherSale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VoucherSale" ADD CONSTRAINT "VoucherSale_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Voucher" (
  "id" SERIAL PRIMARY KEY,
  "serial" TEXT NOT NULL,
  "typeId" INTEGER NOT NULL,
  "batchId" INTEGER NOT NULL,
  "faceValue" DECIMAL(36,10) NOT NULL,
  "validUntil" DATE,
  "status" "VoucherStatus" NOT NULL DEFAULT 'CREATED',
  "saleId" INTEGER,
  "voidReason" TEXT,
  "voidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "Voucher_serial_key" ON "Voucher"("serial");
CREATE INDEX "Voucher_typeId_status_idx" ON "Voucher"("typeId", "status");
CREATE INDEX "Voucher_batchId_idx" ON "Voucher"("batchId");
CREATE INDEX "Voucher_saleId_idx" ON "Voucher"("saleId");
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "VoucherType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "VoucherBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "VoucherSale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- فروخته/مصرف‌شده ⇔ فروش دارد (بنِ باطل‌شده می‌تواند هر دو حالت باشد)
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_sale_status_check" CHECK (("status" IN ('SOLD', 'USED')) = ("saleId" IS NOT NULL) OR "status" = 'VOID');

-- روش دریافت «بن» در فروش فروشگاهی؛ قید یکتا = هر بن حداکثر یک‌بار مصرف می‌شود
ALTER TABLE "StoreReceipt" ADD COLUMN "voucherId" INTEGER;
CREATE UNIQUE INDEX "StoreReceipt_voucherId_key" ON "StoreReceipt"("voucherId");
ALTER TABLE "StoreReceipt" ADD CONSTRAINT "StoreReceipt_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreReceipt" DROP CONSTRAINT "StoreReceipt_method_check";
ALTER TABLE "StoreReceipt" ADD CONSTRAINT "StoreReceipt_method_check" CHECK (("cashBoxId" IS NOT NULL)::int + ("cardReaderId" IS NOT NULL)::int + ("bankAccountId" IS NOT NULL)::int + ("voucherId" IS NOT NULL)::int = 1);
