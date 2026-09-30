-- مانده‌ی اول دوره‌ی تنخواه‌ها در «عملیات اول دوره» (هم‌الگوی TreasuryOpeningBankAccount)
CREATE TABLE "TreasuryOpeningPettyCash" (
    "id" SERIAL NOT NULL,
    "openingId" INTEGER NOT NULL,
    "rowOrder" INTEGER NOT NULL DEFAULT 0,
    "pettyCashId" INTEGER NOT NULL,
    "currencyId" INTEGER NOT NULL,
    "balance" DECIMAL(18,2) NOT NULL,
    "baseBalance" DECIMAL(18,2) NOT NULL,
    "isSystemGenerated" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "TreasuryOpeningPettyCash_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TreasuryOpeningPettyCash_openingId_pettyCashId_key" ON "TreasuryOpeningPettyCash"("openingId", "pettyCashId");
ALTER TABLE "TreasuryOpeningPettyCash" ADD CONSTRAINT "TreasuryOpeningPettyCash_openingId_fkey" FOREIGN KEY ("openingId") REFERENCES "TreasuryOpening"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TreasuryOpeningPettyCash" ADD CONSTRAINT "TreasuryOpeningPettyCash_pettyCashId_fkey" FOREIGN KEY ("pettyCashId") REFERENCES "PettyCash"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TreasuryOpeningPettyCash" ADD CONSTRAINT "TreasuryOpeningPettyCash_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
