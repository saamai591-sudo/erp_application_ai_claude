-- باشگاه مشتریان › کارت وفاداری: نوع شارژ، کارت، شارژ + روش دریافت «کارت وفاداری» در فروش فروشگاهی.
ALTER TYPE "TreasuryAccountType" ADD VALUE IF NOT EXISTS 'LOYALTY_DISCOUNT_EXPENSE';

CREATE TYPE "LoyaltyChargeKind" AS ENUM ('AMOUNT', 'PERCENT');

CREATE TABLE "LoyaltyChargeType" (
  "id" SERIAL PRIMARY KEY,
  "code" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "kind" "LoyaltyChargeKind" NOT NULL,
  "value" DECIMAL(36,10) NOT NULL,
  "singleUse" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LoyaltyChargeType_value_positive" CHECK ("value" > 0),
  CONSTRAINT "LoyaltyChargeType_percent_max" CHECK ("kind" <> 'PERCENT' OR "value" <= 100)
);
CREATE UNIQUE INDEX "LoyaltyChargeType_code_key" ON "LoyaltyChargeType"("code");
CREATE UNIQUE INDEX "LoyaltyChargeType_title_key" ON "LoyaltyChargeType"("title");

CREATE TABLE "LoyaltyCard" (
  "id" SERIAL PRIMARY KEY,
  "partyId" INTEGER NOT NULL,
  "cardNumber" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "issueDate" DATE NOT NULL,
  "expiryDate" DATE,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "LoyaltyCard_cardNumber_key" ON "LoyaltyCard"("cardNumber");
CREATE INDEX "LoyaltyCard_partyId_idx" ON "LoyaltyCard"("partyId");
ALTER TABLE "LoyaltyCard" ADD CONSTRAINT "LoyaltyCard_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "LoyaltyCharge" (
  "id" SERIAL PRIMARY KEY,
  "number" INTEGER NOT NULL,
  "cardId" INTEGER NOT NULL,
  "typeId" INTEGER NOT NULL,
  "kind" "LoyaltyChargeKind" NOT NULL,
  "value" DECIMAL(36,10) NOT NULL,
  "singleUse" BOOLEAN NOT NULL,
  "date" DATE NOT NULL,
  "expiryDate" DATE,
  "description" TEXT,
  "createdById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "LoyaltyCharge_number_key" ON "LoyaltyCharge"("number");
CREATE INDEX "LoyaltyCharge_cardId_idx" ON "LoyaltyCharge"("cardId");
CREATE INDEX "LoyaltyCharge_typeId_idx" ON "LoyaltyCharge"("typeId");
ALTER TABLE "LoyaltyCharge" ADD CONSTRAINT "LoyaltyCharge_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "LoyaltyCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LoyaltyCharge" ADD CONSTRAINT "LoyaltyCharge_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "LoyaltyChargeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- روش دریافت «کارت وفاداری»؛ برخلاف بن، یک شارژ می‌تواند چند دریافت داشته باشد (شارژ مبلغیِ مانده‌دار، شارژ درصدیِ چندبارمصرف) پس یکتا نیست
ALTER TABLE "StoreReceipt" ADD COLUMN "loyaltyChargeId" INTEGER;
CREATE INDEX "StoreReceipt_loyaltyChargeId_idx" ON "StoreReceipt"("loyaltyChargeId");
ALTER TABLE "StoreReceipt" ADD CONSTRAINT "StoreReceipt_loyaltyChargeId_fkey" FOREIGN KEY ("loyaltyChargeId") REFERENCES "LoyaltyCharge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreReceipt" DROP CONSTRAINT "StoreReceipt_method_check";
ALTER TABLE "StoreReceipt" ADD CONSTRAINT "StoreReceipt_method_check" CHECK (("cashBoxId" IS NOT NULL)::int + ("cardReaderId" IS NOT NULL)::int + ("bankAccountId" IS NOT NULL)::int + ("voucherId" IS NOT NULL)::int + ("loyaltyChargeId" IS NOT NULL)::int = 1);
