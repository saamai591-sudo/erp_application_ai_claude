-- پیگیری پیش‌فاکتور: «بستن» مانده‌ی پیش‌فاکتورِ تأییدشده (فروش نشد/منصرف شد) با دلیل، و مقدار بسته‌شده‌ی هر ردیف.

CREATE TABLE "SalesQuoteLostReason" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesQuoteLostReason_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalesQuoteLostReason_title_key" ON "SalesQuoteLostReason"("title");

ALTER TABLE "SalesQuote"
    ADD COLUMN "followUpClosedAt" TIMESTAMP(3),
    ADD COLUMN "followUpClosedById" INTEGER,
    ADD COLUMN "followUpReasonId" INTEGER,
    ADD COLUMN "followUpNote" TEXT,
    ADD COLUMN "closedRemainingAmount" DECIMAL(36,10),
    ADD COLUMN "closedRemainingVat" DECIMAL(36,10);

ALTER TABLE "SalesQuote" ADD CONSTRAINT "SalesQuote_followUpClosedById_fkey" FOREIGN KEY ("followUpClosedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesQuote" ADD CONSTRAINT "SalesQuote_followUpReasonId_fkey" FOREIGN KEY ("followUpReasonId") REFERENCES "SalesQuoteLostReason"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SalesQuoteLine" ADD COLUMN "closedQuantity" DECIMAL(36,10) NOT NULL DEFAULT 0;
