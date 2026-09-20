-- CreateTable
CREATE TABLE "ReceivableChequeType" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceivableChequeType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayableChequeType" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "isSameDay" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayableChequeType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReceivableChequeType_code_key" ON "ReceivableChequeType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ReceivableChequeType_title_key" ON "ReceivableChequeType"("title");

-- CreateIndex
CREATE UNIQUE INDEX "PayableChequeType_code_key" ON "PayableChequeType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PayableChequeType_title_key" ON "PayableChequeType"("title");
