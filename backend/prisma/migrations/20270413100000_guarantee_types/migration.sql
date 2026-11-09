-- «نوع تضمین» (مدیریت خزانه › تنظیمات): نوع (دریافت/پرداخت)، کد خودکار، عنوان یکتا
CREATE TYPE "GuaranteeDirection" AS ENUM ('RECEIPT', 'PAYMENT');
CREATE TABLE "GuaranteeType" (
  "id" SERIAL NOT NULL,
  "code" INTEGER NOT NULL,
  "direction" "GuaranteeDirection" NOT NULL,
  "title" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuaranteeType_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GuaranteeType_code_key" ON "GuaranteeType"("code");
CREATE UNIQUE INDEX "GuaranteeType_title_key" ON "GuaranteeType"("title");
