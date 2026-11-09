import { prisma } from "../lib/prisma";
import { withoutFiscalPeriodScope } from "../lib/requestContext";

// «مرور پیش‌فاکتور» (فروش › گزارش): پیگیری سرنوشت ردیف‌های پیش‌فاکتورِ تاییدشده — چه مقدار/مبلغی سفارش، حواله و فاکتور شده و چه مانده.
// یک «حقیقت» به ازای هر ردیف پیش‌فاکتور (QuoteLineFact) ساخته می‌شود و تب‌های مرکز فروش/نوع فروش/مشتری/کالا فقط روی همین
// ردیف‌ها جمع می‌زنند (routes/quoteReview.ts). تعاریف:
//  - مبلغ = مبلغ − تخفیف ردیف (به ارز پیش‌فاکتور؛ سفارش و فاکتور هم همان ارز را دارند، پس جمع‌پذیرند).
//  - سفارش‌شده = ردیف‌های سفارش فروش با sourceSalesQuoteLineId (هر وضعیتی، مثل کنترل مانده‌ی فرم‌ها).
//  - حواله‌شده = ردیف‌های حواله فروش (سند انبار SALES_DELIVERY) که مستقیم به ردیف پیش‌فاکتور یا از راه ردیف سفارشِ آن می‌آیند؛
//    فقط برای کالا (خدمت حواله ندارد، مانده‌ی حواله‌نشده‌اش صفر است).
//  - فاکتورشده = ردیف‌های فاکتور فروش ابطال‌نشده که مستقیم، از راه سفارش یا از راه حواله به ردیف پیش‌فاکتور برمی‌گردند.
//  - مانده = پیش‌فاکتور − آنچه انجام شده (بدون کسر «بستن پیگیری»؛ برگشت از فروش هم کم نمی‌شود).

export interface QuoteLineFact {
  lineId: number;
  quoteId: number;
  number: number;
  date: Date;
  currencyId: number;
  currencyTitle: string;
  salesCenterId: number;
  salesCenterCode: number;
  salesCenterTitle: string;
  salesTypeId: number;
  salesTypeCode: number;
  salesTypeTitle: string;
  customerId: number;
  customerCode: number;
  customerTitle: string;
  goodsItemId: number;
  goodsItemCode: string;
  goodsItemTitle: string;
  goodsGroupId: number;
  goodsGroupTitle: string;
  accountingGroupTitle: string;
  unitTitle: string;
  quantity: number;
  amount: number;
  orderedQuantity: number;
  orderedAmount: number;
  deliveredQuantity: number;
  invoicedQuantity: number;
  invoicedAmount: number;
  notOrderedQuantity: number;
  notOrderedAmount: number;
  notDeliveredQuantity: number;
  notInvoicedQuantity: number;
  notInvoicedAmount: number;
}

export interface QuoteReviewFilters {
  fromDate: Date;
  toDate: Date;
  salesCenterIds?: number[];
  salesTypeIds?: number[];
  customerIds?: number[];
  goodsItemIds?: number[];
}

const n = (v: any) => Number(v ?? 0);
const partyTitleOf = (p: any): string => (p?.detailTitle as string) || (p?.category === "LEGAL" ? p?.name || "" : `${p?.firstName || ""} ${p?.lastName || ""}`.trim());
const net = (amount: any, discount: any) => n(amount) - n(discount);

