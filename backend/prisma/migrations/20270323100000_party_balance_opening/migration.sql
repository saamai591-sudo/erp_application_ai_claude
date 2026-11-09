-- مانده اول دوره مشتریان و تامین‌کنندگان + بستن سال مانده طرف‌حساب‌ها

-- CreateEnum
CREATE TYPE "PartyBalanceRole" AS ENUM ('CUSTOMER', 'SUPPLIER');

-- CreateTable
CREATE TABLE "PartyBalanceOpening" (
    "id" SERIAL NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartyBalanceOpening_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyBalanceOpeningLine" (
    "id" SERIAL NOT NULL,
    "openingId" INTEGER NOT NULL,
    "role" "PartyBalanceRole" NOT NULL,
    "partyId" INTEGER NOT NULL,
    "currencyId" INTEGER NOT NULL,
    "balance" DECIMAL(30,4) NOT NULL,
    "isSystemGenerated" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,

    CONSTRAINT "PartyBalanceOpeningLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartyBalanceYearClose" (
    "id" SERIAL NOT NULL,
    "fiscalPeriodId" INTEGER NOT NULL,
    "role" "PartyBalanceRole" NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartyBalanceYearClose_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartyBalanceOpening_fiscalPeriodId_key" ON "PartyBalanceOpening"("fiscalPeriodId");

-- CreateIndex
CREATE INDEX "PartyBalanceOpeningLine_partyId_idx" ON "PartyBalanceOpeningLine"("partyId");

-- CreateIndex
CREATE UNIQUE INDEX "PartyBalanceOpeningLine_openingId_role_partyId_currencyId_key" ON "PartyBalanceOpeningLine"("openingId", "role", "partyId", "currencyId");

-- CreateIndex
CREATE UNIQUE INDEX "PartyBalanceYearClose_fiscalPeriodId_role_key" ON "PartyBalanceYearClose"("fiscalPeriodId", "role");

-- AddForeignKey
ALTER TABLE "PartyBalanceOpening" ADD CONSTRAINT "PartyBalanceOpening_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyBalanceOpeningLine" ADD CONSTRAINT "PartyBalanceOpeningLine_openingId_fkey" FOREIGN KEY ("openingId") REFERENCES "PartyBalanceOpening"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyBalanceOpeningLine" ADD CONSTRAINT "PartyBalanceOpeningLine_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyBalanceOpeningLine" ADD CONSTRAINT "PartyBalanceOpeningLine_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartyBalanceYearClose" ADD CONSTRAINT "PartyBalanceYearClose_fiscalPeriodId_fkey" FOREIGN KEY ("fiscalPeriodId") REFERENCES "FiscalPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
