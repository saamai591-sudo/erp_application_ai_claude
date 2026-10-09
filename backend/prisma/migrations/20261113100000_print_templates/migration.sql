-- قالب‌های چاپ و مشخصات شرکت

-- CreateEnum
CREATE TYPE "PrintDocumentType" AS ENUM ('SALES_QUOTE');

-- CreateEnum
CREATE TYPE "PrintPaper" AS ENUM ('A4', 'A5');

-- CreateEnum
CREATE TYPE "PrintOrientation" AS ENUM ('PORTRAIT', 'LANDSCAPE');

-- CreateTable
CREATE TABLE "PrintAsset" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrintAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyProfile" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "economicCode" TEXT,
    "registrationNumber" TEXT,
    "nationalId" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "postalCode" TEXT,
    "website" TEXT,
    "logoAssetId" INTEGER,
    "stampAssetId" INTEGER,
    "bankAccounts" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrintTemplate" (
    "id" SERIAL NOT NULL,
    "documentType" "PrintDocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "paper" "PrintPaper" NOT NULL DEFAULT 'A4',
    "orientation" "PrintOrientation" NOT NULL DEFAULT 'PORTRAIT',
    "marginMm" INTEGER NOT NULL DEFAULT 8,
    "html" TEXT NOT NULL,
    "texts" JSONB NOT NULL DEFAULT '{}',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrintTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PrintTemplate_documentType_title_key" ON "PrintTemplate"("documentType", "title");

-- حداکثر یک قالب پیش‌فرض برای هر نوع سند (Prisma نمی‌تواند ایندکس یکتای جزئی را مدل کند)
CREATE UNIQUE INDEX "PrintTemplate_one_default_per_type" ON "PrintTemplate"("documentType") WHERE "isDefault";

-- AddForeignKey
ALTER TABLE "CompanyProfile" ADD CONSTRAINT "CompanyProfile_logoAssetId_fkey" FOREIGN KEY ("logoAssetId") REFERENCES "PrintAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyProfile" ADD CONSTRAINT "CompanyProfile_stampAssetId_fkey" FOREIGN KEY ("stampAssetId") REFERENCES "PrintAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
