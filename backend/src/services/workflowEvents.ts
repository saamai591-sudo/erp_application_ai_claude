import { prisma } from "../lib/prisma";

// کارتابل و گردش کار: رویدادهای سندها، سندِ ریشه و فیلدهای شرط. طراحی: Documents/WorkflowInbox.md
// فاز ۱: فقط سندِ ریشه‌ی «پیش‌فاکتور» (زنجیره‌ی فروش). رویدادها از سرویس‌ها/مسیرهای سند بعد از انجام موفق کار با emitWorkflowEvent اعلام می‌شوند.

export type RootType = "SALES_QUOTE";

export interface EventDef {
  key: string;
  title: string;
  rootType: RootType;
  /// می‌تواند رویداد شروع فرایند باشد
  canStart?: boolean;
  /// می‌تواند مرحله را خودکار ببندد
  canComplete?: boolean;
  /// نمونه‌ی در جریان را لغو می‌کند
  cancels?: boolean;
}

export const WORKFLOW_EVENTS: EventDef[] = [
  { key: "SALES_QUOTE_APPROVED", title: "پیش‌فاکتور تایید شد", rootType: "SALES_QUOTE", canStart: true },
  { key: "SALES_QUOTE_UNAPPROVED", title: "تایید پیش‌فاکتور برگشت خورد", rootType: "SALES_QUOTE", cancels: true },
  { key: "RECEIPT_APPROVED", title: "دریافتِ مربوط به پیش‌فاکتور ثبت شد", rootType: "SALES_QUOTE", canComplete: true },
  { key: "SALES_DELIVERY_REGISTERED", title: "حواله فروشِ مربوط به پیش‌فاکتور ثبت شد", rootType: "SALES_QUOTE", canComplete: true },
  { key: "SALES_INVOICE_CREATED", title: "فاکتور فروشِ مربوط به پیش‌فاکتور ثبت شد", rootType: "SALES_QUOTE", canComplete: true },
  { key: "TAX_INVOICE_SENT", title: "فاکتورِ مربوط به پیش‌فاکتور به سامانه مودیان ارسال شد", rootType: "SALES_QUOTE", canComplete: true },
];
export const EVENT_BY_KEY = new Map(WORKFLOW_EVENTS.map((e) => [e.key, e]));

export const ROOT_TYPE_FA: Record<RootType, string> = { SALES_QUOTE: "پیش‌فاکتور" };

/** فیلدهای قابل استفاده در شرط (روی سندِ ریشه) */
export const CONDITION_FIELDS: Record<RootType, { key: string; title: string }[]> = {
  SALES_QUOTE: [
    { key: "salesCenterId", title: "مرکز فروش" },
    { key: "salesTypeId", title: "نوع فروش" },
    { key: "customerId", title: "مشتری" },
    { key: "currencyId", title: "ارز" },
  ],
};

export interface Condition {
  field: string;
  op: "EQ" | "NEQ";
  value: number;
}

/** شرط‌ها با AND؛ لیست خالی = همیشه برقرار */
export function conditionOk(conds: unknown, ctx: Record<string, unknown>): boolean {
  if (!Array.isArray(conds)) return true;
  return (conds as Condition[]).every((c) => {
    const v = Number(ctx[c.field]);
    return c.op === "NEQ" ? v !== Number(c.value) : v === Number(c.value);
  });
}

/** پاک‌سازی و اعتبارسنجی شرط‌های ورودی فرم */
export function cleanConditions(raw: unknown, rootType: RootType): Condition[] {
  if (raw == null || raw === "") return [];
  if (!Array.isArray(raw)) throw new Error("شرط‌ها نامعتبر است");
  const allowed = new Set(CONDITION_FIELDS[rootType].map((f) => f.key));
  return raw
    .filter((c: any) => c && (c.field || c.value))
    .map((c: any) => {
      if (!allowed.has(String(c.field))) throw new Error(`فیلد شرط «${c.field}» مجاز نیست`);
      const value = Number(c.value);
      if (!Number.isInteger(value) || value <= 0) throw new Error("مقدار شرط را انتخاب کنید");
      return { field: String(c.field), op: c.op === "NEQ" ? "NEQ" : "EQ", value } as Condition;
    });
}

