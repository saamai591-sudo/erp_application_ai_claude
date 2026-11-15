-- «برای تولید» روی ردیف زمان‌بندی: زمان (دقیقه) برای یک مقدار پایه؛ زمان هر واحد = minutes ÷ forQuantity
ALTER TABLE "ProductionTimeLine" RENAME COLUMN "minutesPerUnit" TO "minutes";
ALTER TABLE "ProductionTimeLine" ADD COLUMN "forQuantity" DECIMAL(36,10) NOT NULL DEFAULT 1;
ALTER TABLE "ProductionTimeLine" ADD CONSTRAINT "ProductionTimeLine_forQuantity_check" CHECK ("forQuantity" > 0);
ALTER TABLE "ProductionTimeLine" RENAME CONSTRAINT "ProductionTimeLine_nonneg_check" TO "ProductionTimeLine_minutes_check";
