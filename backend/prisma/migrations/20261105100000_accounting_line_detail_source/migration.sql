-- منبع مقدار هر سطح تفصیل ردیف‌های حسابداری دریافت/پرداخت: AUTO (سیستم، قفل) یا MANUAL (حسابدار)
CREATE TYPE "DetailValueSource" AS ENUM ('AUTO', 'MANUAL');

ALTER TABLE "ReceiptAccountingLine" ADD COLUMN "detail1Source" "DetailValueSource" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "ReceiptAccountingLine" ADD COLUMN "detail2Source" "DetailValueSource" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "ReceiptAccountingLine" ADD COLUMN "detail3Source" "DetailValueSource" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "PaymentAccountingLine" ADD COLUMN "detail1Source" "DetailValueSource" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "PaymentAccountingLine" ADD COLUMN "detail2Source" "DetailValueSource" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "PaymentAccountingLine" ADD COLUMN "detail3Source" "DetailValueSource" NOT NULL DEFAULT 'MANUAL';
