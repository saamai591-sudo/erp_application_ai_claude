import { prisma } from "../lib/prisma";
import { withoutFiscalPeriodScope } from "../lib/requestContext";
import { assertRecordNotStale } from "../utils/concurrency";
import { lockQuote } from "./salesQuoteFollowUpService";

// «اصلاح پیش‌فاکتور» (پیش‌فاکتور تاییدشده بدون برگشت از تایید): فقط ردیف‌ها قابل تغییرند، سرصفحه هرگز.
// قاعده‌ی تغییرناپذیری در سطح ردیف: ردیفی که گردش ردیفی دارد (سفارش، حواله مستقیم، فاکتور مستقیم یا مقدار بسته‌شده) کاملاً قفل است — نه ویرایش و نه حذف؛
// ردیف بدون گردش آزاد است (کالا، مقدار، فی، تخفیف، حذف) و ردیف جدید هم می‌شود اضافه کرد. رسید پیش‌دریافت گردش ردیف نیست (به هدر وصل است).
// هر اصلاحیه شماره می‌گیرد و عکس کامل ردیف‌ها (SalesQuoteRevision.snapshot) و خلاصه‌ی تغییر و دلیل را نگه می‌دارد؛ نسخه‌ی ۰ = وضعیت قبل از اولین اصلاحیه.
// تنها محل این منطق؛ اعتبارسنجی ردیف‌های آزاد همان validateSalesQuoteLines فرم پیش‌فاکتور است (از مسیر به‌صورت تابع داده می‌شود تا وابستگی حلقوی نشود).

export class QuoteAmendError extends Error {}

const EPS = 1e-6;
const fail = (m: string): never => {
  throw new QuoteAmendError(m);
};

export interface AmendLineInput {
  id?: number | null;
  goodsItemId: number;
  unitId?: number | null;
  quantity: number;
  unitPrice: number;
  amount: number;
  discount?: number;
  vatAmount?: number;
  description?: string | null;
}

export interface AmendBody {
  reason?: string;
  updatedAt?: string;
  lines: AmendLineInput[];
}

export interface AmendDeps {
  validateLines: (lines: any[], docDate: Date, decimalPlaces: number, pricing: any, rowNumbers: number[]) => Promise<any[]>;
}

/** گردش ردیفی هر ردیف: عنوان فارسی انواع گردش (خالی = آزاد). closedQuantity هم گردش حساب می‌شود */
export async function quoteLineCirculation(lines: { id: number; closedQuantity: any }[], db: any = prisma): Promise<Map<number, string[]>> {
  const out = new Map<number, string[]>(lines.map((l) => [l.id, []]));
  if (!lines.length) return out;
  const ids = lines.map((l) => l.id);
  const [orders, docs, invoices] = await withoutFiscalPeriodScope(() =>
    Promise.all([
      db.salesOrderLine.groupBy({ by: ["sourceSalesQuoteLineId"], where: { sourceSalesQuoteLineId: { in: ids } }, _count: true }),
      db.inventoryDocumentLine.groupBy({ by: ["sourceSalesQuoteLineId"], where: { sourceSalesQuoteLineId: { in: ids } }, _count: true }),
      // فاکتور باطل‌شده هم هنوز به ردیف ارجاع دارد
      db.salesInvoiceLine.groupBy({ by: ["sourceSalesQuoteLineId"], where: { sourceSalesQuoteLineId: { in: ids } }, _count: true }),
    ])
  );
  const mark = (rows: any[], label: string) => {
    for (const r of rows) out.get(r.sourceSalesQuoteLineId)?.push(label);
  };
  mark(orders, "سفارش فروش");
  mark(docs, "حواله فروش");
  mark(invoices, "فاکتور فروش");
  for (const l of lines) if (Number(l.closedQuantity ?? 0) > EPS) out.get(l.id)!.push("مقدار بسته‌شده");
  return out;
}

interface SnapLine {
  id: number;
  rowOrder: number;
  goodsItemId: number;
  goodsItemCode: string;
  goodsItemTitle: string;
  unitId: number;
  unitTitle: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  discount: number;
  vatAmount: number;
  description: string | null;
}

