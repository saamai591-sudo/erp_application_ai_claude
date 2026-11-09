import { prisma } from "../../lib/prisma";
import { findFormPrefix } from "../../authz/registry";
import { basisDocumentLines, deliveryInvoiceInfo } from "../../routes/salesInvoices";
import { formatJalaliDateForMessage } from "../../utils/jalaliDate";
import { ActionDef, AssistantContext, EntityRef } from "../types";
import { basisRef, BasisKind, decodeBasis, KIND_FA, suggestedDate } from "./basis";
import { defaultOf } from "./salesQuote";

// «فاکتور فروش»: مشتری ← پیدا کردن مبنای قابل‌صورتحساب (حواله‌ی دارای مانده، یا سفارش/پیش‌فاکتور تاییدشده‌ی دارای ردیف خدمتِ مانده) با دکمه ← فرم فاکتور با
// ردیف‌های مانده پیش‌پر باز می‌شود. چیزی ثبت نمی‌شود؛ ردیف‌ها را خودِ فرم فاکتور با همان انتخابگر مبنای خودش می‌گذارد (قیمت از مبنا قفل می‌شود) و ذخیره با کاربر است.
// نوع/مرکز فروش و ارز از خودِ سند مبنا می‌آید (فاکتور باید با مبنا یکی باشد)؛ حواله‌ی بدون سفارش/پیش‌فاکتور پیش‌فرض‌های کاربر را می‌گیرد.

const INVOICES = findFormPrefix("sales-invoices");
const MAX_DOCS = 30;

interface Candidate {
  kind: BasisKind;
  id: number;
  number: number;
  date: Date;
  lines: { goodsItemTitle: string; unitTitle: string; remaining: number }[];
  header: { salesTypeId: number | null; salesCenterId: number | null; currencyId: number | null };
}

async function candidatesOf(customerId: number): Promise<Candidate[]> {
  const out: Candidate[] = [];
  const cust = await prisma.customer.findUnique({ where: { id: customerId }, select: { party: { select: { detailCode: true } } } });
  if (!cust) return out;
  const brief = (rows: { goodsItemTitle: string; unitTitle: string; remaining: number }[]) => rows.map((l) => ({ goodsItemTitle: l.goodsItemTitle, unitTitle: l.unitTitle, remaining: l.remaining }));

  const deliveries = await prisma.inventoryDocument.findMany({
    where: { documentType: "SALES_DELIVERY", detailCode: cust.party.detailCode },
    select: { id: true, number: true, date: true },
    orderBy: [{ date: "desc" }, { number: "desc" }],
    take: MAX_DOCS,
  });
  for (const d of deliveries) {
    // eslint-disable-next-line no-await-in-loop
    const info = await deliveryInvoiceInfo(d.id);
    if (!info || info.reason || info.customerId !== customerId) continue;
    out.push({ kind: "DELIVERY", id: d.id, number: d.number, date: d.date, lines: brief(info.remainingLines), header: info.base ?? { salesTypeId: null, salesCenterId: null, currencyId: null } });
  }
  for (const [kind, model] of [["ORDER", prisma.salesOrder], ["QUOTE", prisma.salesQuote]] as const) {
    const docs: any[] = await (model as any).findMany({
      where: { customerId, status: "APPROVED" },
      select: { id: true, number: true, date: true, salesTypeId: true, salesCenterId: true, currencyId: true },
      orderBy: [{ date: "desc" }, { number: "desc" }],
      take: MAX_DOCS,
    });
    for (const d of docs) {
      // eslint-disable-next-line no-await-in-loop
      const lines = (await basisDocumentLines(kind === "ORDER" ? "SALES_ORDER" : "SALES_QUOTE", d.id)).filter((l) => l.remaining > 0);
      if (!lines.length) continue;
      out.push({ kind, id: d.id, number: d.number, date: d.date, lines: brief(lines), header: { salesTypeId: d.salesTypeId, salesCenterId: d.salesCenterId, currencyId: d.currencyId } });
    }
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime() || a.number - b.number);
}

