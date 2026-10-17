-- شاخه‌های «شرط ← فرمول» برای روش محاسبه‌ی عامل: از بالا به پایین، اولین شاخه‌ی دارای شرطِ برقرار اجرا می‌شود (هیچ‌کدام ⇒ صفر).
-- شرط/فرمول فعلیِ هر روش به شاخه‌ی ۱ منتقل و ستون‌های قدیمی حذف می‌شود.
CREATE TABLE "PayrollFactorMethodBranch" (
  "id" SERIAL NOT NULL,
  "methodId" INTEGER NOT NULL,
  "seq" INTEGER NOT NULL,
  "conditionText" TEXT,
  "formulaText" TEXT NOT NULL,
  CONSTRAINT "PayrollFactorMethodBranch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PayrollFactorMethodBranch_methodId_seq_key" ON "PayrollFactorMethodBranch"("methodId", "seq");
ALTER TABLE "PayrollFactorMethodBranch" ADD CONSTRAINT "PayrollFactorMethodBranch_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "PayrollFactorMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "PayrollFactorMethodBranch" ("methodId", "seq", "conditionText", "formulaText")
SELECT "id", 1, NULLIF(btrim(coalesce("conditionText", '')), ''), "formulaText"
FROM "PayrollFactorMethod"
WHERE "formulaText" IS NOT NULL AND btrim("formulaText") <> '';

ALTER TABLE "PayrollFactorMethod" DROP COLUMN "conditionText", DROP COLUMN "formulaText";
