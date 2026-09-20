-- DropForeignKey
ALTER TABLE "ReceiptInstrumentLine" DROP CONSTRAINT "ReceiptInstrumentLine_chequeTypeId_fkey";

-- AddForeignKey
ALTER TABLE "ReceiptInstrumentLine" ADD CONSTRAINT "ReceiptInstrumentLine_chequeTypeId_fkey" FOREIGN KEY ("chequeTypeId") REFERENCES "ReceivableChequeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