export interface RootInfo {
  number: number | null;
  title: string;
  creatorUserId: number | null;
  context: Record<string, unknown>;
  status: string;
}

/** سندِ ریشه: شماره/عنوان/ثبت‌کننده/فیلدهای شرط */
export async function loadRoot(rootType: RootType, rootId: number): Promise<RootInfo | null> {
  if (rootType !== "SALES_QUOTE") return null;
  const q = await prisma.salesQuote.findUnique({
    where: { id: rootId },
    select: { number: true, status: true, createdById: true, customerId: true, salesTypeId: true, salesCenterId: true, currencyId: true, customer: { select: { party: { select: { detailTitle: true, firstName: true, lastName: true, name: true } } } } },
  });
  if (!q) return null;
  const p = q.customer.party;
  const cust = p.detailTitle || [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "";
  return {
    number: q.number,
    title: `پیش‌فاکتور ${q.number} — ${cust}`,
    creatorUserId: q.createdById,
    status: q.status,
    context: { salesCenterId: q.salesCenterId, salesTypeId: q.salesTypeId, customerId: q.customerId, currencyId: q.currencyId },
  };
}

/** ردیف‌های پیش‌فاکتور/سفارش/حواله → شناسه‌ی پیش‌فاکتورها */
async function quotesOfLines(opts: { quoteLineIds?: number[]; orderLineIds?: number[]; inventoryLineIds?: number[] }): Promise<number[]> {
  const quoteLineIds = new Set<number>(opts.quoteLineIds ?? []);
  const orderLineIds = new Set<number>(opts.orderLineIds ?? []);
  if (opts.inventoryLineIds?.length) {
    const inv = await prisma.inventoryDocumentLine.findMany({ where: { id: { in: opts.inventoryLineIds } }, select: { sourceSalesQuoteLineId: true, sourceSalesOrderLineId: true } });
    for (const l of inv) {
      if (l.sourceSalesQuoteLineId) quoteLineIds.add(l.sourceSalesQuoteLineId);
      if (l.sourceSalesOrderLineId) orderLineIds.add(l.sourceSalesOrderLineId);
    }
  }
  if (orderLineIds.size) {
    const ol = await prisma.salesOrderLine.findMany({ where: { id: { in: [...orderLineIds] } }, select: { sourceSalesQuoteLineId: true } });
    for (const l of ol) if (l.sourceSalesQuoteLineId) quoteLineIds.add(l.sourceSalesQuoteLineId);
  }
  if (!quoteLineIds.size) return [];
  const ql = await prisma.salesQuoteLine.findMany({ where: { id: { in: [...quoteLineIds] } }, select: { salesQuoteId: true } });
  return [...new Set(ql.map((l) => l.salesQuoteId))];
}

/** رویداد یک سند ← پیش‌فاکتورهای مرتبط (ریشه‌ها) */
export async function resolveRoots(eventKey: string, docId: number): Promise<number[]> {
  switch (eventKey) {
    case "SALES_QUOTE_APPROVED":
    case "SALES_QUOTE_UNAPPROVED":
      return [docId];
    case "RECEIPT_APPROVED": {
      const lines = await prisma.receiptSettlementLine.findMany({ where: { receiptId: docId }, select: { salesQuoteId: true, salesOrderId: true } });
      const direct = lines.map((l) => l.salesQuoteId).filter((x): x is number => !!x);
      const orderIds = lines.map((l) => l.salesOrderId).filter((x): x is number => !!x);
      const viaOrders = orderIds.length
        ? await quotesOfLines({ orderLineIds: (await prisma.salesOrderLine.findMany({ where: { salesOrderId: { in: orderIds } }, select: { id: true } })).map((x) => x.id) })
        : [];
      return [...new Set([...direct, ...viaOrders])];
    }
    case "SALES_DELIVERY_REGISTERED": {
      const lines = await prisma.inventoryDocumentLine.findMany({ where: { documentId: docId }, select: { sourceSalesQuoteLineId: true, sourceSalesOrderLineId: true } });
      return quotesOfLines({ quoteLineIds: lines.map((l) => l.sourceSalesQuoteLineId).filter((x): x is number => !!x), orderLineIds: lines.map((l) => l.sourceSalesOrderLineId).filter((x): x is number => !!x) });
    }
    case "SALES_INVOICE_CREATED":
    case "TAX_INVOICE_SENT": {
      const lines = await prisma.salesInvoiceLine.findMany({ where: { salesInvoiceId: docId }, select: { sourceSalesQuoteLineId: true, sourceSalesOrderLineId: true, sourceInventoryLineId: true } });
      return quotesOfLines({
        quoteLineIds: lines.map((l) => l.sourceSalesQuoteLineId).filter((x): x is number => !!x),
        orderLineIds: lines.map((l) => l.sourceSalesOrderLineId).filter((x): x is number => !!x),
        inventoryLineIds: lines.map((l) => l.sourceInventoryLineId).filter((x): x is number => !!x),
      });
    }
    default:
      return [];
  }
}

/** شماره‌ی سندِ رویداد (برای تاریخچه) */
export async function docNumberOf(eventKey: string, docId: number): Promise<{ docType: string; docNumber: number | null }> {
  switch (eventKey) {
    case "SALES_QUOTE_APPROVED":
    case "SALES_QUOTE_UNAPPROVED":
      return { docType: "SALES_QUOTE", docNumber: (await prisma.salesQuote.findUnique({ where: { id: docId }, select: { number: true } }))?.number ?? null };
    case "RECEIPT_APPROVED":
      return { docType: "RECEIPT", docNumber: (await prisma.receipt.findUnique({ where: { id: docId }, select: { number: true } }))?.number ?? null };
    case "SALES_DELIVERY_REGISTERED":
      return { docType: "SALES_DELIVERY", docNumber: (await prisma.inventoryDocument.findUnique({ where: { id: docId }, select: { number: true } }))?.number ?? null };
    case "SALES_INVOICE_CREATED":
    case "TAX_INVOICE_SENT":
      return { docType: "SALES_INVOICE", docNumber: (await prisma.salesInvoice.findUnique({ where: { id: docId }, select: { number: true } }))?.number ?? null };
    default:
      return { docType: "UNKNOWN", docNumber: null };
  }
}

/** خلاصه‌ی فقط‌خواندنیِ سندِ ریشه برای کارتابل (ساخته‌ی سرور؛ بدون نیاز به دسترسی فرم‌های ERP) */
export async function rootSummary(rootType: RootType, rootId: number) {
  if (rootType !== "SALES_QUOTE") return null;
  const q = await prisma.salesQuote.findUnique({
    where: { id: rootId },
    include: {
      customer: { select: { party: { select: { detailTitle: true, firstName: true, lastName: true, name: true } } } },
      salesType: { select: { title: true } },
      salesCenter: { select: { title: true } },
      currency: { select: { title: true, decimalPlaces: true } },
      lines: { orderBy: { rowOrder: "asc" }, include: { goodsItem: { select: { title: true } } } },
    },
  });
  if (!q) return null;
  const p = q.customer.party;
  const num = (d: unknown) => Number(d ?? 0);
  const lines = q.lines.map((l: any) => ({ title: l.goodsItem?.title ?? "", quantity: num(l.quantity), unitPrice: num(l.unitPrice), amount: num(l.amount), discount: num(l.discount), vat: num(l.vatAmount) }));
  return {
    kind: "SALES_QUOTE",
    title: `پیش‌فاکتور ${q.number}`,
    fields: [
      { label: "شماره", value: String(q.number) },
      { label: "تاریخ", value: q.date.toISOString().slice(0, 10), isDate: true },
      { label: "مشتری", value: p.detailTitle || [p.firstName, p.lastName].filter(Boolean).join(" ") || p.name || "" },
      { label: "نوع فروش", value: q.salesType.title },
      { label: "مرکز فروش", value: q.salesCenter.title },
      { label: "ارز", value: q.currency.title },
      { label: "وضعیت", value: q.status === "APPROVED" ? "تایید" : "ثبت" },
      ...(q.description ? [{ label: "شرح", value: q.description }] : []),
    ],
    lines,
    total: lines.reduce((a, l) => a + l.amount - l.discount, 0),
    totalVat: lines.reduce((a, l) => a + l.vat, 0),
  };
}
