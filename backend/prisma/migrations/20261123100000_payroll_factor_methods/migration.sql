-- حقوق و دستمزد: «روش محاسبه عامل» (تاریخ‌دار با ماه اجرا؛ مبنا عامل حکم یا عامل حقوق) و ورودی ماهانه‌ی عوامل؛
-- مشخصات محاسبه‌ی قبلی، کارکرد ماهانه و فیلدهای نوع/فرمول روی عامل حذف می‌شود (نتایج قبلی بی‌اعتبار و پاک می‌شوند).

DELETE FROM "PayrollSlip";

CREATE TYPE "PayrollMethod" AS ENUM ('CALCULATED', 'FIXED', 'MANUAL', 'ATTENDANCE', 'TREASURY');
CREATE TYPE "PayrollValueType" AS ENUM ('NUMBER', 'TIME', 'DAYS', 'AMOUNT');

DROP TABLE "PayrollItemProfile";
DROP TABLE "PayrollMonthlyWork";
ALTER TABLE "PayrollSlip" DROP COLUMN "workDays", DROP COLUMN "overtimeHours";
DELETE FROM "PayrollComponent";
ALTER TABLE "PayrollComponent" DROP COLUMN "kind", DROP COLUMN "formula";

CREATE TABLE "PayrollFactorMethod" (
    "id" SERIAL NOT NULL, "decreeComponentId" INTEGER, "payrollComponentId" INTEGER,
    "method" "PayrollMethod" NOT NULL DEFAULT 'CALCULATED', "kind" "PayrollComponentKind" NOT NULL,
    "valueType" "PayrollValueType" NOT NULL DEFAULT 'AMOUNT',
    "issueYear" INTEGER NOT NULL, "issueMonth" INTEGER NOT NULL, "execYear" INTEGER NOT NULL, "execMonth" INTEGER NOT NULL,
    "effectiveDate" DATE NOT NULL, "fixedValue" DECIMAL(20,4), "conditionText" TEXT, "formulaText" TEXT,
    "isProvisional" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PayrollFactorMethod_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PayrollFactorMethod_exactly_one_basis" CHECK (("decreeComponentId" IS NOT NULL) <> ("payrollComponentId" IS NOT NULL))
);
CREATE UNIQUE INDEX "PayrollFactorMethod_decreeComponentId_effectiveDate_key" ON "PayrollFactorMethod"("decreeComponentId", "effectiveDate");
CREATE UNIQUE INDEX "PayrollFactorMethod_payrollComponentId_effectiveDate_key" ON "PayrollFactorMethod"("payrollComponentId", "effectiveDate");
ALTER TABLE "PayrollFactorMethod" ADD CONSTRAINT "PayrollFactorMethod_decreeComponentId_fkey" FOREIGN KEY ("decreeComponentId") REFERENCES "DecreeComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollFactorMethod" ADD CONSTRAINT "PayrollFactorMethod_payrollComponentId_fkey" FOREIGN KEY ("payrollComponentId") REFERENCES "PayrollComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PayrollFactorInput" (
    "id" SERIAL NOT NULL, "employeeId" INTEGER NOT NULL, "year" INTEGER NOT NULL, "month" INTEGER NOT NULL,
    "componentId" INTEGER NOT NULL, "value" DECIMAL(20,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PayrollFactorInput_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PayrollFactorInput_employeeId_year_month_componentId_key" ON "PayrollFactorInput"("employeeId", "year", "month", "componentId");
ALTER TABLE "PayrollFactorInput" ADD CONSTRAINT "PayrollFactorInput_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollFactorInput" ADD CONSTRAINT "PayrollFactorInput_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "PayrollComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- عوامل حقوق پیش‌فرض (هویت). کلیدها داخلی‌اند و به کاربر نشان داده نمی‌شوند.
INSERT INTO "PayrollComponent" ("key", "title", "description", "isSystem") VALUES
  ('WORK_DAYS', 'روز کارکرد', 'تعداد روزهای کارکرد کارمند در ماه (ورودی)', true),
  ('OVERTIME_HOURS', 'ساعت اضافه‌کار', 'مجموع ساعت اضافه‌کار ماه (ورودی)', true),
  ('OVERTIME', 'اضافه‌کار', 'مبلغ اضافه‌کار ماه', true),
  ('INS_EMPLOYEE', 'بیمه سهم کارمند', 'حق بیمه تامین اجتماعی سهم کارمند', true),
  ('TAX', 'مالیات حقوق', 'مالیات پلکانی حقوق', true),
  ('INS_EMPLOYER', 'بیمه سهم کارفرما', 'حق بیمه سهم کارفرما', true),
  ('UNEMP_EMPLOYER', 'بیمه بیکاری سهم کارفرما', 'سهم کارفرما برای بیمه بیکاری', true)
ON CONFLICT DO NOTHING;

-- روش پیش‌فرض عوامل حقوق (موقت — باید با رویه‌ی شرکت/قانون تطبیق و تایید شود). تاریخ اجرا: ۱۳۷۸/۱۰ (۲۰۰۰-۰۱-۰۱)
INSERT INTO "PayrollFactorMethod" ("payrollComponentId", "method", "kind", "valueType", "issueYear", "issueMonth", "execYear", "execMonth", "effectiveDate", "formulaText", "isProvisional", "updatedAt")
SELECT c."id", v."method"::"PayrollMethod", v."kind"::"PayrollComponentKind", v."vt"::"PayrollValueType", 1378, 10, 1378, 10, DATE '2000-01-01', v."formula", true, CURRENT_TIMESTAMP
FROM (VALUES
  ('WORK_DAYS', 'MANUAL', 'INFO', 'DAYS', NULL),
  ('OVERTIME_HOURS', 'MANUAL', 'INFO', 'TIME', NULL),
  ('OVERTIME', 'CALCULATED', 'EARNING', 'AMOUNT',
   '[C:OVERTIME_HOURS] * [P:OVERTIME_MULTIPLIER] * ([D:1:LAST] + [D:2:LAST] * [B:MONTH_DAYS]) / [P:MONTHLY_BASE_HOURS]'),
  ('INS_EMPLOYEE', 'CALCULATED', 'DEDUCTION', 'AMOUNT',
   'MIN([S:EARNING], [P:MIN_DAILY_WAGE] * [P:INSURANCE_CEILING_MULTIPLE] * [C:WORK_DAYS]) * [P:INSURANCE_EMPLOYEE_RATE] / 100'),
  ('TAX', 'CALCULATED', 'DEDUCTION', 'AMOUNT',
   'PROGRESSIVE([P:TAX_BRACKETS], MAX([S:EARNING] - [C:INS_EMPLOYEE], 0))'),
  ('INS_EMPLOYER', 'CALCULATED', 'EMPLOYER_COST', 'AMOUNT',
   'MIN([S:EARNING], [P:MIN_DAILY_WAGE] * [P:INSURANCE_CEILING_MULTIPLE] * [C:WORK_DAYS]) * [P:INSURANCE_EMPLOYER_RATE] / 100'),
  ('UNEMP_EMPLOYER', 'CALCULATED', 'EMPLOYER_COST', 'AMOUNT',
   'MIN([S:EARNING], [P:MIN_DAILY_WAGE] * [P:INSURANCE_CEILING_MULTIPLE] * [C:WORK_DAYS]) * [P:UNEMPLOYMENT_EMPLOYER_RATE] / 100')
) AS v("key", "method", "kind", "vt", "formula")
JOIN "PayrollComponent" c ON c."key" = v."key"
ON CONFLICT DO NOTHING;

-- روش پیش‌فرض عوامل حکم: مبلغ ماهانه متناسب با روز کارکرد، مبلغ روزانه × روز کارکرد
INSERT INTO "PayrollFactorMethod" ("decreeComponentId", "method", "kind", "valueType", "issueYear", "issueMonth", "execYear", "execMonth", "effectiveDate", "formulaText", "isProvisional", "updatedAt")
SELECT d."id", 'CALCULATED', 'EARNING', 'AMOUNT', 1378, 10, 1378, 10, DATE '2000-01-01',
       CASE WHEN d."valueType" = 'DAILY_AMOUNT'
            THEN '[D:' || d."code" || ':LAST] * [C:WORK_DAYS]'
            ELSE '[D:' || d."code" || ':LAST] * [C:WORK_DAYS] / [B:MONTH_DAYS]' END,
       true, CURRENT_TIMESTAMP
FROM "DecreeComponent" d
ON CONFLICT DO NOTHING;