function snapLines(lines: any[]): SnapLine[] {
  return lines
    .slice()
    .sort((a, b) => a.rowOrder - b.rowOrder || a.id - b.id)
    .map((l) => ({
      id: l.id,
      rowOrder: l.rowOrder,
      goodsItemId: l.goodsItemId,
      goodsItemCode: l.goodsItem.fullCode,
      goodsItemTitle: l.goodsItem.title,
      unitId: l.unitId,
      unitTitle: l.unit.title,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      amount: Number(l.amount),
      discount: Number(l.discount),
      vatAmount: Number(l.vatAmount),
      description: l.description ?? null,
    }));
}

export function snapshotTotals(lines: SnapLine[]) {
  const amount = lines.reduce((s, l) => s + l.amount, 0);
  const discount = lines.reduce((s, l) => s + l.discount, 0);
  const vat = lines.reduce((s, l) => s + l.vatAmount, 0);
  return { amount, discount, afterDiscount: amount - discount, vat, payable: amount - discount + vat };
}

const fmt = (n: number) => (Math.round(n * 1e6) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 6 });

/** خلاصه‌ی تغییر نسبت به نسخه‌ی قبل (ردیف‌ها با شناسه تطبیق می‌خورند) */
function diffSummary(before: SnapLine[], after: SnapLine[]): string[] {
  const out: string[] = [];
  const b = new Map(before.map((l) => [l.id, l]));
  const a = new Map(after.map((l) => [l.id, l]));
  before.forEach((l, i) => {
    if (!a.has(l.id)) out.push(`ردیف ${i + 1} حذف شد: ${l.goodsItemTitle} × ${fmt(l.quantity)}`);
  });
  after.forEach((l, i) => {
    const o = b.get(l.id);
    if (!o) return void out.push(`ردیف ${i + 1} افزوده شد: ${l.goodsItemTitle} × ${fmt(l.quantity)}`);
    const parts: string[] = [];
    if (o.goodsItemId !== l.goodsItemId) parts.push(`کالا از «${o.goodsItemTitle}» به «${l.goodsItemTitle}»`);
    if (Math.abs(o.quantity - l.quantity) > EPS) parts.push(`مقدار از ${fmt(o.quantity)} به ${fmt(l.quantity)}`);
    if (Math.abs(o.unitPrice - l.unitPrice) > EPS) parts.push(`فی از ${fmt(o.unitPrice)} به ${fmt(l.unitPrice)}`);
    if (Math.abs(o.discount - l.discount) > EPS) parts.push(`تخفیف از ${fmt(o.discount)} به ${fmt(l.discount)}`);
    if ((o.description ?? "") !== (l.description ?? "")) parts.push("شرح");
    if (parts.length) out.push(`ردیف ${i + 1}: ${parts.join("، ")}`);
  });
  return out;
}

const same = (x: unknown, y: unknown) => Math.abs(Number(x ?? 0) - Number(y ?? 0)) <= EPS * Math.max(1, Math.abs(Number(y ?? 0)));

/** ردیف قفل‌شده باید دقیقاً همان ذخیره‌شده باشد */
function assertFrozenUnchanged(n: number, stored: any, input: AmendLineInput) {
  const bad =
    Number(input.goodsItemId) !== stored.goodsItemId ||
    (input.unitId && Number(input.unitId) !== stored.unitId) ||
    !same(input.quantity, stored.quantity) ||
    !same(input.unitPrice, stored.unitPrice) ||
    !same(input.amount, stored.amount) ||
    !same(input.discount, stored.discount) ||
    (input.vatAmount !== undefined && input.vatAmount !== null && !same(input.vatAmount, stored.vatAmount)) ||
    String(input.description ?? "").trim() !== String(stored.description ?? "").trim();
  if (bad) fail(`ردیف ${n} گردش دارد و قابل تغییر نیست`);
}

