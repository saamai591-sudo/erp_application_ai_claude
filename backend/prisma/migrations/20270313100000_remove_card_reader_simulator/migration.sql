-- حذف نوع اتصال «شبیه‌ساز»: کارتخوان‌ها و تراکنش‌های آزمایشیِ قدیمی «دستی» می‌شوند و مقدار از enum برداشته می‌شود
UPDATE "CardReader" SET "driver" = 'MANUAL' WHERE "driver" = 'SIMULATOR';
UPDATE "CardReaderTransaction" SET "driver" = 'MANUAL' WHERE "driver" = 'SIMULATOR';

ALTER TYPE "CardReaderDriver" RENAME TO "CardReaderDriver_old";
CREATE TYPE "CardReaderDriver" AS ENUM ('MANUAL', 'SADAD', 'PARSIAN');

ALTER TABLE "CardReader" ALTER COLUMN "driver" DROP DEFAULT;
ALTER TABLE "CardReader" ALTER COLUMN "driver" TYPE "CardReaderDriver" USING ("driver"::text::"CardReaderDriver");
ALTER TABLE "CardReader" ALTER COLUMN "driver" SET DEFAULT 'MANUAL';
ALTER TABLE "CardReaderTransaction" ALTER COLUMN "driver" TYPE "CardReaderDriver" USING ("driver"::text::"CardReaderDriver");

DROP TYPE "CardReaderDriver_old";
