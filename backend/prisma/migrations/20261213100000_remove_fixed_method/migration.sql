-- حذف روش «مقدار ثابت» از «روش محاسبه عامل» (مقدار ثابت پرسنلی و پارامترهای مبنا جای آن را می‌گیرند).
-- رکوردهای موجود با روش FIXED به «محاسباتی» با یک شاخه‌ی بدون شرط و فرمولِ همان عدد تبدیل می‌شوند، پس مبلغ محاسبه‌ها و ارجاع فیش‌ها (methodId) بدون تغییر می‌ماند.
INSERT INTO "PayrollFactorMethodBranch" ("methodId", "seq", "conditionText", "formulaText")
SELECT m."id", 1, NULL, trim_scale(COALESCE(m."fixedValue", 0))::text
FROM "PayrollFactorMethod" m
WHERE m."method" = 'FIXED'
  AND NOT EXISTS (SELECT 1 FROM "PayrollFactorMethodBranch" b WHERE b."methodId" = m."id");

UPDATE "PayrollFactorMethod" SET "method" = 'CALCULATED' WHERE "method" = 'FIXED';

ALTER TABLE "PayrollFactorMethod" DROP COLUMN "fixedValue";

ALTER TABLE "PayrollFactorMethod" ALTER COLUMN "method" DROP DEFAULT;
ALTER TYPE "PayrollMethod" RENAME TO "PayrollMethod_old";
CREATE TYPE "PayrollMethod" AS ENUM ('CALCULATED', 'MANUAL', 'ATTENDANCE', 'TREASURY');
ALTER TABLE "PayrollFactorMethod" ALTER COLUMN "method" TYPE "PayrollMethod" USING ("method"::text::"PayrollMethod");
ALTER TABLE "PayrollFactorMethod" ALTER COLUMN "method" SET DEFAULT 'CALCULATED';
DROP TYPE "PayrollMethod_old";