export async function amendSalesQuote(quoteId: number, body: AmendBody, userId: number | null, deps: AmendDeps) {
  const reason = String(body?.reason ?? "").trim();
  if (!reason) fail("دلیل اصلاحیه را وارد کنید");
  if (reason.length > 500) fail("دلیل اصلاحیه حداکثر ۵۰۰ نویسه است");
  if (!Array.isArray(body?.lines) || body.lines.length === 0) fail("پیش‌فاکتور باید حداقل یک ردیف داشته باشد");

  return withoutFiscalPeriodScope(() =>
    prisma.$transaction(async (tx) => {
      await lockQuote(tx, quoteId);
      const quote = await tx.salesQuote.findUnique({
        where: { id: quoteId },
        include: { currency: true, lines: { include: { goodsItem: true, unit: true }, orderBy: [{ rowOrder: "asc" }, { id: "asc" }] } },
      });
      if (!quote) return fail("پیش‌فاکتور یافت نشد");
      if (quote!.status !== "APPROVED") fail("اصلاحیه فقط برای پیش‌فاکتور تاییدشده است؛ پیش‌فاکتور ثبت‌شده را مستقیم ویرایش کنید");
      if (quote!.followUpClosedAt) fail("پیگیری این پیش‌فاکتور بسته شده است؛ ابتدا پیگیری را بازگشایی کنید");
      assertRecordNotStale(quote!.updatedAt, body.updatedAt, "این پیش‌فاکتور");

      const stored = new Map<number, any>(quote!.lines.map((l: any) => [l.id, l]));
      const circulation = await quoteLineCirculation(quote!.lines, tx);
      const frozenIds = new Set(quote!.lines.filter((l: any) => (circulation.get(l.id) ?? []).length > 0).map((l: any) => l.id));

      // شناسه‌ها: فقط ردیف‌های همین پیش‌فاکتور، بدون تکرار؛ هر ردیف قفل‌شده باید باشد (حذفش ممنوع) و دست‌نخورده
      const seen = new Set<number>();
      body.lines.forEach((l, i) => {
        if (!l.id) return;
        const id = Number(l.id);
        if (!stored.has(id)) fail(`ردیف ${i + 1} به این پیش‌فاکتور تعلق ندارد`);
        if (seen.has(id)) fail(`ردیف ${i + 1} تکراری است`);
        seen.add(id);
        if (frozenIds.has(id)) assertFrozenUnchanged(i + 1, stored.get(id), l);
      });
      for (const l of quote!.lines) {
        if (frozenIds.has(l.id) && !seen.has(l.id)) {
          const n = quote!.lines.findIndex((x: any) => x.id === l.id) + 1;
          fail(`ردیف ${n} (${l.goodsItem.title}) گردش دارد (${(circulation.get(l.id) ?? []).join("، ")}) و قابل حذف نیست`);
        }
      }

      // ردیف‌های آزاد (موجود و جدید) با همان اعتبارسنجی فرم پیش‌فاکتور؛ مرجع قیمت ردیف‌های بدون تغییر کالا/مقدار حفظ می‌شود
      const freeIdx: number[] = [];
      body.lines.forEach((l, i) => {
        if (!l.id || !frozenIds.has(Number(l.id))) freeIdx.push(i);
      });
      const keepFrom = quote!.lines
        .filter((l: any) => !frozenIds.has(l.id))
        .map((l: any) => ({ goodsItemId: l.goodsItemId, quantity: Number(l.quantity), basePrice: l.basePrice === null ? null : Number(l.basePrice), listPrice: l.listPrice === null ? null : Number(l.listPrice), priceListId: l.priceListId, priceRuleId: l.priceRuleId }));
      const cleaned = freeIdx.length
        ? await deps.validateLines(
            freeIdx.map((i) => body.lines[i]),
            quote!.date,
            quote!.currency.decimalPlaces,
            { salesCenterId: quote!.salesCenterId, salesTypeId: quote!.salesTypeId, currencyId: quote!.currencyId, keepFrom },
            freeIdx.map((i) => i + 1),
          )
        : [];
      const cleanedByIndex = new Map<number, any>(freeIdx.map((i, k) => [i, cleaned[k]]));

      const beforeSnap = snapLines(quote!.lines);

      // حذف ردیف‌های آزادِ حذف‌شده، به‌روزرسانی/ساخت بقیه؛ ردیف قفل‌شده فقط ترتیبش به‌روز می‌شود
      const removed = quote!.lines.filter((l: any) => !frozenIds.has(l.id) && !seen.has(l.id)).map((l: any) => l.id);
      if (removed.length) await tx.salesQuoteLine.deleteMany({ where: { id: { in: removed } } });
      for (const [i, l] of body.lines.entries()) {
        const id = l.id ? Number(l.id) : 0;
        if (id && frozenIds.has(id)) {
          await tx.salesQuoteLine.update({ where: { id }, data: { rowOrder: i } });
        } else if (id) {
          await tx.salesQuoteLine.update({ where: { id }, data: { ...cleanedByIndex.get(i), rowOrder: i } });
        } else {
          await tx.salesQuoteLine.create({ data: { ...cleanedByIndex.get(i), salesQuoteId: quoteId, rowOrder: i } });
        }
      }

      const afterLines = await tx.salesQuoteLine.findMany({ where: { salesQuoteId: quoteId }, include: { goodsItem: true, unit: true }, orderBy: [{ rowOrder: "asc" }, { id: "asc" }] });
      const afterSnap = snapLines(afterLines);
      const changes = diffSummary(beforeSnap, afterSnap);
      if (changes.length === 0) fail("هیچ تغییری نسبت به پیش‌فاکتور فعلی ثبت نشده است");

      // نسخه‌ی ۰ = وضعیت قبل از اولین اصلاحیه (عکس کامل همان چیزی که مشتری گرفته بود)
      const existingRev = await tx.salesQuoteRevision.count({ where: { salesQuoteId: quoteId } });
      if (existingRev === 0) await tx.salesQuoteRevision.create({ data: { salesQuoteId: quoteId, number: 0, createdById: null, reason: null, snapshot: { lines: beforeSnap, totals: snapshotTotals(beforeSnap) } as any, changes: [] } });
      const number = quote!.amendmentNumber + 1;
      await tx.salesQuoteRevision.create({ data: { salesQuoteId: quoteId, number, createdById: userId, reason, snapshot: { lines: afterSnap, totals: snapshotTotals(afterSnap) } as any, changes: changes as any } });
      await tx.salesQuote.update({ where: { id: quoteId }, data: { amendmentNumber: number } });

      const prev = snapshotTotals(beforeSnap).payable;
      const next = snapshotTotals(afterSnap).payable;
      let warning: string | null = null;
      if (next < prev - EPS) {
        const receipts = await tx.receiptSettlementLine.count({ where: { salesQuoteId: quoteId } });
        if (receipts > 0) warning = "مبلغ پیش‌فاکتور کاهش یافت و برای آن دریافت ثبت شده است؛ مانده‌ی دریافت‌ها را بررسی کنید";
      }
      return { id: quoteId, amendmentNumber: number, previousTotal: prev, newTotal: next, warning };
    }),
  );
}

