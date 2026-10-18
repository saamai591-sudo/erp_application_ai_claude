import { prisma } from "../lib/prisma";
import { withoutFiscalPeriodScope } from "../lib/requestContext";

// پیگیری پیش‌فاکتور: «بستن پیگیری» مانده‌ی پیش‌فاکتورِ تأییدشده را کنار می‌گذارد (فروش نشد/منصرف شد) بدون اینکه چیزی از آنچه قبلاً سفارش/حواله/فاکتور شده عوض شود.
// ردیف‌به‌ردیف: SalesQuoteLine.closedQuantity = مانده‌ی ردیف در لحظه‌ی بستن؛ همین مقدار از «مانده»ی قابل‌تبدیل (سفارش، حواله، فاکتور مستقیم) کم می‌شود،
// پس تبدیل تازه‌ای روی مانده‌ی بسته‌شده ممکن نیست ولی سند قبلاً‌ساخته‌شده همچنان ویرایش‌پذیر است (مصرف خودش جزو «بسته» نیست).
// تنها محل محاسبه‌ی مانده و وضعیت پیگیری؛ فهرست/فرم/دیالوگ همه از اینجا می‌خوانند.

export class QuoteFollowUpError extends Error {}

export type FollowUpState = "OPEN" | "WON" | "EXPIRED" | "CLOSED_PARTIAL" | "CLOSED_NO_SALE";

export interface LineRemainder {
  lineId: number;
  quantity: number;
  /** سفارش‌شده + حواله‌ی مستقیم + فاکتور مستقیم (باطل‌نشده) */
  converted: number;
  closed: number;
  /** مانده‌ی بازِ قابل‌پیگیری = مقدار − تبدیل‌شده − بسته‌شده (≥ ۰) */
  remaining: number;
  remainingNet: number;
  remainingVat: number;
}

export interface QuoteRemainder {
  lines: LineRemainder[];
  hasConversion: boolean;
  remainingQty: number;
  remainingNet: number;
  remainingVat: number;
}

const EPS = 1e-9;

/** مانده‌ی پیش‌فاکتورها (یک‌جا برای فهرست). db می‌تواند تراکنش باشد */
export async function quoteRemainders(quoteIds: number[], db: any = prisma): Promise<Map<number, QuoteRemainder>> {
  const out = new Map<number, QuoteRemainder>();
  if (quoteIds.length === 0) return out;
  const lines: any[] = await withoutFiscalPeriodScope(() =>
    db.salesQuoteLine.findMany({
      where: { salesQuoteId: { in: quoteIds } },
      select: { id: true, salesQuoteId: true, quantity: true, amount: true, discount: true, vatAmount: true, closedQuantity: true },
      orderBy: [{ salesQuoteId: "asc" }, { rowOrder: "asc" }, { id: "asc" }],
    })
  );
  const lineIds = lines.map((l) => l.id);
  const sumBy = (rows: any[]) => new Map<number, number>(rows.map((r) => [r.sourceSalesQuoteLineId as number, Number(r._sum.quantity ?? 0)]));
  const [ordered, delivered, invoiced] = lineIds.length
    ? await Promise.all([
        db.salesOrderLine.groupBy({ by: ["sourceSalesQuoteLineId"], where: { sourceSalesQuoteLineId: { in: lineIds } }, _sum: { quantity: true } }),
        db.inventoryDocumentLine.groupBy({ by: ["sourceSalesQuoteLineId"], where: { sourceSalesQuoteLineId: { in: lineIds }, document: { documentType: "SALES_DELIVERY" } }, _sum: { quantity: true } }),
        db.salesInvoiceLine.groupBy({ by: ["sourceSalesQuoteLineId"], where: { sourceSalesQuoteLineId: { in: lineIds }, salesInvoice: { status: { not: "VOIDED" } } }, _sum: { quantity: true } }),
      ]).then(([a, b, c]) => [sumBy(a), sumBy(b), sumBy(c)])
    : [new Map<number, number>(), new Map<number, number>(), new Map<number, number>()];
  for (const id of quoteIds) out.set(id, { lines: [], hasConversion: false, remainingQty: 0, remainingNet: 0, remainingVat: 0 });
  for (const l of lines) {
    const q = out.get(l.salesQuoteId)!;
    const quantity = Number(l.quantity);
    const converted = (ordered.get(l.id) ?? 0) + (delivered.get(l.id) ?? 0) + (invoiced.get(l.id) ?? 0);
    const closed = Number(l.closedQuantity ?? 0);
    const remaining = Math.max(0, quantity - converted - closed);
    const frac = quantity > 0 ? remaining / quantity : 0;
    const row: LineRemainder = {
      lineId: l.id,
      quantity,
      converted,
      closed,
      remaining,
      remainingNet: frac * (Number(l.amount) - Number(l.discount)),
      remainingVat: frac * Number(l.vatAmount),
    };
    q.lines.push(row);
    if (converted > EPS) q.hasConversion = true;
    q.remainingQty += remaining;
    q.remainingNet += row.remainingNet;
    q.remainingVat += row.remainingVat;
  }
  return out;
}