const labelOf = (c: Candidate) => `${KIND_FA[c.kind]} ${c.number} (${formatJalaliDateForMessage(c.date)}) — ${c.lines.length} ردیف قابل‌صدور فاکتور`;

async function invoiceHeader(ctx: AssistantContext, c: Candidate) {
  const base = await prisma.currency.findFirst({ where: { isBase: true }, select: { id: true } });
  const currencyId = c.header.currencyId ?? base?.id ?? null;
  const salesTypeId = c.header.salesTypeId ?? (await defaultOf(ctx, "type"))?.id ?? null;
  const salesCenterId = c.header.salesCenterId ?? (await defaultOf(ctx, "center"))?.id ?? null;
  return { salesTypeId, salesCenterId, currencyId, foreign: !!currencyId && currencyId !== base?.id };
}

export const salesInvoiceAction: ActionDef = {
  key: "sales-invoice",
  title: "فاکتور فروش",
  description: "مبنای قابل‌صورتحساب مشتری (حواله، یا سفارش/پیش‌فاکتور دارای خدمت) را پیدا می‌کند و فرم فاکتور را با ردیف‌های مانده پر می‌کند؛ ذخیره با خود شماست.",
  examples: ["ثبت فاکتور برای شرکت پارسیان", "فاکتور جدید مشتری 1023"],
  permissions: [`${INVOICES}.create`],
  slots: [
    { name: "customer", title: "مشتری", type: "customer", required: true, prompt: "فاکتور برای کدام مشتری است؟ (نام یا کد)" },
    {
      name: "basis",
      title: "مبنا",
      type: "choice",
      required: true,
      prompt: "فاکتور بر مبنای کدام سند صادر شود؟",
      emptyMessage: "این مشتری حواله، سفارش یا پیش‌فاکتورِ دارای مانده‌ی قابل‌صورتحساب ندارد. (فاکتور خدمتِ بدون مبنا را از خود فرم «فاکتور فروش» بزنید.)",
      choices: async (_ctx, s) => {
        const customer = s.customer as EntityRef | undefined;
        if (!customer || typeof customer.id !== "number") return [];
        return (await candidatesOf(customer.id)).map((c): EntityRef => basisRef(c.kind, c.id, labelOf(c)));
      },
    },
  ],
  async run(ctx, s) {
    const customer = s.customer as EntityRef;
    const dec = decodeBasis((s.basis as EntityRef).id);
    const cand = dec ? (await candidatesOf(customer.id)).find((c) => c.kind === dec.kind && c.id === dec.id) : null;
    if (!cand) return [{ type: "text", text: "این مبنا دیگر قابل‌صورتحساب نیست یا متعلق به این مشتری نیست؛ دوباره شروع کنید." }];

    const h = await invoiceHeader(ctx, cand);
    const notes: string[] = [];
    if (!h.salesTypeId || !h.salesCenterId) notes.push("نوع/مرکز فروش را در فرم انتخاب کنید.");
    if (h.foreign) notes.push("ارز این مبنا ارزی است؛ نرخ ارز را در فرم وارد کنید.");

    return [
      { type: "text", text: `فاکتور برای «${customer.label}» بر مبنای ${KIND_FA[cand.kind]} ${cand.number} آماده شد. ${notes.join(" ")}`.trim() },
      {
        type: "prefill",
        label: "باز کردن فاکتور در فرم",
        path: "/sales-invoices/new",
        payload: {
          basis: cand.kind === "DELIVERY" ? "SALES_DELIVERY" : cand.kind === "ORDER" ? "SALES_ORDER" : "SALES_QUOTE",
          documentId: cand.id,
          date: await suggestedDate(cand.date),
          customerId: customer.id,
          salesTypeId: h.salesTypeId,
          salesCenterId: h.salesCenterId,
          currencyId: h.currencyId,
          fxRate: "",
        },
        preview: { columns: ["کالا / خدمت", "واحد", "مانده‌ی قابل‌صورتحساب"], rows: cand.lines.map((l) => [l.goodsItemTitle, l.unitTitle, l.remaining.toLocaleString("en-US")]) },
      },
    ];
  },
};