/** فهرست اصلاحیه‌ها (کم‌حجم: بدون عکس کامل) */
export async function listRevisions(quoteId: number) {
  const rows = await prisma.salesQuoteRevision.findMany({ where: { salesQuoteId: quoteId }, orderBy: { number: "asc" }, include: { createdBy: { select: { firstName: true, lastName: true } } } });
  return rows.map((r: any) => ({
    number: r.number,
    createdAt: r.createdAt,
    createdBy: r.createdBy ? `${r.createdBy.firstName ?? ""} ${r.createdBy.lastName ?? ""}`.trim() : null,
    reason: r.reason,
    changes: r.changes as string[],
    totals: (r.snapshot as any)?.totals ?? null,
  }));
}

export async function getRevision(quoteId: number, number: number) {
  const r = await prisma.salesQuoteRevision.findUnique({ where: { salesQuoteId_number: { salesQuoteId: quoteId, number } }, include: { createdBy: { select: { firstName: true, lastName: true } } } });
  if (!r) return null;
  return { number: r.number, createdAt: r.createdAt, createdBy: r.createdBy ? `${r.createdBy.firstName ?? ""} ${r.createdBy.lastName ?? ""}`.trim() : null, reason: r.reason, changes: r.changes as string[], snapshot: r.snapshot };
}
