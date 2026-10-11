-- لینک اشتراک‌گذاری اسناد چاپی (عکس‌فوری HTML با انقضا)
CREATE TABLE "PrintShareLink" (
    "id" SERIAL NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "documentType" "PrintDocumentType" NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentGz" BYTEA,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstViewedAt" TIMESTAMP(3),
    "lastViewedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PrintShareLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrintShareLink_tokenHash_key" ON "PrintShareLink"("tokenHash");
CREATE INDEX "PrintShareLink_documentType_sourceId_idx" ON "PrintShareLink"("documentType", "sourceId");
CREATE INDEX "PrintShareLink_expiresAt_idx" ON "PrintShareLink"("expiresAt");
