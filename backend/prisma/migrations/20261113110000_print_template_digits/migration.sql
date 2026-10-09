-- ارقام قالب چاپ (انگلیسی/فارسی) و حاشیه‌ی پیش‌فرض ۱۰ میلی‌متر
CREATE TYPE "PrintDigits" AS ENUM ('LATIN', 'PERSIAN');
ALTER TABLE "PrintTemplate" ADD COLUMN "digits" "PrintDigits" NOT NULL DEFAULT 'LATIN';
ALTER TABLE "PrintTemplate" ALTER COLUMN "marginMm" SET DEFAULT 10;
