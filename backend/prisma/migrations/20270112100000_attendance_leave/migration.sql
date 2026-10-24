-- مدیریت تردد: نوع مرخصی، درخواست مرخصی (روزانه/ساعتی) و پیوست‌ها
CREATE TYPE "AttendanceLeaveUnit" AS ENUM ('DAY', 'HOUR', 'BOTH');

CREATE TABLE "AttendanceLeaveType" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "unit" "AttendanceLeaveUnit" NOT NULL DEFAULT 'BOTH',
    "deductsBalance" BOOLEAN NOT NULL DEFAULT false,
    "requiresAttachment" BOOLEAN NOT NULL DEFAULT false,
    "countHolidays" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AttendanceLeaveType_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AttendanceLeaveType_key_key" ON "AttendanceLeaveType"("key");
CREATE UNIQUE INDEX "AttendanceLeaveType_title_key" ON "AttendanceLeaveType"("title");

CREATE TABLE "AttendanceLeaveRequest" (
    "id" SERIAL NOT NULL,
    "number" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "leaveTypeId" INTEGER NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "startMinute" INTEGER,
    "endMinute" INTEGER,
    "reason" TEXT NOT NULL,
    "status" "AttendanceCorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" INTEGER,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AttendanceLeaveRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AttendanceLeaveRequest_number_key" ON "AttendanceLeaveRequest"("number");
CREATE INDEX "AttendanceLeaveRequest_employeeId_fromDate_toDate_idx" ON "AttendanceLeaveRequest"("employeeId", "fromDate", "toDate");
ALTER TABLE "AttendanceLeaveRequest" ADD CONSTRAINT "AttendanceLeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceLeaveRequest" ADD CONSTRAINT "AttendanceLeaveRequest_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "AttendanceLeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AttendanceLeaveAttachment" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "uploadedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttendanceLeaveAttachment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AttendanceLeaveAttachment_requestId_idx" ON "AttendanceLeaveAttachment"("requestId");
ALTER TABLE "AttendanceLeaveAttachment" ADD CONSTRAINT "AttendanceLeaveAttachment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AttendanceLeaveRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
