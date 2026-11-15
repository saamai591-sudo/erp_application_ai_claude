-- فرمول ساخت الزامی روی ردیف آمار تولید و ردیف دارای درصد پای کار
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "ProductionStatLine") OR EXISTS (SELECT 1 FROM "WipCountLine" WHERE "completionPercent" IS NOT NULL) THEN
    RAISE EXCEPTION 'ردیف آمار تولید یا ردیف پای کار دارای درصد وجود دارد؛ برای انتخاب فرمول ساخت آن‌ها را پاک کنید و دوباره مهاجرت را اجرا کنید';
  END IF;
END $$;
ALTER TABLE "ProductionStatLine" ADD COLUMN "bomId" INTEGER NOT NULL;
CREATE INDEX "ProductionStatLine_bomId_idx" ON "ProductionStatLine"("bomId");
ALTER TABLE "ProductionStatLine" ADD CONSTRAINT "ProductionStatLine_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "Bom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- ردیف پای کار: فرمول ساخت دقیقاً وقتی لازم است که درصد پیشرفت دارد (ماده‌ی در جریان فرمول ندارد)
ALTER TABLE "WipCountLine" ADD CONSTRAINT "WipCountLine_bom_with_percent_check" CHECK (("completionPercent" IS NULL AND "bomId" IS NULL) OR ("completionPercent" IS NOT NULL AND "bomId" IS NOT NULL));
