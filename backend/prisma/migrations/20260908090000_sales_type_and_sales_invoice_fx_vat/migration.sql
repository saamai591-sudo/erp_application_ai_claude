-- CreateEnum
CREATE TYPE "SalesNature" AS ENUM ('DOMESTIC', 'EXPORT');

-- CreateTable: SalesType — دقیقاً هم‌الگوی PurchaseType
CREATE TABLE "SalesType" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "nature" "SalesNature" NOT NULL,
    "hasTransactions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalesType_code_key" ON "SalesType"("code");
CREATE UNIQUE INDEX "SalesType_title_key" ON "SalesType"("title");

-- Seed a starting row so the NOT NULL SalesInvoice.salesTypeId backfill below has something to point at
-- (mirrors the one pre-existing PurchaseType row's title, "داخلی")
INSERT INTO "SalesType" ("code", "title", "nature") VALUES (1, 'داخلی', 'DOMESTIC');

-- AlterTable: GoodsServiceAccountingSetting — rename the old numeric-placeholder column to a real FK
ALTER TABLE "GoodsServiceAccountingSetting" RENAME COLUMN "salesTypeRef" TO "salesTypeId";
ALTER TABLE "GoodsServiceAccountingSetting" ADD CONSTRAINT "GoodsServiceAccountingSetting_salesTypeId_fkey" FOREIGN KEY ("salesTypeId") REFERENCES "SalesType"(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: SalesInvoice — salesTypeId/fxRate, هم‌الگوی PurchaseInvoice
ALTER TABLE "SalesInvoice" ADD COLUMN     "salesTypeId" INTEGER;
UPDATE "SalesInvoice" SET "salesTypeId" = (SELECT id FROM "SalesType" ORDER BY id LIMIT 1);
ALTER TABLE "SalesInvoice" ALTER COLUMN "salesTypeId" SET NOT NULL;
ALTER TABLE "SalesInvoice" ADD COLUMN     "fxRate" DECIMAL(18,6) NOT NULL DEFAULT 1;
ALTER TABLE "SalesInvoice" ADD CONSTRAINT "SalesInvoice_salesTypeId_fkey" FOREIGN KEY ("salesTypeId") REFERENCES "SalesType"(id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: SalesInvoiceLine — discount/baseAmount/baseDiscount/vatAmount, هم‌الگوی PurchaseInvoiceLine.
-- رکوردهای موجود (ارز مبنا، fxRate=1) baseAmount=amount و baseDiscount=discount(0) می‌گیرند.
ALTER TABLE "SalesInvoiceLine" ADD COLUMN     "discount" DECIMAL(36,10) NOT NULL DEFAULT 0;
ALTER TABLE "SalesInvoiceLine" ADD COLUMN     "baseAmount" DECIMAL(36,10);
ALTER TABLE "SalesInvoiceLine" ADD COLUMN     "baseDiscount" DECIMAL(36,10) NOT NULL DEFAULT 0;
ALTER TABLE "SalesInvoiceLine" ADD COLUMN     "vatAmount" DECIMAL(36,10) NOT NULL DEFAULT 0;
UPDATE "SalesInvoiceLine" SET "baseAmount" = "amount";
ALTER TABLE "SalesInvoiceLine" ALTER COLUMN "baseAmount" SET NOT NULL;
