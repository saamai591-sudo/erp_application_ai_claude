-- زیرساخت «کارهای زمان‌بندی‌شده» (تنظیمات › عملیات): تنظیمات هر کار + تاریخچه‌ی اجراها (افزایشی؛ داده‌ی موجود دست‌نخورده)
CREATE TYPE "ScheduledJobMode" AS ENUM ('OFF', 'DRY_RUN', 'LIVE');
CREATE TYPE "ScheduledJobScheduleType" AS ENUM ('INTERVAL', 'DAILY', 'WEEKLY');
CREATE TYPE "ScheduledJobRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');
CREATE TYPE "ScheduledJobTrigger" AS ENUM ('SCHEDULE', 'MANUAL');

CREATE TABLE "ScheduledJob" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "mode" "ScheduledJobMode" NOT NULL DEFAULT 'OFF',
    "scheduleType" "ScheduledJobScheduleType" NOT NULL DEFAULT 'WEEKLY',
    "intervalMinutes" INTEGER,
    "timeOfDay" TEXT,
    "weekdays" INTEGER[],
    "params" JSONB NOT NULL DEFAULT '{}',
    "runAsUserId" INTEGER,
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "lastRunStatus" "ScheduledJobRunStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScheduledJobRun" (
    "id" SERIAL NOT NULL,
    "jobId" INTEGER NOT NULL,
    "trigger" "ScheduledJobTrigger" NOT NULL,
    "dryRun" BOOLEAN NOT NULL,
    "status" "ScheduledJobRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "startedById" INTEGER,
    "runAsUserId" INTEGER,
    "params" JSONB NOT NULL DEFAULT '{}',
    "summary" TEXT,
    "counts" JSONB,
    "items" JSONB,
    "error" TEXT,

    CONSTRAINT "ScheduledJobRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScheduledJob_key_key" ON "ScheduledJob"("key");
CREATE INDEX "ScheduledJobRun_jobId_startedAt_idx" ON "ScheduledJobRun"("jobId", "startedAt");

-- از هر کار حداکثر یک اجرای «در حال اجرا»: قفل اتمیِ جلوگیری از اجرای هم‌زمان (دستی + زمان‌بندی، یا دو نمونه‌ی سرور)
CREATE UNIQUE INDEX "ScheduledJobRun_one_running_per_job" ON "ScheduledJobRun"("jobId") WHERE "status" = 'RUNNING';

ALTER TABLE "ScheduledJob" ADD CONSTRAINT "ScheduledJob_runAsUserId_fkey" FOREIGN KEY ("runAsUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScheduledJobRun" ADD CONSTRAINT "ScheduledJobRun_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ScheduledJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