export async function getQuoteLineFacts(f: QuoteReviewFilters): Promise<QuoteLineFact[]> {
  const quoteWhere: any = { status: "APPROVED", date: { gte: f.fromDate, lte: f.toDate } };
  if (f.salesCenterIds?.length) quoteWhere.salesCenterId = { in: f.salesCenterIds };
  if (f.salesTypeIds?.length) quoteWhere.salesTypeId = { in: f.salesTypeIds };
  if (f.customerIds?.length) quoteWhere.customerId = { in: f.customerIds };
  const lineWhere: any = { salesQuote: quoteWhere };
  if (f.goodsItemIds?.length) lineWhere.goodsItemId = { in: f.goodsItemIds };

  const lines = await prisma.salesQuoteLine.findMany({
    where: lineWhere,
    include: {
      unit: true,
      goodsItem: { include: { accountingGroup: true, goodsGroup: true } },
      salesQuote: { include: { currency: true, salesCenter: true, salesType: true, customer: { include: { party: true } } } },
    },
    orderBy: [{ salesQuote: { date: "asc" } }, { salesQuote: { number: "asc" } }, { rowOrder: "asc" }],
  });
  if (lines.length === 0) return [];
  const quoteLineIds = lines.map((l) => l.id);

  // ردیف‌های وابسته در هر سال مالی ممکن است باشند (فاکتور/حواله‌ی سال بعد)؛ پس فقط این جستجوها از محدوده‌ی دوره‌ی مالی خارج می‌شوند
  const { orders, deliveries, invoices } = await withoutFiscalPeriodScope(async () => {
    const orders = await prisma.salesOrderLine.findMany({
      where: { sourceSalesQuoteLineId: { in: quoteLineIds } },
      select: { id: true, quantity: true, amount: true, discount: true, sourceSalesQuoteLineId: true },
    });
    const orderLineIds = orders.map((o) => o.id);
    const deliveries = await prisma.inventoryDocumentLine.findMany({
      where: {
        document: { documentType: "SALES_DELIVERY" },
        OR: [{ sourceSalesQuoteLineId: { in: quoteLineIds } }, ...(orderLineIds.length ? [{ sourceSalesOrderLineId: { in: orderLineIds } }] : [])],
      },
      select: { id: true, quantity: true, sourceSalesQuoteLineId: true, sourceSalesOrderLineId: true },
    });
    const deliveryLineIds = deliveries.map((d) => d.id);
    const or: any[] = [{ sourceSalesQuoteLineId: { in: quoteLineIds } }];
    if (orderLineIds.length) or.push({ sourceSalesOrderLineId: { in: orderLineIds } });
    if (deliveryLineIds.length) or.push({ sourceInventoryLineId: { in: deliveryLineIds } });
    const invoices = await prisma.salesInvoiceLine.findMany({
      where: { salesInvoice: { status: { not: "VOIDED" } }, OR: or },
      select: { quantity: true, amount: true, discount: true, sourceSalesQuoteLineId: true, sourceSalesOrderLineId: true, sourceInventoryLineId: true },
    });
    return { orders, deliveries, invoices };
  });

  const orderToQuote = new Map<number, number>();
  const ordered = new Map<number, { qty: number; amount: number }>();
  for (const o of orders) {
    const q = o.sourceSalesQuoteLineId!;
    orderToQuote.set(o.id, q);
    const cur = ordered.get(q) ?? { qty: 0, amount: 0 };
    cur.qty += n(o.quantity);
    cur.amount += net(o.amount, o.discount);
    ordered.set(q, cur);
  }
  const deliveryToQuote = new Map<number, number>();
  const delivered = new Map<number, number>();
  for (const d of deliveries) {
    const q = d.sourceSalesQuoteLineId ?? (d.sourceSalesOrderLineId != null ? orderToQuote.get(d.sourceSalesOrderLineId) : undefined);
    if (q == null) continue;
    deliveryToQuote.set(d.id, q);
    delivered.set(q, (delivered.get(q) ?? 0) + n(d.quantity));
  }
  const invoiced = new Map<number, { qty: number; amount: number }>();
  for (const i of invoices) {
    const q =
      i.sourceSalesQuoteLineId ??
      (i.sourceSalesOrderLineId != null ? orderToQuote.get(i.sourceSalesOrderLineId) : undefined) ??
      (i.sourceInventoryLineId != null ? deliveryToQuote.get(i.sourceInventoryLineId) : undefined);
    if (q == null) continue;
    const cur = invoiced.get(q) ?? { qty: 0, amount: 0 };
    cur.qty += n(i.quantity);
    cur.amount += net(i.amount, i.discount);
    invoiced.set(q, cur);
  }

  return lines.map((l) => {
    const quote = l.salesQuote;
    const qty = n(l.quantity);
    const amount = net(l.amount, l.discount);
    const ord = ordered.get(l.id) ?? { qty: 0, amount: 0 };
    const inv = invoiced.get(l.id) ?? { qty: 0, amount: 0 };
    const del = delivered.get(l.id) ?? 0;
    const isGoods = l.goodsItem.kind !== "SERVICE";
    return {
      lineId: l.id,
      quoteId: quote.id,
      number: quote.number,
      date: quote.date,
      currencyId: quote.currencyId,
      currencyTitle: quote.currency.title,
      salesCenterId: quote.salesCenterId,
      salesCenterCode: quote.salesCenter.code,
      salesCenterTitle: quote.salesCenter.title,
      salesTypeId: quote.salesTypeId,
      salesTypeCode: quote.salesType.code,
      salesTypeTitle: quote.salesType.title,
      customerId: quote.customerId,
      customerCode: quote.customer.code,
      customerTitle: partyTitleOf(quote.customer.party),
      goodsItemId: l.goodsItemId,
      goodsItemCode: l.goodsItem.fullCode,
      goodsItemTitle: l.goodsItem.title,
      goodsGroupId: l.goodsItem.goodsGroupId,
      goodsGroupTitle: l.goodsItem.goodsGroup?.title ?? "",
      accountingGroupTitle: l.goodsItem.accountingGroup?.title ?? "",
      unitTitle: l.unit.title,
      quantity: qty,
      amount,
      orderedQuantity: ord.qty,
      orderedAmount: ord.amount,
      deliveredQuantity: isGoods ? del : 0,
      invoicedQuantity: inv.qty,
      invoicedAmount: inv.amount,
      notOrderedQuantity: qty - ord.qty,
      notOrderedAmount: amount - ord.amount,
      notDeliveredQuantity: isGoods ? qty - del : 0,
      notInvoicedQuantity: qty - inv.qty,
      notInvoicedAmount: amount - inv.amount,
    };
  });
}

