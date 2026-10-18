-- مبنای با منبع «حکم»: مشخص می‌شود مقدار هر عامل حکمِ عضو «آخرین مقدار حکم» است یا «میانگین حکم».
-- مبناهای حکمیِ موجود تا امروز آخرین مقدار را جمع می‌کردند؛ برای حفظ نتیجه‌ی محاسبه‌ها همان تعیین می‌شود.
CREATE TYPE "PayrollDecreeValueMode" AS ENUM ('LAST', 'AVG');
ALTER TABLE "PayrollParameter" ADD COLUMN "decreeValueMode" "PayrollDecreeValueMode";
UPDATE "PayrollParameter" SET "decreeValueMode" = 'LAST' WHERE "kind" = 'BASIS' AND "basisSource" = 'DECREE';
