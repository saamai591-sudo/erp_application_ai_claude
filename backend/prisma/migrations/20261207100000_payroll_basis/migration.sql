-- پارامتر مبنا از نوع «مبنا» (بدون مقدار) + عضویت رکوردهای «روش محاسبه عامل» در مبناها

CREATE TYPE "PayrollParamKind" AS ENUM ('CONSTANT', 'BASIS');

CREATE TYPE "PayrollBasisSource" AS ENUM ('DECREE', 'CALC');

ALTER TABLE "PayrollParameter" ADD COLUMN     "basisSource" "PayrollBasisSource",
ADD COLUMN     "kind" "PayrollParamKind" NOT NULL DEFAULT 'CONSTANT';

CREATE TABLE "PayrollFactorMethodBasis" (
    "id" SERIAL NOT NULL,
    "methodId" INTEGER NOT NULL,
    "parameterId" INTEGER NOT NULL,

    CONSTRAINT "PayrollFactorMethodBasis_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PayrollFactorMethodBasis_parameterId_idx" ON "PayrollFactorMethodBasis"("parameterId");

CREATE UNIQUE INDEX "PayrollFactorMethodBasis_methodId_parameterId_key" ON "PayrollFactorMethodBasis"("methodId", "parameterId");

ALTER TABLE "PayrollFactorMethodBasis" ADD CONSTRAINT "PayrollFactorMethodBasis_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "PayrollFactorMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PayrollFactorMethodBasis" ADD CONSTRAINT "PayrollFactorMethodBasis_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "PayrollParameter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
