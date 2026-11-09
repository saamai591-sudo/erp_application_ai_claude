import { prisma } from "../../lib/prisma";
import { findFormPrefix } from "../../authz/registry";
import { pickableSalesOrderLines, pickableSalesQuoteLines } from "../../routes/salesDeliveries";
import { formatJalaliDateForMessage } from "../../utils/jalaliDate";
import { ActionDef, EntityRef } from "../types";
import { basisRef, decodeBasis, KIND_FA, suggestedDate } from "./basis";

// «حواله فروش»: مشتری ← پیدا کردن مبنای قابل‌تحویل (پیش‌فاکتور/سفارش فروش تاییدشده‌ی دارای مانده) با دکمه ← فرم حواله با ردیف‌های مانده پیش‌پر باز می‌شود.
// چیزی ثبت نمی‌شود؛ ردیف‌ها را خودِ فرم حواله با همان انتخابگر مبنای خودش می‌گذارد و ذخیره (با همه‌ی کنترل‌های موجودی و تاریخ) با کاربر است.
// انبار فقط وقتی پیش‌پر می‌شود که یک انبار فعال بیشتر نیست؛ وگرنه در فرم انتخاب می‌شود.

const DELIVERIES = findFormPrefix("sales-deliveries");

interface BasisGroup {
  kind: "ORDER" | "QUOTE";
  id: number;
  number: number;
  date: Date;
  lines: { goodsItemTitle: string; unitTitle: string; remaining: number }[];
}

/** مبناهای قابل‌تحویلِ یک مشتری، قدیمی‌ترین اول (همان تابع‌های انتخابگر فرم حواله) */
async function openBases(customerId: number): Promise<BasisGroup[]> {
  const out: BasisGroup[] = [];
  const quoteLines: any[] = await pickableSalesQuoteLines(customerId, null, null);
  const orderLines: any[] = await pickableSalesOrderLines(customerId, null, null);
  for (const [kind, lines, idKey] of [
    ["QUOTE", quoteLines, "salesQuoteId"],
    ["ORDER", orderLines, "salesOrderId"],
  ] as const) {
    const byId = new Map<number, BasisGroup>();
    for (const l of lines) {
      const id = l[idKey] as number;
      let g = byId.get(id);
      if (!g) byId.set(id, (g = { kind, id, number: l.number, date: new Date(l.date), lines: [] }));
      g.lines.push({ goodsItemTitle: l.goodsItemTitle, unitTitle: l.unitTitle, remaining: l.remaining });
    }
    out.push(...byId.values());
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime() || a.number - b.number);
}

const labelOf = (g: BasisGroup) => `${KIND_FA[g.kind]} ${g.number} (${formatJalaliDateForMessage(g.date)}) — ${g.lines.length} ردیف قابل‌تحویل`;

export const salesDeliveryAction: ActionDef = {
  key: "sales-delivery",
  title: "حواله فروش",
  description: "مبنای قابل‌تحویل مشتری (پیش‌فاکتور یا سفارش فروش) را پیدا می‌کند و فرم حواله را با ردیف‌های مانده پر می‌کند؛ ذخیره با خود شماست.",
  examples: ["حواله برای شرکت پارسیان", "صدور حواله مشتری 1023"],
  permissions: [`${DELIVERIES}.create`],
  slots: [
    { name: "customer", title: "مشتری", type: "customer", required: true, prompt: "حواله برای کدام مشتری است؟ (نام یا کد)" },
    {
      name: "basis",
      title: "مبنا",
      type: "choice",
      required: true,
      prompt: "حواله بر مبنای کدام سند صادر شود؟",
      emptyMessage: "این مشتری پیش‌فاکتور یا سفارش فروش تاییدشده‌ای با مانده‌ی قابل‌تحویل ندارد. (حواله‌ی بدون مبنا را از خود فرم «حواله فروش» بزنید.)",
      choices: async (_ctx, s) => {
        const customer = s.customer as EntityRef | undefined;
        if (!customer || typeof customer.id !== "number") return [];
        return (await openBases(customer.id)).map((g): EntityRef => basisRef(g.kind, g.id, labelOf(g)));
      },
    },
  ],
  async run(_ctx, s) {
    const customer = s.customer as EntityRef;
    const dec = decodeBasis((s.basis as EntityRef).id);
    const group = dec && dec.kind !== "DELIVERY" ? (await openBases(customer.id)).find((g) => g.kind === dec.kind && g.id === dec.id) : null;
    if (!group) return [{ type: "text", text: "این مبنا دیگر قابل‌تحویل نیست یا متعلق به این مشتری نیست؛ دوباره شروع کنید." }];

    const cust = await prisma.customer.findUnique({ where: { id: customer.id }, select: { partyId: true } });
    if (!cust) return [{ type: "text", text: "مشتری یافت نشد." }];
    const warehouses = await prisma.warehouse.findMany({ where: { isActive: true }, select: { id: true, title: true }, take: 2 });
    const warehouse = warehouses.length === 1 ? warehouses[0] : null;

    return [
      { type: "text", text: `حواله برای «${customer.label}» بر مبنای ${KIND_FA[group.kind]} ${group.number} آماده شد${warehouse ? ` — انبار ${warehouse.title}` : "؛ انبار را در فرم انتخاب کنید"}. مقدار ردیف‌ها را در فرم می‌توانید کم کنید.` },
      {
        type: "prefill",
        label: "باز کردن حواله در فرم",
        path: "/sales-deliveries/new",
        payload: { ...(group.kind === "ORDER" ? { orderId: group.id } : { quoteId: group.id }), date: await suggestedDate(group.date), warehouseId: warehouse?.id ?? null, partyId: cust.partyId },
        preview: { columns: ["کالا", "واحد", "مانده‌ی قابل‌تحویل"], rows: group.lines.map((l) => [l.goodsItemTitle, l.unitTitle, l.remaining.toLocaleString("en-US")]) },
      },
    ];
  },
};
