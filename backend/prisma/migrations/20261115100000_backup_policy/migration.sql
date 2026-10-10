-- پشتیبان‌گیری خودکار: سیاست (یک ردیف)، تاریخچه‌ی اجراها و گزارش رویدادهای مدیریتی
CREATE TYPE "BackupFrequency" AS ENUM ('INTERVAL', 'DAILY', 'WEEKLY');
CREATE TYPE "BackupTrigger" AS ENUM ('SCHEDULED', 'MANUAL');
CREATE TYPE "BackupRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

CREATE TABLE "BackupPolicy" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "frequency" "BackupFrequency" NOT NULL DEFAULT 'DAILY',
    "intervalHours" INTEGER NOT NULL DEFAULT 24,
    "timeOfDay" TEXT NOT NULL DEFAULT '02:00',
    "weekdays" INTEGER[],
    "keepRecent" INTEGER NOT NULL DEFAULT 7,
    "keepMonthly" INTEGER NOT NULL DEFAULT 0,
    "nextRunAt" TIMESTAMP(3),
    "externalDestination" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackupPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BackupRun" (
    "id" SERIAL NOT NULL,
    "trigger" "BackupTrigger" NOT NULL,
    "status" "BackupRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "fileName" TEXT,
    "sizeBytes" BIGINT,
    "appVersion" TEXT,
    "errorMessage" TEXT,
    "fileDeleted" BOOLEAN NOT NULL DEFAULT false,
    "testedAt" TIMESTAMP(3),
    "testOk" BOOLEAN,
    "testMessage" TEXT,

    CONSTRAINT "BackupRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BackupRun_startedAt_idx" ON "BackupRun"("startedAt");

CREATE TABLE "BackupAuditLog" (
    "id" SERIAL NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "ip" TEXT,

    CONSTRAINT "BackupAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BackupAuditLog_at_idx" ON "BackupAuditLog"("at");
