-- کارمزد پرداخت ردیف ابزار پرداخت (فقط حواله/انتقال بانکی)
ALTER TABLE "PaymentInstrumentLine" ADD COLUMN "feeAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;
