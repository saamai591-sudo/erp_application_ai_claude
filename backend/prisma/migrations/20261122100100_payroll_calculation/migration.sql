-- حقوق و دستمزد: اجزای حقوق (فرمولی)، مشخصات محاسبه‌ی تاریخ‌دار، کارکرد ماهانه، فیش محاسبه‌شده

CREATE TYPE "PayrollComponentKind" AS ENUM ('EARNING', 'DEDUCTION', 'EMPLOYER_COST', 'INFO');
CREATE TYPE "PayrollSectionKind" AS ENUM ('DECREE_COMPONENT', 'PAYROLL_COMPONENT');

CREATE TABLE "PayrollComponent" (
    "id" SERIAL NOT NULL, "key" TEXT NOT NULL, "title" TEXT NOT NULL, "kind" "PayrollComponentKind" NOT NULL,
    "formula" TEXT NOT NULL, "description" TEXT, "isSystem" BOOLEAN NOT NULL DEFAULT false, "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayrollComponent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PayrollComponent_key_key" ON "PayrollComponent"("key");

CREATE TABLE "PayrollItemProfile" (
    "id" SERIAL NOT NULL, "decreeComponentId" INTEGER, "payrollComponentId" INTEGER, "effectiveDate" DATE NOT NULL,
    "prorate" BOOLEAN NOT NULL DEFAULT true, "insurable" BOOLEAN NOT NULL DEFAULT false, "taxable" BOOLEAN NOT NULL DEFAULT false,
    "overtimeBase" BOOLEAN NOT NULL DEFAULT false, "isProvisional" BOOLEAN NOT NULL DEFAULT false, "note" TEXT,
    CONSTRAINT "PayrollItemProfile_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PayrollItemProfile_exactly_one_item" CHECK (("decreeComponentId" IS NOT NULL) <> ("payrollComponentId" IS NOT NULL))
);
CREATE UNIQUE INDEX "PayrollItemProfile_decreeComponentId_effectiveDate_key" ON "PayrollItemProfile"("decreeComponentId", "effectiveDate");
CREATE UNIQUE INDEX "PayrollItemProfile_payrollComponentId_effectiveDate_key" ON "PayrollItemProfile"("payrollComponentId", "effectiveDate");
ALTER TABLE "PayrollItemProfile" ADD CONSTRAINT "PayrollItemProfile_decreeComponentId_fkey" FOREIGN KEY ("decreeComponentId") REFERENCES "DecreeComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollItemProfile" ADD CONSTRAINT "PayrollItemProfile_payrollComponentId_fkey" FOREIGN KEY ("payrollComponentId") REFERENCES "PayrollComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PayrollMonthlyWork" (
    "id" SERIAL NOT NULL, "employeeId" INTEGER NOT NULL, "year" INTEGER NOT NULL, "month" INTEGER NOT NULL,
    "workDays" DECIMAL(5,2) NOT NULL, "overtimeHours" DECIMAL(7,2) NOT NULL DEFAULT 0, "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PayrollMonthlyWork_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PayrollMonthlyWork_employeeId_year_month_key" ON "PayrollMonthlyWork"("employeeId", "year", "month");
ALTER TABLE "PayrollMonthlyWork" ADD CONSTRAINT "PayrollMonthlyWork_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PayrollSlip" (
    "id" SERIAL NOT NULL, "employeeId" INTEGER NOT NULL, "year" INTEGER NOT NULL, "month" INTEGER NOT NULL, "decreeId" INTEGER,
    "monthDays" INTEGER NOT NULL, "workDays" DECIMAL(5,2) NOT NULL, "overtimeHours" DECIMAL(7,2) NOT NULL,
    "earnings" DECIMAL(20,4) NOT NULL, "deductions" DECIMAL(20,4) NOT NULL, "employerCosts" DECIMAL(20,4) NOT NULL, "netPay" DECIMAL(20,4) NOT NULL,
    "hasErrors" BOOLEAN NOT NULL DEFAULT false, "parameters" JSONB NOT NULL, "warnings" JSONB NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayrollSlip_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PayrollSlip_employeeId_year_month_key" ON "PayrollSlip"("employeeId", "year", "month");
ALTER TABLE "PayrollSlip" ADD CONSTRAINT "PayrollSlip_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollSlip" ADD CONSTRAINT "PayrollSlip_decreeId_fkey" FOREIGN KEY ("decreeId") REFERENCES "EmploymentDecree"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PayrollSlipLine" (
    "id" SERIAL NOT NULL, "slipId" INTEGER NOT NULL, "seq" INTEGER NOT NULL, "kind" "PayrollComponentKind" NOT NULL,
    "source" "PayrollSectionKind" NOT NULL, "refId" INTEGER, "title" TEXT NOT NULL, "formula" TEXT,
    "insurable" BOOLEAN NOT NULL DEFAULT false, "taxable" BOOLEAN NOT NULL DEFAULT false,
    "amount" DECIMAL(20,4) NOT NULL, "error" TEXT, "trace" JSONB NOT NULL,
    CONSTRAINT "PayrollSlipLine_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PayrollSlipLine_slipId_seq_key" ON "PayrollSlipLine"("slipId", "seq");
ALTER TABLE "PayrollSlipLine" ADD CONSTRAINT "PayrollSlipLine_slipId_fkey" FOREIGN KEY ("slipId") REFERENCES "PayrollSlip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- اجزای حقوق سیستمی (کلیدها ثابت‌اند؛ فرمول‌ها قابل ویرایش‌اند)
INSERT INTO "PayrollComponent" ("key", "title", "kind", "formula", "description", "isSystem") VALUES
  ('OVERTIME', 'اضافه‌کار', 'EARNING',
   '[V:OVERTIME_HOURS] * [P:OVERTIME_MULTIPLIER] * [V:OVERTIME_BASE_TOTAL] / [P:MONTHLY_BASE_HOURS]',
   'ساعت اضافه‌کار × ضریب × نرخ ساعتی (مبنای اضافه‌کار ÷ ساعت مبنای ماه)', true),
  ('INS_EMPLOYEE', 'بیمه سهم کارمند', 'DEDUCTION',
   'MIN([V:INSURABLE_TOTAL], [P:MIN_DAILY_WAGE] * [P:INSURANCE_CEILING_MULTIPLE] * [V:WORK_DAYS]) * [P:INSURANCE_EMPLOYEE_RATE] / 100',
   'کمینه‌ی (جمع مشمول بیمه، سقف) × نرخ سهم کارمند', true),
  ('TAX', 'مالیات حقوق', 'DEDUCTION',
   'PROGRESSIVE([P:TAX_BRACKETS], MAX([V:TAXABLE_TOTAL] - [C:INS_EMPLOYEE], 0))',
   'مالیات پلکانی روی (جمع مشمول مالیات − بیمه سهم کارمند)', true),
  ('INS_EMPLOYER', 'بیمه سهم کارفرما', 'EMPLOYER_COST',
   'MIN([V:INSURABLE_TOTAL], [P:MIN_DAILY_WAGE] * [P:INSURANCE_CEILING_MULTIPLE] * [V:WORK_DAYS]) * [P:INSURANCE_EMPLOYER_RATE] / 100',
   'کمینه‌ی (جمع مشمول بیمه، سقف) × نرخ سهم کارفرما', true),
  ('UNEMP_EMPLOYER', 'بیمه بیکاری سهم کارفرما', 'EMPLOYER_COST',
   'MIN([V:INSURABLE_TOTAL], [P:MIN_DAILY_WAGE] * [P:INSURANCE_CEILING_MULTIPLE] * [V:WORK_DAYS]) * [P:UNEMPLOYMENT_EMPLOYER_RATE] / 100',
   'کمینه‌ی (جمع مشمول بیمه، سقف) × نرخ بیمه بیکاری', true)
ON CONFLICT DO NOTHING;

-- مشخصات محاسبه‌ی پیش‌فرض (موقت — باید با رویه‌ی شرکت/قانون تطبیق و تایید شود)
INSERT INTO "PayrollItemProfile" ("decreeComponentId", "effectiveDate", "prorate", "insurable", "taxable", "overtimeBase", "isProvisional")
SELECT d."id", DATE '2000-01-01', true, true, true, d."code" IN (1, 2), true FROM "DecreeComponent" d
ON CONFLICT DO NOTHING;

INSERT INTO "PayrollItemProfile" ("payrollComponentId", "effectiveDate", "prorate", "insurable", "taxable", "overtimeBase", "isProvisional")
SELECT c."id", DATE '2000-01-01', false, c."key" = 'OVERTIME', c."key" = 'OVERTIME', false, true FROM "PayrollComponent" c
ON CONFLICT DO NOTHING;
