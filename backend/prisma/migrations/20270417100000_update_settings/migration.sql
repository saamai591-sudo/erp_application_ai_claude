-- تنظیم اتصال به ریجستری نسخه‌ها (به‌روزرسانی از داخل برنامه)
CREATE TABLE "UpdateSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "registryHost" TEXT,
    "registryUser" TEXT,
    "registryPasswordEnc" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UpdateSettings_pkey" PRIMARY KEY ("id")
);
