-- AlterTable: SalesQuote — salesCenterId (الزامی). ۱ رکورد موجود به تنها SalesCenter موجود backfill می‌شود.
ALTER TABLE "SalesQuote" ADD COLUMN     "salesCenterId" INTEGER;
UPDATE "SalesQuote" SET "salesCenterId" = (SELECT id FROM "SalesCenter" ORDER BY id LIMIT 1);
ALTER TABLE "SalesQuote" ALTER COLUMN "salesCenterId" SET NOT NULL;
ALTER TABLE "SalesQuote" ADD CONSTRAINT "SalesQuote_salesCenterId_fkey" FOREIGN KEY ("salesCenterId") REFERENCES "SalesCenter"(id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: SalesOrder — salesCenterId (الزامی). جدول خالی است، پس بدون backfill مستقیم NOT NULL می‌شود.
ALTER TABLE "SalesOrder" ADD COLUMN     "salesCenterId" INTEGER NOT NULL;
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_salesCenterId_fkey" FOREIGN KEY ("salesCenterId") REFERENCES "SalesCenter"(id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: SalesInvoice — salesCenterId (الزامی). ۲ رکورد موجود به تنها SalesCenter موجود backfill می‌شود.
ALTER TABLE "SalesInvoice" ADD COLUMN     "salesCenterId" INTEGER;
UPDATE "SalesInvoice" SET "salesCenterId" = (SELECT id FROM "SalesCenter" ORDER BY id LIMIT 1);
ALTER TABLE "SalesInvoice" ALTER COLUMN "salesCenterId" SET NOT NULL;
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_salesCenterId_fkey" FOREIGN KEY ("salesCenterId") REFERENCES "SalesCenter"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
