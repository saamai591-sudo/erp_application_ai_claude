-- تنظیم تکی «سطوح تفصیل» (تعداد سطوح تفصیل قابل استفاده در تعریف حساب)؛ پیش‌فرض ۳ = رفتار فعلی
CREATE TABLE "AccountingDetailLevelSetting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "levels" INTEGER NOT NULL DEFAULT 3,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingDetailLevelSetting_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AccountingDetailLevelSetting_levels_check" CHECK ("levels" BETWEEN 0 AND 3),
    CONSTRAINT "AccountingDetailLevelSetting_single_check" CHECK ("id" = 1)
);

INSERT INTO "AccountingDetailLevelSetting" ("id", "levels") VALUES (1, 3);
