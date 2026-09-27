-- CreateTable
CREATE TABLE "PettyCashCustodian" (
    "id" SERIAL NOT NULL,
    "detailCode" TEXT NOT NULL,
    "pettyCashId" INTEGER NOT NULL,
    "partyId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "controlNegativeBalance" BOOLEAN NOT NULL DEFAULT true,
    "hasTransactions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PettyCashCustodian_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PettyCashCustodian_detailCode_key" ON "PettyCashCustodian"("detailCode");

-- CreateIndex
CREATE UNIQUE INDEX "PettyCashCustodian_pettyCashId_partyId_key" ON "PettyCashCustodian"("pettyCashId", "partyId");

-- AddForeignKey
ALTER TABLE "PettyCashCustodian" ADD CONSTRAINT "PettyCashCustodian_pettyCashId_fkey" FOREIGN KEY ("pettyCashId") REFERENCES "PettyCash"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashCustodian" ADD CONSTRAINT "PettyCashCustodian_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
