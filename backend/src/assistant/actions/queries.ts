import { prisma } from "../../lib/prisma";
import { findFormPrefix } from "../../authz/registry";
import { getStockAnalysis } from "../../services/stockAnalysisService";
import { invoiceTotalForList, TAX_INVOICE_INCLUDE } from "../../services/taxInvoiceBuilder";
import { formatJalaliDateForMessage } from "../../utils/jalaliDate";
import { ActionDef, EntityRef } from "../types";

// دستورهای فقط‌خواندنی (بدون هیچ نوشتن): موجودی کالا، آخرین فاکتورهای یک مشتری.

const fmt = (v: number) => v.toLocaleString("en-US");

export const stockAction: ActionDef = {
  key: "stock",
  title: "موجودی کالا",
  description: "موجودی فعلی، در راه، تعهدشده و در دسترس یک کالا (همه‌ی انبارها).",
  examples: ["موجودی کالای X", "چقدر کالای 1005 داریم"],
  permissions: [`${findFormPrefix("stock-analysis")}.view`],
  slots: [{ name: "item", title: "کالا", type: "goodsItem", required: true, prompt: "موجودی کدام کالا؟ (نام، کد یا بارکد)" }],
  async run(_ctx, s) {
    const item = s.item as EntityRef;
    const rows = await getStockAnalysis();
    const r = rows.find((x) => x.id === item.id);
    if (!r) return [{ type: "text", text: `«${item.label}» کالا نیست یا موجودی ندارد (آنالیز موجودی فقط کالاها را دارد).` }];
    return [
      { type: "text", text: `موجودی «${r.title}» (${r.unit}):` },
      { type: "table", columns: ["موجودی", "در راه", "تعهدشده", "در دسترس"], rows: [[fmt(r.stock), fmt(r.inTransit), fmt(r.committed), fmt(r.available)]] },
    ];
  },
};

export const customerInvoicesAction: ActionDef = {
  key: "customer-invoices",
  title: "آخرین فاکتورهای مشتری",
  description: "پنج فاکتور فروش آخر یک مشتری در دوره‌ی مالی جاری.",
  examples: ["آخرین فاکتورهای مشتری پارسیان", "فاکتور مشتری 1023"],
  permissions: [`${findFormPrefix("sales-invoices")}.view`],
  slots: [{ name: "customer", title: "مشتری", type: "customer", required: true, prompt: "فاکتورهای کدام مشتری؟ (نام یا کد)" }],
  async run(_ctx, s) {
    const customer = s.customer as EntityRef;
    const list = await prisma.salesInvoice.findMany({ where: { customerId: customer.id, status: { not: "VOIDED" } }, include: TAX_INVOICE_INCLUDE, orderBy: [{ date: "desc" }, { number: "desc" }], take: 5 });
    if (!list.length) return [{ type: "text", text: `برای «${customer.label}» در دوره‌ی مالی جاری فاکتوری نیست.` }];
    return [
      { type: "text", text: `آخرین فاکتورهای «${customer.label}»:` },
      { type: "table", columns: ["شماره", "تاریخ", "مبلغ کل"], rows: list.map((i) => [String(i.number), formatJalaliDateForMessage(i.date), fmt(Math.round(invoiceTotalForList(i)))]) },
    ];
  },
};
