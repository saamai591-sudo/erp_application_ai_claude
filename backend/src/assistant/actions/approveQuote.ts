import { prisma } from "../../lib/prisma";
import { findFormPrefix } from "../../authz/registry";
import { approveSalesQuote, QuoteApproveError } from "../../routes/salesOperations";
import { formatJalaliDateForMessage } from "../../utils/jalaliDate";
import { ActionDef, EntityRef } from "../types";

// «تایید پیش‌فاکتور»: دومین کار «ثبتی» دستیار (بعد از مشتری جدید) — فقط وضعیت ثبت ← تایید. مشخص کردن پیش‌فاکتور با شماره، مشتری یا انتخاب از بین پیش‌فاکتورهای ثبت‌شده؛
// تایید فقط با کلیک کاربر روی دکمه‌ی «تایید پیش‌فاکتور» انجام می‌شود و از همان تابع route (approveSalesQuote: وضعیت، بسته‌بودن پیگیری، رویداد کارتابل) می‌گذرد.

const QUOTES = findFormPrefix("sales-quotes");
const fmt = (v: number) => v.toLocaleString("en-US");

const customerTitle = (p: { detailTitle: string | null; name: string | null; firstName: string | null; lastName: string | null }) => p.detailTitle || p.name || `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim();

/** پیش‌فاکتورهای «ثبت»‌شده‌ی قابل‌تایید (پیگیری باز)، جدیدترین اول؛ با شماره و/یا مشتری محدود می‌شود */
async function approvable(s: Record<string, any>) {
  const num = typeof s.quoteNumber === "string" && /^\d+$/.test(s.quoteNumber.trim()) ? Number(s.quoteNumber.trim()) : null;
  const customer = s.customer as EntityRef | undefined;
  return prisma.salesQuote.findMany({
    where: { status: "DRAFT", followUpClosedAt: null, ...(num !== null ? { number: num } : {}), ...(customer && typeof customer.id === "number" ? { customerId: customer.id } : {}) },
    include: { customer: { select: { party: { select: { detailTitle: true, name: true, firstName: true, lastName: true } } } }, lines: { select: { amount: true, discount: true, vatAmount: true } } },
    orderBy: [{ date: "desc" }, { number: "desc" }],
    take: 8,
  });
}

const netOf = (q: { lines: { amount: unknown; discount: unknown; vatAmount: unknown }[] }) => q.lines.reduce((t, l) => t + Number(l.amount ?? 0) - Number(l.discount ?? 0) + Number(l.vatAmount ?? 0), 0);

export const approveQuoteAction: ActionDef = {
  key: "approve-quote",
  title: "تایید پیش‌فاکتور",
  description: "پیش‌فاکتورِ ثبت‌شده را (با شماره یا مشتری) پیدا می‌کند و پس از دکمه‌ی تایید شما آن را تایید می‌کند.",
  examples: ["تایید پیش‌فاکتور 131", "تایید پیش‌فاکتور برای شرکت پارسیان"],
  permissions: [`${QUOTES}.approve`],
  slots: [
    { name: "customer", title: "مشتری", type: "customer" },
    { name: "quoteNumber", title: "شماره پیش‌فاکتور", type: "text" },
    {
      name: "quote",
      title: "پیش‌فاکتور",
      type: "choice",
      required: true,
      prompt: "کدام پیش‌فاکتور تایید شود؟",
      emptyMessage: "پیش‌فاکتورِ ثبت‌شده‌ی قابل‌تایید (با این شماره/مشتری) پیدا نشد. فقط پیش‌فاکتور در وضعیت «ثبت» که پیگیری‌اش بسته نشده تایید می‌شود.",
      choices: async (_ctx, s) =>
        (await approvable(s)).map((q): EntityRef => ({ id: q.id, label: `پیش‌فاکتور ${q.number} — ${customerTitle(q.customer.party)} (${formatJalaliDateForMessage(q.date)}) — ${fmt(Math.round(netOf(q)))}` })),
    },
  ],
  async run() {
    return [];
  },
  async preview(_ctx, s) {
    const quote = s.quote as EntityRef;
    const row = await prisma.salesQuote.findFirst({
      where: { id: quote.id, status: "DRAFT", followUpClosedAt: null },
      include: { customer: { select: { party: { select: { detailTitle: true, name: true, firstName: true, lastName: true } } } }, lines: { select: { amount: true, discount: true, vatAmount: true } } },
    });
    if (!row) return { blocks: [{ type: "text", text: "این پیش‌فاکتور دیگر قابل‌تایید نیست (تایید شده، پیگیری بسته شده یا حذف شده)." }], error: "stale" };
    return {
      blocks: [
        { type: "text", text: "این پیش‌فاکتور تایید شود؟ پس از تایید قابل ویرایش نیست." },
        {
          type: "confirm",
          label: "تایید پیش‌فاکتور",
          summary: [
            { label: "شماره", value: String(row.number) },
            { label: "مشتری", value: customerTitle(row.customer.party) },
            { label: "تاریخ", value: formatJalaliDateForMessage(row.date) },
            { label: "مبلغ کل (با مالیات)", value: fmt(Math.round(netOf(row))) },
            { label: "تعداد ردیف", value: String(row.lines.length) },
          ],
        },
      ],
    };
  },
  async execute(ctx, s) {
    if (!(await ctx.can(`${QUOTES}.approve`))) return { blocks: [{ type: "text", text: "دسترسی تایید پیش‌فاکتور را ندارید." }] };
    const quote = s.quote as EntityRef;
    try {
      await approveSalesQuote(quote.id);
    } catch (e: any) {
      if (e instanceof QuoteApproveError) return { blocks: [{ type: "text", text: `تایید نشد: ${e.message}` }] };
      throw e;
    }
    const q = await prisma.salesQuote.findUnique({ where: { id: quote.id }, select: { number: true } });
    return { blocks: [{ type: "text", text: `پیش‌فاکتور ${q?.number ?? ""} تایید شد.` }], result: { id: quote.id, label: `پیش‌فاکتور ${q?.number ?? ""}` } };
  },
};
