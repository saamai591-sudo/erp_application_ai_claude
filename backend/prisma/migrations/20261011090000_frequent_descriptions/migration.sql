-- CreateTable
CREATE TABLE "FrequentDescription" (
    "id" SERIAL NOT NULL,
    "formKey" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL DEFAULT 'description',
    "text" TEXT NOT NULL,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FrequentDescription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FrequentDescription_formKey_fieldKey_idx" ON "FrequentDescription"("formKey", "fieldKey");

-- CreateIndex
CREATE UNIQUE INDEX "FrequentDescription_formKey_fieldKey_text_key" ON "FrequentDescription"("formKey", "fieldKey", "text");

