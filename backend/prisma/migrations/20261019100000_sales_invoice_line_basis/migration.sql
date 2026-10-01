-- انتقال «مبنا» از هدر فاکتور فروش به ردیف‌های آن (هر ردیف مبنای خودش را دارد؛ هدر دیگر منبع حقیقت نیست)
CREATE TYPE "SalesInvoiceLineBasis" AS ENUM ('NO_BASIS', 'SALES_DELIVERY', 'SALES_ORDER', 'SALES_QUOTE');

-- 1) ستون‌ها: ابتدا nullable تا داده‌ی موجود پر شود
ALTER TABLE "SalesInvoiceLine" ADD COLUMN "basis" "SalesInvoiceLineBasis";
ALTER TABLE "SalesInvoiceLine" ADD COLUMN "sourceSalesOrderLineId" INTEGER;
ALTER TABLE "SalesInvoiceLine" ADD COLUMN "sourceSalesQuoteLineId" INTEGER;

-- 2) داده‌ی موجود: هر ردیف مبنای قبلیِ هدر فاکتورش را به ارث می‌برد (NO_BASIS → NO_BASIS، SALES_DELIVERY → SALES_DELIVERY).
--    ارجاع ردیف حواله (sourceInventoryLineId) و بقیه‌ی داده دست‌نخورده می‌ماند.
UPDATE "SalesInvoiceLine" l
SET "basis" = CASE i."basis"::text WHEN 'SALES_DELIVERY' THEN 'SALES_DELIVERY'::"SalesInvoiceLineBasis" ELSE 'NO_BASIS'::"SalesInvoiceLineBasis" END
FROM "SalesInvoice" i
WHERE i."id" = l."salesInvoiceId";

-- 3) هیچ ردیفی بدون مبنا نماند
ALTER TABLE "SalesInvoiceLine" ALTER COLUMN "basis" SET NOT NULL;

ALTER TABLE "SalesInvoiceLine" ADD CONSTRAINT "SalesInvoiceLine_sourceSalesOrderLineId_fkey" FOREIGN KEY ("sourceSalesOrderLineId") REFERENCES "SalesOrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesInvoiceLine" ADD CONSTRAINT "SalesInvoiceLine_sourceSalesQuoteLineId_fkey" FOREIGN KEY ("sourceSalesQuoteLineId") REFERENCES "SalesQuoteLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4) حذف مبنای هدر تا دو منبع حقیقت رقیب وجود نداشته باشد (مقدار آن در مرحله‌ی ۲ به همه‌ی ردیف‌ها منتقل شده است)
ALTER TABLE "SalesInvoice" DROP COLUMN "basis";
DROP TYPE "SalesInvoiceBasis";
