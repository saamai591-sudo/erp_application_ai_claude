-- اصلاحیه‌ی پیش‌فاکتور تاییدشده: شماره‌ی اصلاحیه روی پیش‌فاکتور + تاریخچه‌ی کامل هر نسخه
ALTER TABLE "SalesQuote" ADD COLUMN "amendmentNumber" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "SalesQuoteRevision" (
  "id" SERIAL NOT NULL,
  "salesQuoteId" INTEGER NOT NULL,
  "number" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" INTEGER,
  "reason" TEXT,
  "snapshot" JSONB NOT NULL,
  "changes" JSONB NOT NULL,
  CONSTRAINT "SalesQuoteRevision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SalesQuoteRevision_salesQuoteId_number_key" ON "SalesQuoteRevision"("salesQuoteId", "number");
ALTER TABLE "SalesQuoteRevision" ADD CONSTRAINT "SalesQuoteRevision_salesQuoteId_fkey" FOREIGN KEY ("salesQuoteId") REFERENCES "SalesQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesQuoteRevision" ADD CONSTRAINT "SalesQuoteRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
