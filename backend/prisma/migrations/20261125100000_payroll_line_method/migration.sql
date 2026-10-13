-- حقوق و دستمزد: ثبت روش محاسبه‌ی استفاده‌شده در هر ردیف فیش (برای قفل روش‌ها بعد از محاسبه)
ALTER TABLE "PayrollSlipLine" ADD COLUMN "methodId" INTEGER;
CREATE INDEX "PayrollSlipLine_methodId_idx" ON "PayrollSlipLine"("methodId");
