-- عاملی که «در جمع طبقه‌ها نیاید»: در [S:طبقه] (جمع پرداختی/کسر/…) فرمول‌ها حساب نمی‌شود و یال وابستگی هم به آن ساخته نمی‌شود (برای عامل‌هایی مثل «بدهی ماه جاری» که خودشان از جمع‌ها محاسبه می‌شوند).
ALTER TABLE "PayrollComponent" ADD COLUMN "excludeFromSums" BOOLEAN NOT NULL DEFAULT false;
