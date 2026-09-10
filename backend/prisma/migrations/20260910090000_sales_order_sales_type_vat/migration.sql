-- AlterTable: SalesOrder — salesTypeId (الزامی، هم‌الگوی SalesQuote/SalesInvoice). جدول خالی است، پس
-- بدون backfill مستقیم NOT NULL می‌شود.
ALTER TABLE "SalesOrder" ADD COLUMN     "salesTypeId" INTEGER NOT NULL;
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_salesTypeId_fkey" FOREIGN KEY ("salesTypeId") REFERENCES "SalesType"(id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: SalesOrderLine — vatAmount (همیشه به ارز هدر، نه ارز مبنا)
ALTER TABLE "SalesOrderLine" ADD COLUMN     "vatAmount" DECIMAL(36,10) NOT NULL DEFAULT 0;
