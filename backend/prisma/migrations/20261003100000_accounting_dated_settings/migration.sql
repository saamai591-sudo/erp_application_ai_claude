-- CreateEnum
CREATE TYPE "AdvanceReceiptFxMethod" AS ENUM ('HISTORICAL_RATE', 'TRANSACTION_DATE_RATE');

-- CreateTable
CREATE TABLE "AccountingVatRate" (
    "id" SERIAL NOT NULL,
    "startDate" DATE NOT NULL,
    "ratePercent" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingVatRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingAdvanceReceiptSetting" (
    "id" SERIAL NOT NULL,
    "startDate" DATE NOT NULL,
    "method" "AdvanceReceiptFxMethod" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingAdvanceReceiptSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountingVatRate_startDate_key" ON "AccountingVatRate"("startDate");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingAdvanceReceiptSetting_startDate_key" ON "AccountingAdvanceReceiptSetting"("startDate");

-- نرخ اولیه: تا این‌جا موتور محاسبه‌ی ارزش افزوده نرخ ثابت ۱۰٪ داشت؛ برای این‌که رفتار فعلی سیستم بدون تغییر بماند، یک رکورد اولیه‌ی ۱۰٪ از تاریخ
-- بسیار قدیمی ثبت می‌شود (کاربر می‌تواند آن را ویرایش کند یا نرخ‌های جدید با تاریخ شروع جدید اضافه کند).
INSERT INTO "AccountingVatRate" ("startDate", "ratePercent") VALUES ('2000-01-01', 10);
