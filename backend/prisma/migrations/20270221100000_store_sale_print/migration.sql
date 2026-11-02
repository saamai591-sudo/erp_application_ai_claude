-- رسید فروش فروشگاهی: نوع چاپ جدید، کاغذ رول حرارتی ۸۰mm و چاپ خودکار رسید روی ایستگاه
ALTER TYPE "PrintDocumentType" ADD VALUE IF NOT EXISTS 'STORE_SALE';
ALTER TYPE "PrintPaper" ADD VALUE IF NOT EXISTS 'ROLL_80';
ALTER TABLE "SalesStation" ADD COLUMN "autoPrintReceipt" BOOLEAN NOT NULL DEFAULT false;
