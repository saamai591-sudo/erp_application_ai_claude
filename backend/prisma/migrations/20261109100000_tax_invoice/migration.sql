-- شمارنده‌ی سریال صورتحساب‌های هر حافظه مالیاتی (صعودی و غیرتکراری؛ هنگام ارسال با UPDATE اتمی گرفته می‌شود)
ALTER TABLE "TaxMemory" ADD COLUMN "lastSerial" BIGINT NOT NULL DEFAULT 0;

CREATE TYPE "TaxInvoiceStatus" AS ENUM ('IN_PROGRESS', 'SUCCESS', 'FAILED', 'TIMEOUT');

-- صورتحساب الکترونیکی ارسال‌شده به سامانه مودیان (عکس ثابت JSON ارسالی + نتیجه‌ی استعلام)
CREATE TABLE "TaxInvoice" (
  "id" SERIAL NOT NULL,
  "taxMemoryId" INTEGER NOT NULL,
  "salesInvoiceId" INTEGER NOT NULL,
  "subject" INTEGER NOT NULL DEFAULT 1,
  "invoiceType" INTEGER NOT NULL,
  "settlementMethod" INTEGER NOT NULL,
  "isArticle9" BOOLEAN NOT NULL DEFAULT false,
  "taxId" TEXT NOT NULL,
  "serial" BIGINT NOT NULL,
  "issuedAt" BIGINT NOT NULL,
  "referenceTaxId" TEXT,
  "payload" JSONB NOT NULL,
  "requestTraceId" TEXT NOT NULL,
  "status" "TaxInvoiceStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "referenceNumber" TEXT,
  "errors" JSONB,
  "warnings" JSONB,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "checkedAt" TIMESTAMP(3),
  CONSTRAINT "TaxInvoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaxInvoice_taxId_key" ON "TaxInvoice"("taxId");
CREATE UNIQUE INDEX "TaxInvoice_requestTraceId_key" ON "TaxInvoice"("requestTraceId");
CREATE UNIQUE INDEX "TaxInvoice_taxMemoryId_serial_key" ON "TaxInvoice"("taxMemoryId", "serial");
CREATE INDEX "TaxInvoice_salesInvoiceId_idx" ON "TaxInvoice"("salesInvoiceId");

ALTER TABLE "TaxInvoice" ADD CONSTRAINT "TaxInvoice_taxMemoryId_fkey" FOREIGN KEY ("taxMemoryId") REFERENCES "TaxMemory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TaxInvoice" ADD CONSTRAINT "TaxInvoice_salesInvoiceId_fkey" FOREIGN KEY ("salesInvoiceId") REFERENCES "SalesInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
