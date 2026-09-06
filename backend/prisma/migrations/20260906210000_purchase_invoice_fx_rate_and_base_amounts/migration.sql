-- AlterTable
ALTER TABLE "PurchaseInvoice" ADD COLUMN     "fxRate" DECIMAL(18,6) NOT NULL DEFAULT 1;

-- AlterTable: baseAmount/baseDiscount نمی‌توانند مستقیم NOT NULL اضافه شوند چون ردیف‌های موجود دارند؛
-- برای رکوردهای پیشین (که همه پیش از وجود fxRate ثبت شده‌اند، یعنی fxRate=1 پیش‌فرض بالا برایشان هم
-- درست است) baseAmount/baseDiscount همان amount/discount خودشان است.
ALTER TABLE "PurchaseInvoiceLine" ADD COLUMN     "baseAmount" DECIMAL(36,10),
ADD COLUMN     "baseDiscount" DECIMAL(36,10) NOT NULL DEFAULT 0;

UPDATE "PurchaseInvoiceLine" SET "baseAmount" = "amount", "baseDiscount" = "discount";

ALTER TABLE "PurchaseInvoiceLine" ALTER COLUMN "baseAmount" SET NOT NULL;
