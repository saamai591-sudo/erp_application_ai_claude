import { prisma } from "../lib/prisma";
import { withoutFiscalPeriodScope } from "../lib/requestContext";

// داده‌ی «مرور تضامین دریافتی/پرداختی»: هر ابزار تضمین (چک / سفته / ضمانت‌نامه) با رویدادهایش — سند اصلی (یا افتتاحیه)، افزایش، تقلیل، ابطال، استرداد و تمدید.
// همه‌ی سال‌ها خوانده می‌شود (وضعیت ضمانت‌نامه سال‌به‌سال بسته نمی‌شود)؛ مبالغ به ارز خودِ ابزار است. تجمیع ستون‌ها در routes/guaranteeReview.ts.

export type Direction = "RECEIPT" | "PAYMENT";
export type EventKind = "ORIGINAL" | "OPENING" | "INCREASE" | "REDUCE" | "CANCEL" | "RETURN" | "EXTEND";

export interface GuaranteeEvent {
  key: string;
  kind: EventKind;
  date: Date;
  createdAt: Date;
  docNumber: number;
  /// مسیر فرمِ سند برای دابل‌کلیک
  openPath: string;
  /// قدر مطلق مبلغ رویداد (تمدید: صفر)
  amount: number;
  newDueDate: Date | null;
}

export interface ReviewInstrument {
  id: number;
  partyId: number;
  partyCode: string;
  partyTitle: string;
  type: "CHEQUE" | "PROMISSORY" | "LETTER";
  number: string;
  guaranteeTypeTitle: string;
  documentNumber: number;
  documentDate: Date;
  isOpening: boolean;
  currencyId: number;
  currencyTitle: string;
  originalAmount: number;
  originalDueDate: Date | null;
  events: GuaranteeEvent[];
}

const PATHS = {
  RECEIPT: { doc: "/guarantee-receipts", ext: "/guarantee-receipt-extensions", op: "/guarantee-receipt-operations", ret: "/guarantee-receipt-returns" },
  PAYMENT: { doc: "/guarantee-payments", ext: "/guarantee-payment-extensions", op: "/guarantee-payment-operations", ret: "/guarantee-payment-returns" },
} as const;

/** +1 افزایش مانده، −1 کاهش، 0 بدون اثر بر مبلغ */
export const EVENT_SIGN: Record<EventKind, number> = { ORIGINAL: 1, OPENING: 1, INCREASE: 1, REDUCE: -1, CANCEL: -1, RETURN: -1, EXTEND: 0 };

/** ابزارهای یک جهت که سند اصلی‌شان تا toDate ثبت شده، با همه‌ی رویدادهایشان تا toDate (ترتیب: تاریخ، زمان ثبت) */
export async function loadReviewInstruments(direction: Direction, toDate: Date): Promise<ReviewInstrument[]> {
  const P = PATHS[direction];
  return withoutFiscalPeriodScope(async () => {
    const rows = await prisma.guaranteeInstrument.findMany({
      where: { document: { direction, date: { lte: toDate } } },
      include: {
        document: { select: { id: true, number: true, date: true, createdAt: true, openingId: true, party: { select: { id: true, detailCode: true, detailTitle: true } } } },
        guaranteeType: { select: { title: true } },
        currency: { select: { title: true } },
        extensionLines: { where: { extension: { date: { lte: toDate } } }, include: { extension: { select: { id: true, number: true, date: true, createdAt: true } } } },
        operationLines: { where: { operation: { date: { lte: toDate } } }, include: { operation: { select: { id: true, number: true, date: true, createdAt: true, kind: true } } } },
        returnLine: { include: { returnDoc: { select: { id: true, number: true, date: true, createdAt: true } } } },
      },
      orderBy: { id: "asc" },
    });
    return rows.map((i) => {
      const d = i.document;
      const events: GuaranteeEvent[] = [
        {
          key: `D${i.id}`,
          kind: d.openingId != null ? "OPENING" : "ORIGINAL",
          date: d.date,
          createdAt: d.createdAt,
          docNumber: d.number,
          openPath: d.openingId != null ? `/treasury-openings/${d.openingId}/edit` : `${P.doc}/${d.id}/edit`,
          amount: Number(i.amount),
          newDueDate: null,
        },
        ...i.extensionLines.map((l) => ({ key: `E${l.id}`, kind: "EXTEND" as EventKind, date: l.extension.date, createdAt: l.extension.createdAt, docNumber: l.extension.number, openPath: `${P.ext}/${l.extension.id}/edit`, amount: 0, newDueDate: l.newDueDate })),
        ...i.operationLines.map((l) => ({ key: `O${l.id}`, kind: l.operation.kind as EventKind, date: l.operation.date, createdAt: l.operation.createdAt, docNumber: l.operation.number, openPath: `${P.op}/${l.operation.id}/edit`, amount: Number(l.changeAmount ?? 0), newDueDate: null })),
      ];
      if (i.returnLine && i.returnLine.returnDoc.date <= toDate) {
        const r = i.returnLine.returnDoc;
        events.push({ key: `R${i.returnLine.id}`, kind: "RETURN", date: r.date, createdAt: r.createdAt, docNumber: r.number, openPath: `${P.ret}/${r.id}/edit`, amount: Number(i.amount), newDueDate: null });
      }
      events.sort((a, b) => a.date.getTime() - b.date.getTime() || a.createdAt.getTime() - b.createdAt.getTime() || a.key.localeCompare(b.key));
      return {
        id: i.id,
        partyId: d.party.id,
        partyCode: d.party.detailCode,
        partyTitle: d.party.detailTitle ?? "",
        type: i.type,
        number: i.number,
        guaranteeTypeTitle: i.guaranteeType.title,
        documentNumber: d.number,
        documentDate: d.date,
        isOpening: d.openingId != null,
        currencyId: i.currencyId,
        currencyTitle: i.currency.title,
        originalAmount: Number(i.amount),
        originalDueDate: i.dueDate,
        events,
      };
    });
  });
}

export type InstrumentStatus = "ACTIVE" | "CANCELLED" | "RETURNED";
export type DueState = "OVERDUE" | "NOT_DUE" | "NONE" | "CLOSED";

/** وضعیت و سررسید فعلی (تا انتهای بازه) و دسته‌ی سررسید نسبت به امروز: گذشته / سررسید نشده (امروز یا بعد) / فاقد سررسید؛ ابزار ابطال‌شده یا مسترد CLOSED است */
export function instrumentState(i: ReviewInstrument, today: Date) {
  let dueDate: Date | null = i.originalDueDate;
  let status: InstrumentStatus = "ACTIVE";
  for (const e of i.events) {
    if (e.kind === "EXTEND" && e.newDueDate) dueDate = e.newDueDate;
    else if (e.kind === "CANCEL") status = "CANCELLED";
    else if (e.kind === "RETURN") status = "RETURNED";
  }
  let dueState: DueState = "CLOSED";
  if (status === "ACTIVE") {
    if (!dueDate) dueState = "NONE";
    else dueState = dueDate < today ? "OVERDUE" : "NOT_DUE";
  }
  return { status, dueDate, dueState };
}
