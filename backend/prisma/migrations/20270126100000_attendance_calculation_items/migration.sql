-- مدیریت تردد: ردیف‌های ذخیره‌ی نتیجه‌ی هر عامل در «محاسبات تردد» (مثل ردیف‌های فیش حقوق)
CREATE TABLE "AttendanceCalculationItem" (
    "id" SERIAL NOT NULL,
    "calculationId" INTEGER NOT NULL,
    "factorId" INTEGER,
    "payrollComponentId" INTEGER,
    "level" "AttendanceFactorLevel" NOT NULL,
    "valueType" "AttendanceValueType" NOT NULL,
    "value" DECIMAL(20,4),
    "error" TEXT,
    "branch" INTEGER,
    "expression" TEXT,
    "methodId" INTEGER,
    "days" JSONB,
    CONSTRAINT "AttendanceCalculationItem_pkey" PRIMARY KEY ("id"),
    -- دقیقاً یکی از «عامل تردد» یا «عامل حقوقی»
    CONSTRAINT "AttendanceCalculationItem_factor_xor_component" CHECK (("factorId" IS NOT NULL) <> ("payrollComponentId" IS NOT NULL))
);
CREATE UNIQUE INDEX "AttendanceCalculationItem_calculationId_factorId_key" ON "AttendanceCalculationItem"("calculationId", "factorId");
CREATE UNIQUE INDEX "AttendanceCalculationItem_calculationId_payrollComponentId_key" ON "AttendanceCalculationItem"("calculationId", "payrollComponentId");
CREATE INDEX "AttendanceCalculationItem_factorId_idx" ON "AttendanceCalculationItem"("factorId");
CREATE INDEX "AttendanceCalculationItem_methodId_idx" ON "AttendanceCalculationItem"("methodId");
ALTER TABLE "AttendanceCalculationItem" ADD CONSTRAINT "AttendanceCalculationItem_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "AttendanceCalculation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceCalculationItem" ADD CONSTRAINT "AttendanceCalculationItem_factorId_fkey" FOREIGN KEY ("factorId") REFERENCES "AttendanceFactor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceCalculationItem" ADD CONSTRAINT "AttendanceCalculationItem_payrollComponentId_fkey" FOREIGN KEY ("payrollComponentId") REFERENCES "PayrollComponent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceCalculationItem" ADD CONSTRAINT "AttendanceCalculationItem_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "AttendanceFactorMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
