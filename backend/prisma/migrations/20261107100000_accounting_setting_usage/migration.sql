-- قفل زنده‌ی رکوردهای «حسابداری کالا و خدمت» و «تعیین حسابهای معین»: جدول واسط سند حسابداری ↔ رکورد (به‌جای پرچم ماندگار hasTransactions)
-- با حذف سند حسابداری، ردیف‌های استفاده cascade پاک می‌شوند و قفل آزاد می‌شود.
-- توجه: پرچم‌های قبلی hasTransactions منبع نامعلوم داشتند (فقط از 1.11.0 ست می‌شدند) و حذف می‌شوند؛ قفل رکوردها از این به بعد با صدور سندهای جدید برقرار می‌شود.

CREATE TABLE "AccountingSettingUsage" (
    "id" SERIAL NOT NULL,
    "journalEntryId" INTEGER NOT NULL,
    "goodsSettingId" INTEGER,
    "treasurySettingId" INTEGER,

    CONSTRAINT "AccountingSettingUsage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AccountingSettingUsage_one_setting_chk" CHECK (("goodsSettingId" IS NOT NULL AND "treasurySettingId" IS NULL) OR ("goodsSettingId" IS NULL AND "treasurySettingId" IS NOT NULL))
);

CREATE UNIQUE INDEX "AccountingSettingUsage_journalEntryId_goodsSettingId_key" ON "AccountingSettingUsage"("journalEntryId", "goodsSettingId");
CREATE UNIQUE INDEX "AccountingSettingUsage_journalEntryId_treasurySettingId_key" ON "AccountingSettingUsage"("journalEntryId", "treasurySettingId");
CREATE INDEX "AccountingSettingUsage_goodsSettingId_idx" ON "AccountingSettingUsage"("goodsSettingId");
CREATE INDEX "AccountingSettingUsage_treasurySettingId_idx" ON "AccountingSettingUsage"("treasurySettingId");

ALTER TABLE "AccountingSettingUsage" ADD CONSTRAINT "AccountingSettingUsage_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountingSettingUsage" ADD CONSTRAINT "AccountingSettingUsage_goodsSettingId_fkey" FOREIGN KEY ("goodsSettingId") REFERENCES "GoodsServiceAccountingSetting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountingSettingUsage" ADD CONSTRAINT "AccountingSettingUsage_treasurySettingId_fkey" FOREIGN KEY ("treasurySettingId") REFERENCES "TreasuryAccountSetting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GoodsServiceAccountingSetting" DROP COLUMN "hasTransactions";
ALTER TABLE "TreasuryAccountSetting" DROP COLUMN "hasTransactions";
