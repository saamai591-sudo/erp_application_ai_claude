-- مدیریت تردد (فاز ۱): تردد خام، درخواست اصلاح تردد، شیفت (الگوی تناوبی)
CREATE TYPE "AttendancePunchDirection" AS ENUM ('IN', 'OUT');
CREATE TYPE "AttendancePunchSource" AS ENUM ('MANUAL', 'IMPORT', 'DEVICE', 'CORRECTION');
CREATE TYPE "AttendanceCorrectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "AttendanceShiftCycle" AS ENUM ('WEEKLY', 'ROTATING');

CREATE TABLE "AttendanceCorrectionRequest" (
    "id" SERIAL NOT NULL,
    "number" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "AttendanceCorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" INTEGER,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AttendanceCorrectionRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AttendanceCorrectionRequest_number_key" ON "AttendanceCorrectionRequest"("number");
CREATE INDEX "AttendanceCorrectionRequest_employeeId_date_idx" ON "AttendanceCorrectionRequest"("employeeId", "date");
ALTER TABLE "AttendanceCorrectionRequest" ADD CONSTRAINT "AttendanceCorrectionRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AttendanceCorrectionLine" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "minute" INTEGER NOT NULL,
    "direction" "AttendancePunchDirection",
    CONSTRAINT "AttendanceCorrectionLine_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AttendanceCorrectionLine_requestId_minute_key" ON "AttendanceCorrectionLine"("requestId", "minute");
ALTER TABLE "AttendanceCorrectionLine" ADD CONSTRAINT "AttendanceCorrectionLine_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AttendanceCorrectionRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AttendancePunch" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "minute" INTEGER NOT NULL,
    "direction" "AttendancePunchDirection",
    "source" "AttendancePunchSource" NOT NULL DEFAULT 'MANUAL',
    "correctionRequestId" INTEGER,
    "description" TEXT,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AttendancePunch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AttendancePunch_employeeId_date_minute_key" ON "AttendancePunch"("employeeId", "date", "minute");
CREATE INDEX "AttendancePunch_date_idx" ON "AttendancePunch"("date");
CREATE INDEX "AttendancePunch_correctionRequestId_idx" ON "AttendancePunch"("correctionRequestId");
ALTER TABLE "AttendancePunch" ADD CONSTRAINT "AttendancePunch_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendancePunch" ADD CONSTRAINT "AttendancePunch_correctionRequestId_fkey" FOREIGN KEY ("correctionRequestId") REFERENCES "AttendanceCorrectionRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AttendanceShift" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "cycleType" "AttendanceShiftCycle" NOT NULL DEFAULT 'WEEKLY',
    "cycleLength" INTEGER NOT NULL DEFAULT 7,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AttendanceShift_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AttendanceShift_code_key" ON "AttendanceShift"("code");
CREATE UNIQUE INDEX "AttendanceShift_title_key" ON "AttendanceShift"("title");

CREATE TABLE "AttendanceShiftDay" (
    "id" SERIAL NOT NULL,
    "shiftId" INTEGER NOT NULL,
    "dayNo" INTEGER NOT NULL,
    "isWorkDay" BOOLEAN NOT NULL DEFAULT true,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "leaveMinutes" INTEGER,
    CONSTRAINT "AttendanceShiftDay_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AttendanceShiftDay_shiftId_dayNo_key" ON "AttendanceShiftDay"("shiftId", "dayNo");
ALTER TABLE "AttendanceShiftDay" ADD CONSTRAINT "AttendanceShiftDay_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "AttendanceShift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AttendanceShiftSegment" (
    "id" SERIAL NOT NULL,
    "dayId" INTEGER NOT NULL,
    "seq" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    CONSTRAINT "AttendanceShiftSegment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AttendanceShiftSegment_dayId_seq_key" ON "AttendanceShiftSegment"("dayId", "seq");
ALTER TABLE "AttendanceShiftSegment" ADD CONSTRAINT "AttendanceShiftSegment_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "AttendanceShiftDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