/** وضعیت پیگیری. پیش‌فاکتور در حالت «ثبت» هم پیگیری می‌شود (و می‌تواند منصرف شود)؛ چون هنوز تبدیلی ندارد، بسته‌شدنش «بسته بدون فروش» است */
export function followUpStateOf(q: { status: string; followUpClosedAt: Date | null; validUntil: Date | null }, r: QuoteRemainder | undefined, today = new Date()): FollowUpState | null {
  if (q.status === "VOIDED") return null;
  const remainingQty = r?.remainingQty ?? 0;
  if (q.followUpClosedAt) return r?.hasConversion ? "CLOSED_PARTIAL" : "CLOSED_NO_SALE";
  if (remainingQty <= EPS) return "WON";
  if (q.validUntil && q.validUntil.getTime() < new Date(today.toISOString().slice(0, 10)).getTime()) return "EXPIRED";
  return "OPEN";
}

async function lockQuote(tx: any, quoteId: number) {
  await tx.$queryRaw`SELECT "id" FROM "SalesQuote" WHERE "id" = ${quoteId} FOR UPDATE`;
  // ردیف‌ها هم قفل می‌شوند (هم‌ترتیبِ قفل در ساخت حواله/سفارش: به ترتیب شناسه) تا تبدیلِ هم‌زمان با بستن صف شود
  const ids: { id: number }[] = await tx.$queryRaw`SELECT "id" FROM "SalesQuoteLine" WHERE "salesQuoteId" = ${quoteId} ORDER BY "id" FOR UPDATE`;
  return ids.map((x) => x.id);
}

/** پیش‌نمایش «بستن»: مانده‌ی هر ردیف و جمع مبلغ/ارزش‌افزوده‌ی باقی‌مانده */
export async function followUpPreview(quoteId: number) {
  const quote = await withoutFiscalPeriodScope(() => prisma.salesQuote.findUnique({ where: { id: quoteId }, include: { lines: { include: { goodsItem: true, unit: true }, orderBy: [{ rowOrder: "asc" }, { id: "asc" }] }, followUpReason: true, followUpClosedBy: true, currency: true } }));
  if (!quote) throw new QuoteFollowUpError("پیش‌فاکتور یافت نشد");
  const rem = (await quoteRemainders([quoteId])).get(quoteId)!;
  const byLine = new Map(rem.lines.map((l) => [l.lineId, l]));
  return {
    state: followUpStateOf(quote as any, rem),
    closedAt: quote.followUpClosedAt,
    closedBy: quote.followUpClosedBy ? `${quote.followUpClosedBy.firstName} ${quote.followUpClosedBy.lastName}`.trim() : null,
    reasonId: quote.followUpReasonId,
    reasonTitle: quote.followUpReason?.title ?? null,
    note: quote.followUpNote,
    closedRemainingAmount: quote.closedRemainingAmount === null ? null : Number(quote.closedRemainingAmount),
    closedRemainingVat: quote.closedRemainingVat === null ? null : Number(quote.closedRemainingVat),
    currencyTitle: quote.currency.title,
    remainingQty: rem.remainingQty,
    remainingNet: rem.remainingNet,
    remainingVat: rem.remainingVat,
    lines: quote.lines.map((l: any) => {
      const r = byLine.get(l.id)!;
      return { id: l.id, goodsItemCode: l.goodsItem.fullCode, goodsItemTitle: l.goodsItem.title, unitTitle: l.unit.title, quantity: r.quantity, converted: r.converted, closed: r.closed, remaining: r.remaining };
    }),
  };
}

