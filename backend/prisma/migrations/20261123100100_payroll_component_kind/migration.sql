-- حقوق و دستمزد: «طبقه» از رکورد تاریخ‌دار «روش محاسبه عامل» به خود «عامل حقوق» منتقل می‌شود
ALTER TABLE "PayrollComponent" ADD COLUMN "kind" "PayrollComponentKind" NOT NULL DEFAULT 'EARNING';
UPDATE "PayrollComponent" c SET "kind" = m."kind"
FROM (SELECT DISTINCT ON ("payrollComponentId") "payrollComponentId", "kind"
      FROM "PayrollFactorMethod" WHERE "payrollComponentId" IS NOT NULL
      ORDER BY "payrollComponentId", "effectiveDate" DESC) m
WHERE m."payrollComponentId" = c."id";
ALTER TABLE "PayrollComponent" ALTER COLUMN "kind" DROP DEFAULT;
ALTER TABLE "PayrollFactorMethod" DROP COLUMN "kind";
