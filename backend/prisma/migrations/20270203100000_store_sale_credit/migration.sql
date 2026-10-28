-- فروش فروشگاهی: ثبت عامدانه‌ی باقیمانده به‌عنوان نسیه (فروش بدون تسویه و بدون نسیه، قابل تحویل نیست)
ALTER TABLE "StoreSale" ADD COLUMN "creditDeclaredAt" TIMESTAMP(3), ADD COLUMN "creditDeclaredById" INTEGER, ADD COLUMN "creditNote" TEXT;
