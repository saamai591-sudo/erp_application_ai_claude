-- AlterTable: SalesQuote — salesTypeId (الزامی، طبق تصمیم صریح کاربر)
ALTER TABLE "SalesQuote" ADD COLUMN     "salesTypeId" INTEGER;
UPDATE "SalesQuote" SET "salesTypeId" = (SELECT id FROM "SalesType" ORDER BY id LIMIT 1);
ALTER TABLE "SalesQuote" ALTER COLUMN "salesTypeId" SET NOT NULL;
ALTER TABLE "SalesQuote" ADD CONSTRAINT "SalesQuote_salesTypeId_fkey" FOREIGN KEY ("salesTypeId") REFERENCES "SalesType"(id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: SalesQuoteLine — vatAmount (همیشه به ارز هدر، نه ارز مبنا — این فرم fxRate ندارد)
ALTER TABLE "SalesQuoteLine" ADD COLUMN     "vatAmount" DECIMAL(36,10) NOT NULL DEFAULT 0;
