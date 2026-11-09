import { prisma } from "../lib/prisma";

// «صندوق فعلیِ چک دریافتی» (فرم «انتقال به صندوق»): چک دریافتی در دست، نزد صندوقی است که آخرین اتفاقِ «تعیین‌کننده‌ی صندوق» در چرخه‌ی عمرش
// آن را مشخص کرده — صندوقِ ردیف ابزار رسید دریافت (ReceiptInstrumentLine.cashBoxId) یا صندوق مقصد یک «انتقال به صندوق».
// ChequeItem ستون صندوق ندارد (حقیقتِ واحد = همین رویدادها)؛ ترتیب با chequeStep است (هم‌الگوی latestChequeBaseEvents).
// چک افتتاحیه (بدون رسید دریافت) صندوقی ندارد و در این فرم قابل انتخاب نیست.

export interface ChequeHolder {
  cashBoxId: number;
  step: number;
}

/** excludeTransferId = انتقالی که در حال ویرایش است (ردیف‌های خودش صندوق‌دهنده حساب نمی‌شوند) */
export async function chequeHolders(chequeIds: number[], excludeTransferId?: number, db: any = prisma): Promise<Map<number, ChequeHolder>> {
  const result = new Map<number, ChequeHolder>();
  if (chequeIds.length === 0) return result;
  const cheques: { id: number; step: number }[] = await db.chequeItem.findMany({ where: { id: { in: chequeIds } }, select: { id: true, step: true } });
  const stepOf = new Map(cheques.map((c) => [c.id, c.step]));
  const consider = (chequeItemId: number, chequeStep: number | null, cashBoxId: number | null) => {
    if (chequeStep == null || cashBoxId == null) return;
    const cur = stepOf.get(chequeItemId);
    if (cur === undefined || chequeStep > cur) return;
    const prev = result.get(chequeItemId);
    if (!prev || chequeStep > prev.step) result.set(chequeItemId, { cashBoxId, step: chequeStep });
  };
  const where = { chequeItemId: { in: chequeIds }, chequeStep: { not: null } };
  const [receipts, transfers] = await Promise.all([
    db.receiptInstrumentLine.findMany({ where, select: { chequeItemId: true, chequeStep: true, cashBoxId: true, receipt: { select: { status: true } } } }),
    db.cashBoxTransferLine.findMany({ where, select: { chequeItemId: true, chequeStep: true, transfer: { select: { id: true, toCashBoxId: true } } } }),
  ]);
  for (const l of receipts) if (l.receipt?.status === "APPROVED") consider(l.chequeItemId, l.chequeStep, l.cashBoxId);
  for (const l of transfers) if (l.transfer.id !== excludeTransferId) consider(l.chequeItemId, l.chequeStep, l.transfer.toCashBoxId);
  return result;
}
