-- لایسنس نصب: شناسه‌ی نصب و فایل لایسنس ثبت‌شده
CREATE TABLE "AppLicense" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "installId" TEXT NOT NULL,
    "licenseText" TEXT,
    "activatedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppLicense_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppLicense_installId_key" ON "AppLicense"("installId");
