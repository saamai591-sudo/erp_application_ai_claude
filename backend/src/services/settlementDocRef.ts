// ردیف‌های «موضوعات دریافت/پرداخت» (ReceiptSettlementLine / PaymentSettlementLine) دو نوع والد دارند: سند دریافت/پرداخت (receipt/payment)
// یا «اعلامیه بدهکار بستانکار» (partySettlement؛ بدون ابزار و همیشه اثرگذار). هر خواننده‌ی این ردیف‌ها که «وضعیت/تاریخ/شماره‌ی سند» لازم دارد
// باید از همین‌جا بگذرد تا والد دوم جا نیفتد — تنها محل این منطق.

/** include لازم برای خواندن مرجع سند یک ردیف دریافت */
export const RECEIPT_DOC_INCLUDE = { receipt: true, partySettlement: true } as const;
/** include لازم برای خواندن مرجع سند یک ردیف پرداخت */
export const PAYMENT_DOC_INCLUDE = { payment: true, partySettlement: true } as const;

export interface SettlementDocRef {
  kind: "RECEIPT" | "PAYMENT" | "PARTY_SETTLEMENT";
  id: number;
  number: number;
  date: Date;
  /** سند اثرگذار است؟ (اعلامیه بدهکار بستانکار همیشه اثرگذار است) */
  approved: boolean;
  /** مسیر فرم سند در فرانت‌اند */
  path: string;
  /** عنوان نوع سند برای پیام‌ها */
  title: string;
}

/** مرجع سند یک ردیف دریافت (include: RECEIPT_DOC_INCLUDE) */
export function receiptLineDoc(l: { receipt?: any; partySettlement?: any }): SettlementDocRef {
  if (l.partySettlement) {
    const p = l.partySettlement;
    return { kind: "PARTY_SETTLEMENT", id: p.id, number: p.number, date: p.date, approved: true, path: `/party-settlements/${p.id}/edit`, title: "اعلامیه بدهکار بستانکار" };
  }
  const r = l.receipt;
  return { kind: "RECEIPT", id: r.id, number: r.number, date: r.date, approved: r.status === "APPROVED", path: `/receipts/${r.id}/edit`, title: "رسید دریافت" };
}

/** مرجع سند یک ردیف پرداخت (include: PAYMENT_DOC_INCLUDE) */
export function paymentLineDoc(l: { payment?: any; partySettlement?: any }): SettlementDocRef {
  if (l.partySettlement) {
    const p = l.partySettlement;
    return { kind: "PARTY_SETTLEMENT", id: p.id, number: p.number, date: p.date, approved: true, path: `/party-settlements/${p.id}/edit`, title: "اعلامیه بدهکار بستانکار" };
  }
  const r = l.payment;
  return { kind: "PAYMENT", id: r.id, number: r.number, date: r.date, approved: r.status === "APPROVED", path: `/payments/${r.id}/edit`, title: "اعلامیه پرداخت" };
}

/**
 * شرط Prisma «ردیف دریافتِ اثرگذار»: ردیفِ سند دریافتِ تاییدشده (با شرط اختیاری تاریخ سند) یا ردیفِ هر اعلامیه بدهکار بستانکار.
 * `dateLte`: فقط اسناد با تاریخ ≤ این مقدار؛ `extra` (مثل { fiscalPeriodId }) روی هر دو والد اعمال می‌شود.
 */
export function effectiveReceiptLine(dateLte?: Date, extra: Record<string, unknown> = {}) {
  const date = dateLte ? { date: { lte: dateLte } } : {};
  return { OR: [{ receipt: { is: { status: "APPROVED" as const, ...date, ...extra } } }, { partySettlement: { is: { ...date, ...extra } } }] };
}

/** هم‌الگوی effectiveReceiptLine برای ردیف پرداخت */
export function effectivePaymentLine(dateLte?: Date, extra: Record<string, unknown> = {}) {
  const date = dateLte ? { date: { lte: dateLte } } : {};
  return { OR: [{ payment: { is: { status: "APPROVED" as const, ...date, ...extra } } }, { partySettlement: { is: { ...date, ...extra } } }] };
}
