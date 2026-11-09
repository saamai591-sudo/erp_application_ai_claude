-- قالب پیش‌فاکتور در دستور میانبر دستیار: شرح، تخفیف درصدی و اقلام ثابت
ALTER TABLE "AssistantMacro" ADD COLUMN "description" TEXT;
ALTER TABLE "AssistantMacro" ADD COLUMN "discountPercent" DECIMAL(5,2);
ALTER TABLE "AssistantMacro" ADD COLUMN "presetLines" JSONB;
