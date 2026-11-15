-- مبنای زمانی سیستمی «زمان ساخت» (برای دیتابیس‌هایی که سید اجرا نمی‌شود هم ساخته شود)
ALTER TABLE "CostTimeDriver" ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false;

INSERT INTO "CostTimeDriver" ("code", "title", "isSystem", "updatedAt")
SELECT COALESCE(MAX("code"), 0) + 1, 'زمان ساخت', true, CURRENT_TIMESTAMP FROM "CostTimeDriver"
ON CONFLICT ("title") DO UPDATE SET "isSystem" = true;
