-- مدیریت تردد: عوامل و فرمول (روزانه/ماهانه)؛ روش هر عامل از «ماه اجرا» (ماه تقویم کاری) و شاخه‌های شرط ← فرمول
CREATE TYPE "AttendanceFactorLevel" AS ENUM ('DAY', 'MONTH');
CREATE TYPE "AttendanceValueType" AS ENUM ('NUMBER', 'TIME', 'DAYS');

CREATE TABLE "AttendanceFactor" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "level" "AttendanceFactorLevel" NOT NULL,
    "valueType" "AttendanceValueType" NOT NULL DEFAULT 'TIME',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AttendanceFactor_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AttendanceFactor_key_key" ON "AttendanceFactor"("key");
CREATE UNIQUE INDEX "AttendanceFactor_title_key" ON "AttendanceFactor"("title");

CREATE TABLE "AttendanceFactorMethod" (
    "id" SERIAL NOT NULL,
    "factorId" INTEGER NOT NULL,
    "execCalendarMonthId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AttendanceFactorMethod_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AttendanceFactorMethod_factorId_execCalendarMonthId_key" ON "AttendanceFactorMethod"("factorId", "execCalendarMonthId");
ALTER TABLE "AttendanceFactorMethod" ADD CONSTRAINT "AttendanceFactorMethod_factorId_fkey" FOREIGN KEY ("factorId") REFERENCES "AttendanceFactor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendanceFactorMethod" ADD CONSTRAINT "AttendanceFactorMethod_execCalendarMonthId_fkey" FOREIGN KEY ("execCalendarMonthId") REFERENCES "WorkCalendarMonth"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AttendanceFactorMethodBranch" (
    "id" SERIAL NOT NULL,
    "methodId" INTEGER NOT NULL,
    "seq" INTEGER NOT NULL,
    "conditionText" TEXT,
    "formulaText" TEXT NOT NULL,
    CONSTRAINT "AttendanceFactorMethodBranch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AttendanceFactorMethodBranch_methodId_seq_key" ON "AttendanceFactorMethodBranch"("methodId", "seq");
ALTER TABLE "AttendanceFactorMethodBranch" ADD CONSTRAINT "AttendanceFactorMethodBranch_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "AttendanceFactorMethod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
