-- چاپ توسط برنامه‌ی صندوق (کلاینت): کار چاپ دیگر به عامل محلی وابسته نیست
ALTER TABLE "PrintJob" ALTER COLUMN "agentId" DROP NOT NULL;
UPDATE "SalesStation" SET "printAgentId" = NULL WHERE "printAgentId" IS NOT NULL;
