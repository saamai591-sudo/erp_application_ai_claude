-- مدیریت تردد: دریافت خودکار تردد از سیستم‌های کارت‌ساعت (اتصال + نگاشت شناسه + صندوق دریافت)

-- CreateEnum
CREATE TYPE "AttendanceInboxStatus" AS ENUM ('ACCEPTED', 'PENDING_MAPPING', 'REJECTED');

-- CreateTable
CREATE TABLE "AttendanceDeviceConnection" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "tokenHash" TEXT NOT NULL,
    "tokenHint" TEXT NOT NULL,
    "lastReceivedAt" TIMESTAMP(3),
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceDeviceConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceDeviceMapping" (
    "id" SERIAL NOT NULL,
    "connectionId" INTEGER NOT NULL,
    "deviceUserId" TEXT NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceDeviceMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceDeviceInbox" (
    "id" SERIAL NOT NULL,
    "connectionId" INTEGER NOT NULL,
    "deviceUserId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "minute" INTEGER NOT NULL,
    "deviceName" TEXT,
    "status" "AttendanceInboxStatus" NOT NULL DEFAULT 'PENDING_MAPPING',
    "reason" TEXT,
    "employeeId" INTEGER,
    "punchId" INTEGER,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "AttendanceDeviceInbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceDeviceConnection_name_key" ON "AttendanceDeviceConnection"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceDeviceConnection_tokenHash_key" ON "AttendanceDeviceConnection"("tokenHash");

-- CreateIndex
CREATE INDEX "AttendanceDeviceMapping_employeeId_idx" ON "AttendanceDeviceMapping"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceDeviceMapping_connectionId_deviceUserId_key" ON "AttendanceDeviceMapping"("connectionId", "deviceUserId");

-- CreateIndex
CREATE INDEX "AttendanceDeviceInbox_connectionId_status_idx" ON "AttendanceDeviceInbox"("connectionId", "status");

-- CreateIndex
CREATE INDEX "AttendanceDeviceInbox_status_date_idx" ON "AttendanceDeviceInbox"("status", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceDeviceInbox_connectionId_deviceUserId_date_minute_key" ON "AttendanceDeviceInbox"("connectionId", "deviceUserId", "date", "minute");

-- AddForeignKey
ALTER TABLE "AttendanceDeviceMapping" ADD CONSTRAINT "AttendanceDeviceMapping_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "AttendanceDeviceConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceDeviceMapping" ADD CONSTRAINT "AttendanceDeviceMapping_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceDeviceInbox" ADD CONSTRAINT "AttendanceDeviceInbox_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "AttendanceDeviceConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceDeviceInbox" ADD CONSTRAINT "AttendanceDeviceInbox_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceDeviceInbox" ADD CONSTRAINT "AttendanceDeviceInbox_punchId_fkey" FOREIGN KEY ("punchId") REFERENCES "AttendancePunch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

