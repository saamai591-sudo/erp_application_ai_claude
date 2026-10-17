-- «نوع محاسبه» حقوق: حقوق ماهانه (پایه) + عیدی/ذخیره سنوات/بازخرید مرخصی/بازخرید سنوات؛ عامل حقوق و فیش به یک نوع وصل می‌شوند.
CREATE TABLE "PayrollCalcType" (
  "id" SERIAL NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "isBase" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayrollCalcType_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PayrollCalcType_title_key" ON "PayrollCalcType"("title");
-- دقیقاً یک نوع پایه
CREATE UNIQUE INDEX "PayrollCalcType_one_base" ON "PayrollCalcType"("isBase") WHERE "isBase";

INSERT INTO "PayrollCalcType" ("title", "description", "isBase") VALUES ('حقوق ماهانه', 'محاسبه‌ی ماهانه‌ی حقوق و دستمزد (نوع پایه)', true);
INSERT INTO "PayrollCalcType" ("title") VALUES ('عیدی'), ('ذخیره سنوات'), ('بازخرید مرخصی'), ('بازخرید سنوات');

-- عامل‌های موجود ← حقوق ماهانه
ALTER TABLE "PayrollComponent" ADD COLUMN "calcTypeId" INTEGER;
UPDATE "PayrollComponent" SET "calcTypeId" = (SELECT "id" FROM "PayrollCalcType" WHERE "isBase");
ALTER TABLE "PayrollComponent" ALTER COLUMN "calcTypeId" SET NOT NULL;
CREATE INDEX "PayrollComponent_calcTypeId_idx" ON "PayrollComponent"("calcTypeId");
ALTER TABLE "PayrollComponent" ADD CONSTRAINT "PayrollComponent_calcTypeId_fkey" FOREIGN KEY ("calcTypeId") REFERENCES "PayrollCalcType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- فیش‌های موجود ← حقوق ماهانه؛ یکتایی به (کارمند، سال، ماه، نوع) تغییر می‌کند
ALTER TABLE "PayrollSlip" ADD COLUMN "calcTypeId" INTEGER;
UPDATE "PayrollSlip" SET "calcTypeId" = (SELECT "id" FROM "PayrollCalcType" WHERE "isBase");
ALTER TABLE "PayrollSlip" ALTER COLUMN "calcTypeId" SET NOT NULL;
DROP INDEX "PayrollSlip_employeeId_year_month_key";
CREATE UNIQUE INDEX "PayrollSlip_employeeId_year_month_calcTypeId_key" ON "PayrollSlip"("employeeId", "year", "month", "calcTypeId");
CREATE INDEX "PayrollSlip_calcTypeId_idx" ON "PayrollSlip"("calcTypeId");
ALTER TABLE "PayrollSlip" ADD CONSTRAINT "PayrollSlip_calcTypeId_fkey" FOREIGN KEY ("calcTypeId") REFERENCES "PayrollCalcType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
