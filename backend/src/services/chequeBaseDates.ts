import { prisma } from "../lib/prisma";

// «تاریخ سند مبنا» برای فرم‌های چک دریافتی (واگذاری به بانک، برگشت از واگذاری، وصول و برگشت چک):
// سند مبنای یک چک = «آخرین اتفاقِ تاییدشده‌ی چرخه‌ی عمر چک» — سندی که چک را به وضعیت فعلی رسانده (رسید دریافت، واگذاری به بانک،
// برگشت از واگذاری، …). قاعده: تاریخ سند فرم باید بزرگ‌تر یا مساوی تاریخ سند مبنای هر چک انتخابی باشد (چکی که هنوز در تاریخ سند فرم وجود
// نداشته نمی‌تواند در آن انتخاب شود). تنها محل این منطق — هم انتخابگر (فیلتر) و هم اعتبارسنجی ثبت/ویرایش در بک‌اند از همین‌جا می‌آیند.
//
// آخرین اتفاق: ردیف‌های سندهای تاییدشده‌ای که chequeStep دارند و chequeStep ≤ step فعلی چک است، با بیشترین chequeStep (هم‌الگوی توضیح
// ChequeItem.step در schema). چک بدون هیچ اتفاق ثبت‌شده (مثلاً چک افتتاحیه) محدودیتی ندارد.

export interface ChequeBaseEvent {
  date: Date;
  step: number;
  /** نوع سندِ مبنا برای پیام خطا */
  title: string;
  number: number;
}

type DocKind = "receipt" | "payment" | "deposit" | "depositReturn" | "clearingReceivable" | "clearingPayable";
export interface ExcludeDoc {
  kind: DocKind;
  id: number;
}

const TITLES: Record<DocKind, string> = {
  receipt: "دریافت",
  payment: "پرداخت",
  deposit: "واگذاری به بانک",
  depositReturn: "برگشت از واگذاری",
  clearingReceivable: "وصول/برگشت چک دریافتی",
  clearingPayable: "وصول/برگشت چک پرداختی",
};

