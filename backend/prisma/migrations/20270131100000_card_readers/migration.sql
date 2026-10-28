-- کارتخوان (مدیریت خزانه › تنظیمات)
CREATE TABLE "CardReader" (
    "id" SERIAL NOT NULL,
    "code" INTEGER NOT NULL,
    "terminalNumber" TEXT NOT NULL,
    "merchantNumber" TEXT NOT NULL,
    "bankAccountId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardReader_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CardReader_code_key" ON "CardReader"("code");
CREATE UNIQUE INDEX "CardReader_title_key" ON "CardReader"("title");
CREATE UNIQUE INDEX "CardReader_terminalNumber_merchantNumber_key" ON "CardReader"("terminalNumber", "merchantNumber");

ALTER TABLE "CardReader" ADD CONSTRAINT "CardReader_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
