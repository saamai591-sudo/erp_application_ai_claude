-- AlterTable
ALTER TABLE "ReceiptInstrumentLine" ADD COLUMN "chequeTypeId" INTEGER;

-- AddForeignKey
ALTER TABLE "ReceiptInstrumentLine" ADD CONSTRAINT "ReceiptInstrumentLine_chequeTypeId_fkey" FOREIGN KEY ("chequeTypeId") REFERENCES "ReceivableChequeType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
