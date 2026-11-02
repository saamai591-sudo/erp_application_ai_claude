-- نوع کاغذ هر چاپگر ایستگاه: رول ۸۰mm یا A4/A5 (چاپگر لیزری کاغذ سفارشی ۸۰mm را نمی‌پذیرد)
CREATE TYPE "StorePrinterPaper" AS ENUM ('ROLL_80', 'A4', 'A5');
ALTER TABLE "SalesStationPrinter" ADD COLUMN "paper" "StorePrinterPaper" NOT NULL DEFAULT 'ROLL_80';
ALTER TABLE "PrintJob" ADD COLUMN "paper" "StorePrinterPaper" NOT NULL DEFAULT 'ROLL_80';
