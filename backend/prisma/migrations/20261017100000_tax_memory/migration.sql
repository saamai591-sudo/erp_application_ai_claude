-- «حافظه مالیاتی» (امور مالیاتی › تنظیمات): اطلاعات شرکت + جفت‌کلید RSA (کلید خصوصی فقط رمزشده)، کلید عمومی و CSR
CREATE TABLE "TaxMemory" (
    "id" SERIAL NOT NULL,
    "persianCompanyName" TEXT NOT NULL,
    "englishCompanyName" TEXT NOT NULL,
    "nationalId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL DEFAULT 'IR',
    "email" TEXT NOT NULL,
    "taxMemoryUniqueId" TEXT,
    "publicKeyPem" TEXT NOT NULL,
    "csrPem" TEXT NOT NULL,
    "privateKeyEncrypted" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TaxMemory_pkey" PRIMARY KEY ("id")
);
