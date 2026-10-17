-- ۱) هیچ عامل حقوقی «سیستمی» نیست و کاربر می‌تواند همه را حذف کند: ستون isSystem برداشته می‌شود.
ALTER TABLE "PayrollComponent" DROP COLUMN "isSystem";

-- ۲) حذف چهار پارامتر مبنای پیش‌فرض: جدول پلکانی مالیات حقوق، ضریب اضافه‌کار، ساعت مبنای ماهانه، سقف مشمول بیمه.
--    روش‌های «پیش‌فرض نصب» (تاییدنشده) که به آن‌ها ارجاع می‌دهند و در هیچ فیشی به کار نرفته‌اند حذف می‌شوند؛
--    پارامتری که هنوز روشی (ویرایش‌شده‌ی کاربر) یا فیشی به آن ارجاع دارد حذف نمی‌شود و فقط از حالت سیستمی درمی‌آید تا کاربر خودش حذفش کند.
DELETE FROM "PayrollFactorMethod" m
WHERE m."isProvisional"
  AND (upper(coalesce(m."formulaText", '') || ' ' || coalesce(m."conditionText", '')) ~ '\[P:(TAX_BRACKETS|OVERTIME_MULTIPLIER|MONTHLY_BASE_HOURS|INSURANCE_CEILING_MULTIPLE)[\]:]')
  AND NOT EXISTS (
    SELECT 1 FROM "PayrollSlipLine" l
    WHERE l."methodId" = m.id
       OR (l."methodId" IS NULL
           AND ((l."source" = 'PAYROLL_COMPONENT' AND l."refId" = m."payrollComponentId")
             OR (l."source" = 'DECREE_COMPONENT' AND l."refId" = m."decreeComponentId")))
  );

DELETE FROM "PayrollParameter" p
WHERE p."key" IN ('TAX_BRACKETS', 'OVERTIME_MULTIPLIER', 'MONTHLY_BASE_HOURS', 'INSURANCE_CEILING_MULTIPLE')
  AND NOT EXISTS (
    SELECT 1 FROM "PayrollFactorMethod" m
    WHERE upper(coalesce(m."formulaText", '') || ' ' || coalesce(m."conditionText", '')) LIKE '%[P:' || p."key" || ']%'
       OR upper(coalesce(m."formulaText", '') || ' ' || coalesce(m."conditionText", '')) LIKE '%[P:' || p."key" || ':%'
  )
  AND NOT EXISTS (SELECT 1 FROM "PayrollSlip" s WHERE s."parameters" ? p."key");

UPDATE "PayrollParameter" SET "isSystem" = false WHERE "key" IN ('TAX_BRACKETS', 'OVERTIME_MULTIPLIER', 'MONTHLY_BASE_HOURS', 'INSURANCE_CEILING_MULTIPLE');
