-- مدیریت تردد: نوع استحقاق (سالانه/ماهانه) و سقف استفاده در هر درخواست / هر ماه برای نوع مرخصی
CREATE TYPE "AttendanceEntitlementKind" AS ENUM ('ANNUAL', 'MONTHLY');
ALTER TYPE "AttendanceEntitlementTiming" ADD VALUE IF NOT EXISTS 'START_OF_YEAR';

ALTER TABLE "AttendanceLeaveType" ADD COLUMN "entitlementKind" "AttendanceEntitlementKind";
ALTER TABLE "AttendanceLeaveType" ADD COLUMN "hasPerRequestLimit" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AttendanceLeaveType" ADD COLUMN "hasPerMonthLimit" BOOLEAN NOT NULL DEFAULT false;
-- نوع‌های موجودِ دارای مانده تا الان ماهانه بوده‌اند
UPDATE "AttendanceLeaveType" SET "entitlementKind" = 'MONTHLY' WHERE "deductsBalance" = true;

ALTER TABLE "AttendanceLeaveEntitlement" ADD COLUMN "perRequestLimit" DECIMAL(12,4);
ALTER TABLE "AttendanceLeaveEntitlement" ADD COLUMN "perMonthLimit" DECIMAL(12,4);
