-- CreateTable
CREATE TABLE "PettyCash" (
    "id" SERIAL NOT NULL,
    "detailCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "currencyId" INTEGER NOT NULL,
    "limitAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hasTransactions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PettyCash_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PettyCash_detailCode_key" ON "PettyCash"("detailCode");

-- CreateIndex
CREATE UNIQUE INDEX "PettyCash_title_key" ON "PettyCash"("title");

-- AddForeignKey
ALTER TABLE "PettyCash" ADD CONSTRAINT "PettyCash_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
