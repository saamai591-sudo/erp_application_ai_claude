-- ساختار فایل: «مربوط به» (بانک یا سازمان ذینفع) + کلید ساختار پیش‌فرض نصب (ساختارهای نصب حالا ردیف دیتابیس و قابل ویرایش‌اند)

ALTER TABLE "FileStructure"
  ADD COLUMN "systemKey" TEXT,
  ADD COLUMN "userEdited" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "bankPartyId" INTEGER,
  ADD COLUMN "beneficiaryOrgId" INTEGER;

CREATE UNIQUE INDEX "FileStructure_systemKey_key" ON "FileStructure"("systemKey");

ALTER TABLE "FileStructure" ADD CONSTRAINT "FileStructure_bankPartyId_fkey" FOREIGN KEY ("bankPartyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FileStructure" ADD CONSTRAINT "FileStructure_beneficiaryOrgId_fkey" FOREIGN KEY ("beneficiaryOrgId") REFERENCES "BeneficiaryOrg"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FileStructure" ADD CONSTRAINT "FileStructure_one_owner_check" CHECK (NOT ("bankPartyId" IS NOT NULL AND "beneficiaryOrgId" IS NOT NULL));
