-- مدیریت تردد: «ارسال به حقوق» — زمان/کاربرِ ارسال نتیجه‌ی عوامل حقوقی به ورودی‌های ماهانه‌ی حقوق (PayrollFactorInput)
ALTER TABLE "AttendanceCalculation" ADD COLUMN "sentToPayrollAt" TIMESTAMP(3);
ALTER TABLE "AttendanceCalculation" ADD COLUMN "sentToPayrollById" INTEGER;
