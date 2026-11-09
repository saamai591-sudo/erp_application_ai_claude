import { prisma } from "../../lib/prisma";
import { findFormPrefix } from "../../authz/registry";
import { findEffectivePriceListId, loadItemPricing, computePrice } from "../../services/salesPriceService";
import { getVatRatePercentForDate } from "../../services/accountingSettingsService";
import { computeLineVat, resolveVatRatePercent } from "../../utils/vatCalculation";
import { ActionDef, AssistantContext, Block, EntityRef, LineValue } from "../types";

// «پیش‌فاکتور جدید»: مشتری + اقلام (+ تخفیف درصدی، نوع/مرکز فروش، شرح) ← فرم پیش‌فاکتور با اطلاعات کامل پیش‌پر باز می‌شود و کاربر خودش ذخیره می‌کند
// (چیزی ثبت نمی‌شود). قیمت از اعلامیه‌ی قیمت (همان سرویس فرم)، مالیات با همان قاعده‌ی فرم، نوع/مرکز فروش پیش‌فرض = آخرین پیش‌فاکتور همین کاربر.

const QUOTES = findFormPrefix("sales-quotes");
const round2 = (v: number) => Math.round(v * 100) / 100;
const fmt = (v: number) => v.toLocaleString("en-US");

async function lastQuoteOf(ctx: AssistantContext) {
  return prisma.salesQuote.findFirst({ where: { createdById: ctx.userId }, orderBy: { id: "desc" }, select: { salesTypeId: true, salesCenterId: true, currencyId: true } });
}

export async function defaultOf(ctx: AssistantContext, kind: "type" | "center"): Promise<EntityRef | null> {
  const last = await lastQuoteOf(ctx);
  if (last) {
    if (kind === "type") {
      const t = await prisma.salesType.findUnique({ where: { id: last.salesTypeId }, select: { id: true, title: true } });
      if (t) return { id: t.id, label: t.title };
    } else {
      const c = await prisma.salesCenter.findFirst({ where: { id: last.salesCenterId, isActive: true }, select: { id: true, title: true } });
      if (c) return { id: c.id, label: c.title };
    }
  }
  // فقط یک گزینه‌ی فعال هست ⇒ همان
  if (kind === "type") {
    const all = await prisma.salesType.findMany({ select: { id: true, title: true }, take: 2 });
    return all.length === 1 ? { id: all[0].id, label: all[0].title } : null;
  }
  const all = await prisma.salesCenter.findMany({ where: { isActive: true }, select: { id: true, title: true }, take: 2 });
  return all.length === 1 ? { id: all[0].id, label: all[0].title } : null;
}

