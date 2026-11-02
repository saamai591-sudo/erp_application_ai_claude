-- گروه چاپ، چاپگرهای ایستگاه، سفارش آشپزخانه (ارسال افزایشی) و کارهای چاپ عامل
ALTER TYPE "PrintDocumentType" ADD VALUE IF NOT EXISTS 'STORE_SALE_ORDER';
CREATE TYPE "PrintJobStatus" AS ENUM ('QUEUED', 'CLAIMED', 'PRINTED', 'FAILED');
CREATE TYPE "StorePrinterType" AS ENUM ('INVOICE', 'ORDER');

ALTER TABLE "CardTerminalAgent" ADD COLUMN "printers" JSONB, ADD COLUMN "printersAt" TIMESTAMP(3);
ALTER TABLE "SalesStation" ADD COLUMN "printAgentId" INTEGER;
ALTER TABLE "SalesStation" ADD CONSTRAINT "SalesStation_printAgentId_fkey" FOREIGN KEY ("printAgentId") REFERENCES "CardTerminalAgent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PrintGroup" (
  "id" SERIAL NOT NULL,
  "code" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrintGroup_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PrintGroup_code_key" ON "PrintGroup"("code");
CREATE UNIQUE INDEX "PrintGroup_title_key" ON "PrintGroup"("title");

CREATE TABLE "PrintGroupItem" (
  "id" SERIAL NOT NULL,
  "printGroupId" INTEGER NOT NULL,
  "goodsItemId" INTEGER NOT NULL,
  CONSTRAINT "PrintGroupItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PrintGroupItem_printGroupId_goodsItemId_key" ON "PrintGroupItem"("printGroupId", "goodsItemId");
ALTER TABLE "PrintGroupItem" ADD CONSTRAINT "PrintGroupItem_printGroupId_fkey" FOREIGN KEY ("printGroupId") REFERENCES "PrintGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrintGroupItem" ADD CONSTRAINT "PrintGroupItem_goodsItemId_fkey" FOREIGN KEY ("goodsItemId") REFERENCES "GoodsItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PrintGroupGoodsGroup" (
  "id" SERIAL NOT NULL,
  "printGroupId" INTEGER NOT NULL,
  "goodsGroupId" INTEGER NOT NULL,
  CONSTRAINT "PrintGroupGoodsGroup_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PrintGroupGoodsGroup_printGroupId_goodsGroupId_key" ON "PrintGroupGoodsGroup"("printGroupId", "goodsGroupId");
ALTER TABLE "PrintGroupGoodsGroup" ADD CONSTRAINT "PrintGroupGoodsGroup_printGroupId_fkey" FOREIGN KEY ("printGroupId") REFERENCES "PrintGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrintGroupGoodsGroup" ADD CONSTRAINT "PrintGroupGoodsGroup_goodsGroupId_fkey" FOREIGN KEY ("goodsGroupId") REFERENCES "GoodsGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SalesStationPrinter" (
  "id" SERIAL NOT NULL,
  "stationId" INTEGER NOT NULL,
  "rowOrder" INTEGER NOT NULL DEFAULT 0,
  "printerName" TEXT NOT NULL,
  "printType" "StorePrinterType" NOT NULL,
  "printGroupId" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "SalesStationPrinter_pkey" PRIMARY KEY ("id"),
  -- چاپگر نوع «فاکتور» همیشه همه‌ی کالاهاست؛ فقط «سفارش» گروه چاپ می‌گیرد
  CONSTRAINT "SalesStationPrinter_invoice_no_group" CHECK ("printType" <> 'INVOICE' OR "printGroupId" IS NULL)
);
CREATE INDEX "SalesStationPrinter_stationId_idx" ON "SalesStationPrinter"("stationId");
ALTER TABLE "SalesStationPrinter" ADD CONSTRAINT "SalesStationPrinter_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "SalesStation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesStationPrinter" ADD CONSTRAINT "SalesStationPrinter_printGroupId_fkey" FOREIGN KEY ("printGroupId") REFERENCES "PrintGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "StoreSaleOrderBatch" (
  "id" SERIAL NOT NULL,
  "saleId" INTEGER NOT NULL,
  "seq" INTEGER NOT NULL,
  "mode" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "createdById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoreSaleOrderBatch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StoreSaleOrderBatch_saleId_seq_key" ON "StoreSaleOrderBatch"("saleId", "seq");
ALTER TABLE "StoreSaleOrderBatch" ADD CONSTRAINT "StoreSaleOrderBatch_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "StoreSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StoreSaleOrderSent" (
  "saleId" INTEGER NOT NULL,
  "goodsItemId" INTEGER NOT NULL,
  "title" TEXT NOT NULL DEFAULT '',
  "unitTitle" TEXT NOT NULL DEFAULT '',
  "quantity" DECIMAL(36,10) NOT NULL,
  CONSTRAINT "StoreSaleOrderSent_pkey" PRIMARY KEY ("saleId", "goodsItemId")
);
ALTER TABLE "StoreSaleOrderSent" ADD CONSTRAINT "StoreSaleOrderSent_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "StoreSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PrintJob" (
  "id" SERIAL NOT NULL,
  "agentId" INTEGER NOT NULL,
  "printerName" TEXT NOT NULL,
  "kind" "StorePrinterType" NOT NULL,
  "saleId" INTEGER,
  "batchId" INTEGER,
  "title" TEXT NOT NULL,
  "html" TEXT NOT NULL,
  "status" "PrintJobStatus" NOT NULL DEFAULT 'QUEUED',
  "errorMessage" TEXT,
  "createdById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimedAt" TIMESTAMP(3),
  "doneAt" TIMESTAMP(3),
  CONSTRAINT "PrintJob_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PrintJob_agentId_status_idx" ON "PrintJob"("agentId", "status");
CREATE INDEX "PrintJob_saleId_idx" ON "PrintJob"("saleId");
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "CardTerminalAgent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "StoreSale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "StoreSaleOrderBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
