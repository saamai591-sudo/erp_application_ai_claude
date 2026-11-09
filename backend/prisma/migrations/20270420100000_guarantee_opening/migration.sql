-- ضمانت‌نامه‌های افتتاحیه (استقرار): سند تضمین علامت‌دار با openingId
ALTER TABLE "GuaranteeDocument" ADD COLUMN "openingId" INTEGER;
CREATE INDEX "GuaranteeDocument_openingId_idx" ON "GuaranteeDocument"("openingId");
ALTER TABLE "GuaranteeDocument" ADD CONSTRAINT "GuaranteeDocument_openingId_fkey" FOREIGN KEY ("openingId") REFERENCES "TreasuryOpening"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
