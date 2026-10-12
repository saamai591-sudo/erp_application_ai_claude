-- حقوق و دستمزد: پارامترهای قانونی تاریخ‌دار

CREATE TYPE "PayrollParamType" AS ENUM ('NUMBER', 'PERCENT', 'AMOUNT', 'BRACKETS');

CREATE TABLE "PayrollParameter" (
    "id" SERIAL NOT NULL, "key" TEXT NOT NULL, "title" TEXT NOT NULL, "type" "PayrollParamType" NOT NULL,
    "description" TEXT, "isSystem" BOOLEAN NOT NULL DEFAULT false, "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayrollParameter_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PayrollParameter_key_key" ON "PayrollParameter"("key");

CREATE TABLE "PayrollParameterValue" (
    "id" SERIAL NOT NULL, "parameterId" INTEGER NOT NULL, "effectiveDate" DATE NOT NULL, "value" DECIMAL(20,4),
    "isProvisional" BOOLEAN NOT NULL DEFAULT false, "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PayrollParameterValue_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PayrollParameterValue_parameterId_effectiveDate_key" ON "PayrollParameterValue"("parameterId", "effectiveDate");
ALTER TABLE "PayrollParameterValue" ADD CONSTRAINT "PayrollParameterValue_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "PayrollParameter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PayrollParameterBracket" (
    "id" SERIAL NOT NULL, "valueId" INTEGER NOT NULL, "position" INTEGER NOT NULL,
    "fromAmount" DECIMAL(20,4) NOT NULL, "toAmount" DECIMAL(20,4), "rate" DECIMAL(7,4) NOT NULL,
    CONSTRAINT "PayrollParameterBracket_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PayrollParameterBracket_valueId_position_key" ON "PayrollParameterBracket"("valueId", "position");
ALTER TABLE "PayrollParameterBracket" ADD CONSTRAINT "PayrollParameterBracket_valueId_fkey" FOREIGN KEY ("valueId") REFERENCES "PayrollParameterValue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- پارامترهای سیستمی (کلیدها برای فرمول‌ها ثابت‌اند)
INSERT INTO "PayrollParameter" ("key", "title", "type", "description", "isSystem") VALUES
  ('INSURANCE_EMPLOYEE_RATE', 'نرخ بیمه سهم کارمند', 'PERCENT', 'درصد حق بیمه تامین اجتماعی که از مشمول بیمه کارمند کسر می‌شود', true),
  ('INSURANCE_EMPLOYER_RATE', 'نرخ بیمه سهم کارفرما', 'PERCENT', 'درصد حق بیمه سهم کارفرما از مشمول بیمه', true),
  ('UNEMPLOYMENT_EMPLOYER_RATE', 'نرخ بیمه بیکاری سهم کارفرما', 'PERCENT', 'درصد سهم کارفرما برای بیمه بیکاری', true),
  ('MIN_DAILY_WAGE', 'حداقل دستمزد روزانه', 'AMOUNT', 'حداقل مزد روزانه مصوب شورای عالی کار برای هر سال', true),
  ('INSURANCE_CEILING_MULTIPLE', 'سقف مشمول بیمه (ضریب حداقل دستمزد روزانه)', 'NUMBER', 'سقف مشمول بیمه روزانه = این ضریب × حداقل دستمزد روزانه', true),
  ('MONTHLY_BASE_HOURS', 'ساعت مبنای ماهانه', 'NUMBER', 'ساعت کار مبنای ماه برای محاسبه نرخ ساعتی (اضافه‌کار و کسر ساعتی)', true),
  ('OVERTIME_MULTIPLIER', 'ضریب اضافه‌کار', 'NUMBER', 'ضریب نرخ ساعتی برای هر ساعت اضافه‌کار', true),
  ('TAX_BRACKETS', 'جدول پلکانی مالیات حقوق', 'BRACKETS', 'پله‌های ماهانه مالیات بر درآمد حقوق (از، تا، نرخ)', true)
ON CONFLICT DO NOTHING;

-- مقدارهای پیش‌فرض رایج؛ «موقت» هستند و تا تایید/ویرایش کاربر هشدار نمایش داده می‌شود (مقدار قانونی هر سال را کاربر/مشاور وارد می‌کند)
INSERT INTO "PayrollParameterValue" ("parameterId", "effectiveDate", "value", "isProvisional", "updatedAt")
SELECT p."id", DATE '2000-01-01', v."val", true, CURRENT_TIMESTAMP
FROM (VALUES
  ('INSURANCE_EMPLOYEE_RATE', 7::numeric),
  ('INSURANCE_EMPLOYER_RATE', 20::numeric),
  ('UNEMPLOYMENT_EMPLOYER_RATE', 3::numeric),
  ('INSURANCE_CEILING_MULTIPLE', 7::numeric),
  ('MONTHLY_BASE_HOURS', 192::numeric),
  ('OVERTIME_MULTIPLIER', 1.4::numeric)
) AS v("key", "val")
JOIN "PayrollParameter" p ON p."key" = v."key"
ON CONFLICT DO NOTHING;