/** بستن پیگیری: مانده‌ی همه‌ی ردیف‌ها کنار گذاشته می‌شود */
export async function closeFollowUp(quoteId: number, input: { reasonId: number; note?: string | null }, userId: number | null) {
  const reasonId = Number(input.reasonId);
  if (!Number.isInteger(reasonId) || reasonId <= 0) throw new QuoteFollowUpError("دلیل را انتخاب کنید");
  const reason = await prisma.salesQuoteLostReason.findUnique({ where: { id: reasonId } });
  if (!reason) throw new QuoteFollowUpError("دلیل را انتخاب کنید");
  if (!reason.isActive) throw new QuoteFollowUpError("این دلیل غیرفعال است");
  const note = String(input.note ?? "").trim() || null;
  return withoutFiscalPeriodScope(() =>
    prisma.$transaction(async (tx) => {
      const lineIds = await lockQuote(tx, quoteId);
      const quote = await tx.salesQuote.findUnique({ where: { id: quoteId } });
      if (!quote) throw new QuoteFollowUpError("پیش‌فاکتور یافت نشد");
      if (quote.status !== "APPROVED" && quote.status !== "DRAFT") throw new QuoteFollowUpError("وضعیت این پیش‌فاکتور اجازه‌ی بستن پیگیری نمی‌دهد");
      if (quote.followUpClosedAt) throw new QuoteFollowUpError("پیگیری این پیش‌فاکتور قبلاً بسته شده است");
      const rem = (await quoteRemainders([quoteId], tx)).get(quoteId)!;
      if (rem.remainingQty <= EPS) throw new QuoteFollowUpError("از این پیش‌فاکتور چیزی باقی نمانده که بسته شود (همه‌ی ردیف‌ها تبدیل شده‌اند)");
      for (const l of rem.lines) {
        if (l.remaining > EPS && lineIds.includes(l.lineId)) await tx.salesQuoteLine.update({ where: { id: l.lineId }, data: { closedQuantity: l.closed + l.remaining } });
      }
      await tx.salesQuote.update({
        where: { id: quoteId },
        data: { followUpClosedAt: new Date(), followUpClosedById: userId, followUpReasonId: reason.id, followUpNote: note, closedRemainingAmount: rem.remainingNet, closedRemainingVat: rem.remainingVat },
      });
      return { remainingQty: rem.remainingQty, remainingNet: rem.remainingNet, remainingVat: rem.remainingVat };
    })
  );
}

/** بازگشایی: مقدار بسته‌شده‌ی همه‌ی ردیف‌ها صفر می‌شود (روی مانده‌ی بسته‌شده تبدیلی انجام نشده، پس بدون خطر) */
export async function reopenFollowUp(quoteId: number) {
  return withoutFiscalPeriodScope(() =>
    prisma.$transaction(async (tx) => {
      await lockQuote(tx, quoteId);
      const quote = await tx.salesQuote.findUnique({ where: { id: quoteId } });
      if (!quote) throw new QuoteFollowUpError("پیش‌فاکتور یافت نشد");
      if (!quote.followUpClosedAt) throw new QuoteFollowUpError("پیگیری این پیش‌فاکتور بسته نیست");
      await tx.salesQuoteLine.updateMany({ where: { salesQuoteId: quoteId }, data: { closedQuantity: 0 } });
      await tx.salesQuote.update({
        where: { id: quoteId },
        data: { followUpClosedAt: null, followUpClosedById: null, followUpReasonId: null, followUpNote: null, closedRemainingAmount: null, closedRemainingVat: null },
      });
    })
  );
}
