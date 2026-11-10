-- «لاگ تغییرات» (Audit). تنظیمات در جدول عادی AuditSetting (داخل پشتیبان)، خودِ رویدادها در schema جدای «audit» که از pg_dump اصلی کنار گذاشته می‌شود.
-- جدول رویداد partition ماهانه است (پاک‌سازی = DROP PARTITION)؛ Prisma آن را نمی‌شناسد و فقط با SQL خام خوانده/نوشته می‌شود.
-- همین DDL (idempotent) در services/auditService.ts#ensureAuditSchema هم هست تا بعد از بازگردانی پشتیبان (که schema را ندارد) در بوت دوباره ساخته شود.

CREATE TYPE "AuditLevel" AS ENUM ('BASIC', 'FULL');

CREATE TABLE "AuditSetting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "level" "AuditLevel" NOT NULL DEFAULT 'BASIC',
    "retentionDays" INTEGER NOT NULL DEFAULT 365,
    "lastMaintenanceAt" TIMESTAMP(3),
    "lastMaintenanceMessage" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AuditSetting_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AuditSetting_singleton" CHECK ("id" = 1)
);

CREATE SCHEMA IF NOT EXISTS audit;
CREATE SEQUENCE IF NOT EXISTS audit.event_id_seq;
CREATE TABLE IF NOT EXISTS audit.event (
    id BIGINT NOT NULL DEFAULT nextval('audit.event_id_seq'),
    at TIMESTAMPTZ NOT NULL DEFAULT now(),
    "userId" INTEGER,
    "userName" TEXT,
    kind TEXT NOT NULL,
    action TEXT NOT NULL,
    model TEXT,
    "recordId" TEXT,
    summary TEXT,
    changes JSONB,
    ip TEXT,
    PRIMARY KEY (id, at)
) PARTITION BY RANGE (at);
CREATE TABLE IF NOT EXISTS audit.event_default PARTITION OF audit.event DEFAULT;
CREATE INDEX IF NOT EXISTS event_record_idx ON audit.event (model, "recordId", at);
CREATE INDEX IF NOT EXISTS event_at_idx ON audit.event (at);
CREATE INDEX IF NOT EXISTS event_user_idx ON audit.event ("userId", at);