/** آخرین اتفاق تاییدشده‌ی هر چک؛ excludeDoc = سندی که در حال ویرایش است (ردیف‌های خودش سند مبنا حساب نمی‌شوند) */
export async function latestChequeBaseEvents(chequeIds: number[], excludeDoc?: ExcludeDoc, db: any = prisma): Promise<Map<number, ChequeBaseEvent>> {
  const result = new Map<number, ChequeBaseEvent>();
  if (chequeIds.length === 0) return result;
  const cheques: { id: number; step: number }[] = await db.chequeItem.findMany({ where: { id: { in: chequeIds } }, select: { id: true, step: true } });
  const stepOf = new Map(cheques.map((c) => [c.id, c.step]));

  const consider = (chequeItemId: number, chequeStep: number | null, date: Date, kind: DocKind, number: number) => {
    if (chequeStep == null) return;
    const cur = stepOf.get(chequeItemId);
    if (cur === undefined || chequeStep > cur) return;
    const prev = result.get(chequeItemId);
    if (!prev || chequeStep > prev.step || (chequeStep === prev.step && date.getTime() > prev.date.getTime())) {
      result.set(chequeItemId, { date, step: chequeStep, title: TITLES[kind], number });
    }
  };
  const skip = (kind: DocKind, id: number) => excludeDoc?.kind === kind && excludeDoc.id === id;

  const where = { chequeItemId: { in: chequeIds }, chequeStep: { not: null } };
  const [receipts, payments, deposits, depositReturns, clearingsR, clearingsP] = await Promise.all([
    db.receiptInstrumentLine.findMany({ where, select: { chequeItemId: true, chequeStep: true, receipt: { select: { id: true, date: true, number: true, status: true } } } }),
    db.paymentInstrumentLine.findMany({ where, select: { chequeItemId: true, chequeStep: true, payment: { select: { id: true, date: true, number: true, status: true } } } }),
    db.chequeDepositLine.findMany({ where, select: { chequeItemId: true, chequeStep: true, chequeDeposit: { select: { id: true, date: true, number: true, status: true } } } }),
    db.chequeDepositReturnLine.findMany({ where, select: { chequeItemId: true, chequeStep: true, chequeDepositReturn: { select: { id: true, date: true, number: true, status: true } } } }),
    db.chequeClearingReceivableLine.findMany({ where, select: { chequeItemId: true, chequeStep: true, chequeClearingReceivable: { select: { id: true, date: true, number: true, status: true } } } }),
    db.chequeClearingPayableLine.findMany({ where, select: { chequeItemId: true, chequeStep: true, chequeClearingPayable: { select: { id: true, date: true, number: true, status: true } } } }),
  ]);
  for (const l of receipts) if (l.receipt.status === "APPROVED" && !skip("receipt", l.receipt.id)) consider(l.chequeItemId, l.chequeStep, l.receipt.date, "receipt", l.receipt.number);
  for (const l of payments) if (l.payment.status === "APPROVED" && !skip("payment", l.payment.id)) consider(l.chequeItemId, l.chequeStep, l.payment.date, "payment", l.payment.number);
  for (const l of deposits) if (l.chequeDeposit.status === "APPROVED" && !skip("deposit", l.chequeDeposit.id)) consider(l.chequeItemId, l.chequeStep, l.chequeDeposit.date, "deposit", l.chequeDeposit.number);
  for (const l of depositReturns) if (l.chequeDepositReturn.status === "APPROVED" && !skip("depositReturn", l.chequeDepositReturn.id)) consider(l.chequeItemId, l.chequeStep, l.chequeDepositReturn.date, "depositReturn", l.chequeDepositReturn.number);
  for (const l of clearingsR) if (l.chequeClearingReceivable.status === "APPROVED" && !skip("clearingReceivable", l.chequeClearingReceivable.id)) consider(l.chequeItemId, l.chequeStep, l.chequeClearingReceivable.date, "clearingReceivable", l.chequeClearingReceivable.number);
  for (const l of clearingsP) if (l.chequeClearingPayable.status === "APPROVED" && !skip("clearingPayable", l.chequeClearingPayable.id)) consider(l.chequeItemId, l.chequeStep, l.chequeClearingPayable.date, "clearingPayable", l.chequeClearingPayable.number);
  return result;
}

/** فیلتر انتخابگر: چک‌هایی که تاریخ سند مبنایشان ≤ تاریخ فرم است (چک بدون سند مبنا، یا وقتی تاریخ فرم نیامده، همه) */
export async function filterChequesByBaseDate<T extends { id: number }>(cheques: T[], formDate: Date | null, excludeDoc?: ExcludeDoc): Promise<T[]> {
  if (!formDate || cheques.length === 0) return cheques;
  const events = await latestChequeBaseEvents(cheques.map((c) => c.id), excludeDoc);
  return cheques.filter((c) => {
    const e = events.get(c.id);
    return !e || e.date.getTime() <= formDate.getTime();
  });
}

/** اعتبارسنجی ثبت/ویرایش: هیچ چکی نباید سند مبنایی با تاریخ بعد از تاریخ سند فرم داشته باشد */
export async function assertChequeBaseDatesNotAfter(chequeIds: number[], formDate: Date, excludeDoc?: ExcludeDoc, labels?: Map<number, string>) {
  const events = await latestChequeBaseEvents(chequeIds, excludeDoc);
  for (const id of chequeIds) {
    const e = events.get(id);
    if (e && e.date.getTime() > formDate.getTime()) {
      throw new Error(`${labels?.get(id) ?? `چک ${id}`}: تاریخ سند مبنا (${e.title} شماره ${e.number}) بعد از تاریخ این سند است`);
    }
  }
}
