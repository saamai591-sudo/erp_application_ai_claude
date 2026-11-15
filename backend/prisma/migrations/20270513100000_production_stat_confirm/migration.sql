-- وضعیت آمار تولید: ثبت (پیش‌نویس) ← تایید‌شده؛ بچ هنگام تایید ساخته می‌شود
CREATE TYPE "ProductionStatStatus" AS ENUM ('DRAFT', 'CONFIRMED');

ALTER TABLE "ProductionStat"
  ADD COLUMN "status" "ProductionStatStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "confirmedAt" TIMESTAMP(3),
  ADD COLUMN "confirmedById" INTEGER;