export const salesQuoteAction: ActionDef = {
  key: "sales-quote",
  title: "پیش‌فاکتور جدید",
  description: "فرم پیش‌فاکتور را با مشتری و اقلام گفته‌شده پر می‌کند (قیمت از اعلامیه‌ی قیمت)؛ ذخیره با خود شماست.",
  examples: ["پیش‌فاکتور برای شرکت پارسیان، ۱۰ تا کالای X، ۵ تا Y، تخفیف ۱۰ درصد", "پیش فاکتور مشتری 1023 ؛ کالا Z × 4"],
  permissions: [`${QUOTES}.create`],
  slots: [
    { name: "customer", title: "مشتری", type: "customer", required: true, prompt: "پیش‌فاکتور برای کدام مشتری است؟ (نام یا کد)" },
    { name: "lines", title: "اقلام", type: "lines", required: true, prompt: "چه کالاهایی و چند عدد؟ مثلاً «۱۰ تا کالای X، ۵ تا Y»" },
    { name: "salesType", title: "نوع فروش", type: "salesType", required: true, prompt: "نوع فروش کدام است؟", defaultValue: (ctx) => defaultOf(ctx, "type") },
    { name: "salesCenter", title: "مرکز فروش", type: "salesCenter", required: true, prompt: "مرکز فروش کدام است؟", defaultValue: (ctx) => defaultOf(ctx, "center") },
    { name: "discountPercent", title: "تخفیف (درصد)", type: "number" },
    { name: "description", title: "شرح", type: "text" },
  ],
  async run(ctx, s) {
    const customer = s.customer as EntityRef;
    const salesType = s.salesType as EntityRef;
    const salesCenter = s.salesCenter as EntityRef;
    const lines = s.lines as LineValue[];
    const discountPercent = typeof s.discountPercent === "number" ? s.discountPercent : 0;
    const description = typeof s.description === "string" ? s.description : "";

    const last = await lastQuoteOf(ctx);
    const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true }, select: { id: true } });
    const currencyId = last?.currencyId ?? baseCurrency?.id;
    if (!currencyId) return [{ type: "text", text: "ارز پایه تعریف نشده است." }];
    const currency = await prisma.currency.findUnique({ where: { id: currencyId }, select: { decimalPlaces: true } });
    const decimals = currency?.decimalPlaces ?? 2;

    const customerRow = await prisma.customer.findUnique({ where: { id: customer.id }, select: { id: true } });
    if (!customerRow) return [{ type: "text", text: "مشتری یافت نشد." }];

    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);
    const ids = lines.map((l) => l.ref!.id);
    const items = await prisma.goodsItem.findMany({ where: { id: { in: ids } }, include: { mainUnit: { select: { title: true } } } });
    const priceListId = await findEffectivePriceListId({ salesCenterId: salesCenter.id, salesTypeId: salesType.id, currencyId, date: today });
    const pricing = priceListId ? await loadItemPricing(priceListId, ids, decimals) : new Map();
    const vatDefault = await getVatRatePercentForDate(today);

    const rows: Record<string, string>[] = [];
    const preview: string[][] = [];
    const noPrice: string[] = [];
    let total = 0;
    for (const l of lines) {
      const item = items.find((g) => g.id === l.ref!.id);
      if (!item) continue;
      const p = pricing.get(item.id);
      const computed = p ? computePrice(p, l.quantity) : null;
      const unitPrice = computed ? computed.listPrice : null;
      if (unitPrice === null) noPrice.push(item.title);
      const amount = unitPrice === null ? 0 : round2(unitPrice * l.quantity);
      const discount = unitPrice === null ? 0 : round2((amount * discountPercent) / 100);
      const vat = unitPrice === null ? 0 : computeLineVat(amount, discount, resolveVatRatePercent(item as any, vatDefault), decimals);
      total += amount - discount + vat;
      rows.push({
        goodsItemId: String(item.id),
        goodsItemCode: item.fullCode,
        goodsItemTitle: item.title,
        unitId: String(item.mainUnitId),
        unitTitle: item.mainUnit?.title ?? "",
        quantity: String(l.quantity),
        unitPrice: unitPrice === null ? "" : String(unitPrice),
        amount: unitPrice === null ? "" : String(amount),
        discount: unitPrice === null || !discount ? "" : String(discount),
        vatAmount: unitPrice === null ? "" : String(vat),
        description: "",
        listPrice: "",
      });
      preview.push([item.title, fmt(l.quantity), unitPrice === null ? "—" : fmt(unitPrice), unitPrice === null ? "—" : fmt(amount - discount)]);
    }

    const blocks: Block[] = [
      {
        type: "text",
        text: `پیش‌فاکتور برای «${customer.label}» آماده شد — ${salesType.label} / ${salesCenter.label}${discountPercent ? `، تخفیف ${discountPercent}٪` : ""}.${total > 0 ? ` جمع تقریبی با مالیات: ${fmt(Math.round(total))}.` : ""}`,
      },
    ];
    if (noPrice.length) blocks.push({ type: "text", text: `برای این اقلام در اعلامیه‌ی قیمت فی پیدا نشد؛ فی را در فرم وارد کنید: ${noPrice.join("، ")}` });
    blocks.push({
      type: "prefill",
      label: "باز کردن پیش‌فاکتور در فرم",
      path: "/sales-quotes/new",
      payload: { sourceDate: todayIso, validDays: null, customerId: String(customer.id), salesTypeId: String(salesType.id), salesCenterId: String(salesCenter.id), currencyId: String(currencyId), description, rows },
      preview: { columns: ["کالا", "مقدار", "فی", "مبلغ (پس از تخفیف)"], rows: preview },
    });
    return blocks;
  },
};
