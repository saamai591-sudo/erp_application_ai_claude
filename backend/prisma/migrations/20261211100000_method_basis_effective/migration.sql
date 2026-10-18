-- مبنا در «روش محاسبه عامل» سه‌حالته شد: تعیین‌نشده (ردیفی نیست) | با تأثیر (effective = true) | بدون تأثیر (effective = false).
-- ردیف‌های موجود همه عضو مبنا بودند، پس «با تأثیر» می‌مانند.
ALTER TABLE "PayrollFactorMethodBasis" ADD COLUMN "effective" BOOLEAN NOT NULL DEFAULT true;
