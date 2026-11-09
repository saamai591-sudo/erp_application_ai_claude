-- قواعد تشخیص نوع صورتحساب مالیاتی (نوع ۱/۲) به‌تفکیک منبع داده، تاریخ‌دار
CREATE TYPE "TaxInvoiceSource" AS ENUM ('SALES_INVOICE', 'STORE_SALE');
CREATE TYPE "TaxBuyerKind" AS ENUM ('INDIVIDUAL', 'LEGAL');

CREATE TABLE "TaxInvoiceTypeRuleSet" (
  "id" SERIAL NOT NULL,
  "source" "TaxInvoiceSource" NOT NULL,
  "effectiveDate" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaxInvoiceTypeRuleSet_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TaxInvoiceTypeRuleSet_source_effectiveDate_key" ON "TaxInvoiceTypeRuleSet"("source", "effectiveDate");

CREATE TABLE "TaxInvoiceTypeRule" (
  "id" SERIAL NOT NULL,
  "setId" INTEGER NOT NULL,
  "buyerKind" "TaxBuyerKind",
  "hasEconomicCode" BOOLEAN,
  "salesCenterId" INTEGER,
  "invoiceType" INTEGER NOT NULL,
  CONSTRAINT "TaxInvoiceTypeRule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TaxInvoiceTypeRule_type_chk" CHECK ("invoiceType" IN (1, 2))
);
CREATE INDEX "TaxInvoiceTypeRule_setId_idx" ON "TaxInvoiceTypeRule"("setId");
ALTER TABLE "TaxInvoiceTypeRule" ADD CONSTRAINT "TaxInvoiceTypeRule_setId_fkey" FOREIGN KEY ("setId") REFERENCES "TaxInvoiceTypeRuleSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaxInvoiceTypeRule" ADD CONSTRAINT "TaxInvoiceTypeRule_salesCenterId_fkey" FOREIGN KEY ("salesCenterId") REFERENCES "SalesCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
