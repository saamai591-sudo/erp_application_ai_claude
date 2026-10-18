-- افراد مرتبط با طرف‌حساب (نام، سمت، موبایل، تلفن، ایمیل، توضیحات): بخش جدید فرم شخص حقیقی/حقوقی کنار نشانی/تلفن/حساب بانکی.
CREATE TABLE "PartyContact" (
    "id" SERIAL NOT NULL,
    "partyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT,
    "mobile" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "description" TEXT,

    CONSTRAINT "PartyContact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PartyContact_partyId_idx" ON "PartyContact"("partyId");

ALTER TABLE "PartyContact" ADD CONSTRAINT "PartyContact_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;