export type QuoteDocKind = "orders" | "deliveries" | "invoices";

export interface QuoteDocRow {
  id: string;
  documentId: number;
  number: number;
  date: Date;
  quoteNumber: number;
  quantity: number;
  amount: number | null;
}

// ریز اسناد پشت سلول‌های «سفارش‌شده/حواله‌شده/فاکتورشده»: همان پیوندهای getQuoteLineFacts، گروه‌شده به‌ازای سند و ردیف پیش‌فاکتور
// (جمع مقدار/مبلغ هر سند برای ردیف‌های انتخاب‌شده)؛ حواله مبلغ ندارد (amount = null).
export async function getQuoteLineDocs(kind: QuoteDocKind, quoteLineIds: number[], quoteNumberOf: Map<number, number>): Promise<QuoteDocRow[]> {
  if (quoteLineIds.length === 0) return [];
  return withoutFiscalPeriodScope(async () => {
    const orders = await prisma.salesOrderLine.findMany({
      where: { sourceSalesQuoteLineId: { in: quoteLineIds } },
      select: { id: true, quantity: true, amount: true, discount: true, sourceSalesQuoteLineId: true, salesOrder: { select: { id: true, number: true, date: true } } },
    });
    const orderToQuote = new Map(orders.map((o) => [o.id, o.sourceSalesQuoteLineId!]));
    const out = new Map<string, QuoteDocRow>();
    const add = (q: number, docId: number, number: number, date: Date, qty: number, amount: number | null) => {
      const key = `${docId}:${q}`;
      const cur = out.get(key);
      if (cur) {
        cur.quantity += qty;
        if (amount != null) cur.amount = (cur.amount ?? 0) + amount;
      } else out.set(key, { id: key, documentId: docId, number, date, quoteNumber: quoteNumberOf.get(q) ?? 0, quantity: qty, amount });
    };
    if (kind === "orders") {
      for (const o of orders) add(o.sourceSalesQuoteLineId!, o.salesOrder.id, o.salesOrder.number, o.salesOrder.date, n(o.quantity), net(o.amount, o.discount));
    } else {
      const orderIds = orders.map((o) => o.id);
      const deliveries = await prisma.inventoryDocumentLine.findMany({
        where: {
          document: { documentType: "SALES_DELIVERY" },
          OR: [{ sourceSalesQuoteLineId: { in: quoteLineIds } }, ...(orderIds.length ? [{ sourceSalesOrderLineId: { in: orderIds } }] : [])],
        },
        select: { id: true, quantity: true, sourceSalesQuoteLineId: true, sourceSalesOrderLineId: true, document: { select: { id: true, number: true, date: true } } },
      });
      const delToQuote = new Map<number, number>();
      for (const d of deliveries) {
        const q = d.sourceSalesQuoteLineId ?? (d.sourceSalesOrderLineId != null ? orderToQuote.get(d.sourceSalesOrderLineId) : undefined);
        if (q == null) continue;
        delToQuote.set(d.id, q);
        if (kind === "deliveries") add(q, d.document.id, d.document.number, d.document.date, n(d.quantity), null);
      }
      if (kind === "invoices") {
        const or: any[] = [{ sourceSalesQuoteLineId: { in: quoteLineIds } }];
        if (orderIds.length) or.push({ sourceSalesOrderLineId: { in: orderIds } });
        if (delToQuote.size) or.push({ sourceInventoryLineId: { in: Array.from(delToQuote.keys()) } });
        const invoices = await prisma.salesInvoiceLine.findMany({
          where: { salesInvoice: { status: { not: "VOIDED" } }, OR: or },
          select: { quantity: true, amount: true, discount: true, sourceSalesQuoteLineId: true, sourceSalesOrderLineId: true, sourceInventoryLineId: true, salesInvoice: { select: { id: true, number: true, date: true } } },
        });
        for (const i of invoices) {
          const q =
            i.sourceSalesQuoteLineId ??
            (i.sourceSalesOrderLineId != null ? orderToQuote.get(i.sourceSalesOrderLineId) : undefined) ??
            (i.sourceInventoryLineId != null ? delToQuote.get(i.sourceInventoryLineId) : undefined);
          if (q != null) add(q, i.salesInvoice.id, i.salesInvoice.number, i.salesInvoice.date, n(i.quantity), net(i.amount, i.discount));
        }
      }
    }
    return Array.from(out.values()).sort((a, b) => a.date.getTime() - b.date.getTime() || a.number - b.number);
  });
}
