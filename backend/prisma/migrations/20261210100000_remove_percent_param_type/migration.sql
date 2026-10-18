-- حذف «درصد» از نوع داده‌ی پارامترهای مبنا: پارامترهای درصدی به «عدد» تبدیل می‌شوند (مقدار ذخیره‌شده بدون تغییر، مثلاً ۷ می‌ماند ۷).
UPDATE "PayrollParameter" SET "type" = 'NUMBER' WHERE "type" = 'PERCENT';

ALTER TYPE "PayrollParamType" RENAME TO "PayrollParamType_old";
CREATE TYPE "PayrollParamType" AS ENUM ('NUMBER', 'AMOUNT', 'BRACKETS');
ALTER TABLE "PayrollParameter" ALTER COLUMN "type" TYPE "PayrollParamType" USING ("type"::text::"PayrollParamType");
DROP TYPE "PayrollParamType_old";
