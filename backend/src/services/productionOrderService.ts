import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { assertDateWithinCurrentFiscalPeriod } from "../utils/fiscalPeriodValidation";
import { activeBomFor, assertLineBom, requiredComponents } from "./bomService";
import { D, fail, isProducedType, isoDay, num, parseDay, positive } from "./productionCommon";

// دستور تولید: مرکز هزینه‌ی بهای تمام‌شده. اتصال به ردیف سفارش فروش/پیش‌فاکتور = تولید سفارشی؛ بدون اتصال = برای انبار.
//  • ردیف‌های دستور کپیِ قابل‌ویرایش از BOM هستند (BOM سفارشی)؛ بدون BOM هم می‌توان دستور ساخت.
//  • وضعیت‌ها: DRAFT (ویرایش کامل) ← RELEASED (اسناد انبار فقط به دستور صادرشده وصل می‌شوند) ← CLOSED.
//  • فرمول ساخت را کاربر صریح انتخاب می‌کند (یک کالا هم‌زمان چند فرمول فعال دارد؛ همان قاعده‌ی آمار تولید)؛ بدون انتخاب و بدون اجزا = جدیدترین فرمول فعال.
//  • بعد از «صدور»: کالای خروجی، فرمول و اجزا قفل می‌شوند؛ فقط مقدار دستور (نه کمتر از تولیدشده‌ی تا حالا؛ اجزا متناسب تغییر می‌کنند)،
//    تاریخ‌های برنامه‌ای، توضیح و اتصال به فروش قابل ویرایش‌اند. تغییر فرمول/اجزا = «برگشت به پیش‌نویس» (فقط وقتی سند، آمار و محاسبه‌ای ندارد).

export const ORDER_INCLUDE = {
  outputItem: { select: { id: true, fullCode: true, title: true, mainUnit: { select: { title: true } } } },
  bom: { select: { id: true, number: true, effectiveDate: true } },
  parentOrder: { select: { id: true, number: true } },
  lines: { include: { componentItem: { select: { id: true, fullCode: true, title: true, mainUnit: { select: { title: true } } } } }, orderBy: { id: "asc" as const } },
  salesOrderLine: { include: { salesOrder: { select: { id: true, number: true, customer: { select: { party: { select: { detailTitle: true } } } } } } } },
  salesQuoteLine: { include: { salesQuote: { select: { id: true, number: true, customer: { select: { party: { select: { detailTitle: true } } } } } } } },
} as const;

/** مقدار تولیدشده (آمار تولید) و مصرف‌شده‌ی خالص (مصرف منهای برگشت مصرف؛ فقط اسنادی که به دستور وصل‌اند) هر دستور */
export async function orderQuantities(orderIds: number[]) {
  const produced = new Map<number, number>();
  const consumed = new Map<number, Map<number, number>>(); // orderId → item → qty
  if (!orderIds.length) return { produced, consumed };
  const stats = await prisma.productionStatLine.groupBy({ by: ["productionOrderId"], where: { productionOrderId: { in: orderIds }, stat: { status: "CONFIRMED" } }, _sum: { quantity: true } });
  for (const r of stats) if (r.productionOrderId) produced.set(r.productionOrderId, num(r._sum.quantity));
  const rows = await prisma.inventoryDocumentLine.findMany({
    where: { document: { productionOrderId: { in: orderIds }, documentType: { in: ["PRODUCTION_CONSUMPTION", "PRODUCTION_CONSUMPTION_RETURN"] } } },
    select: { goodsItemId: true, quantity: true, document: { select: { productionOrderId: true, documentType: true } } },
  });
  for (const r of rows) {
    const oid = r.document.productionOrderId!;
    const q = num(r.quantity);
    const m = consumed.get(oid) ?? new Map<number, number>();
    m.set(r.goodsItemId, (m.get(r.goodsItemId) ?? 0) + (r.document.documentType === "PRODUCTION_CONSUMPTION" ? q : -q));
    consumed.set(oid, m);
  }
  return { produced, consumed };
}

export function orderShape(o: any, producedQty = 0, consumedByItem?: Map<number, number>, docCount = 0) {
  const so = o.salesOrderLine?.salesOrder;
  const sq = o.salesQuoteLine?.salesQuote;
  return {
    id: o.id,
    number: o.number,
    date: isoDay(o.date),
    outputItemId: o.outputItemId,
    outputItemCode: o.outputItem?.fullCode ?? "",
    outputItemTitle: o.outputItem?.title ?? "",
    unit: o.outputItem?.mainUnit?.title ?? "",
    quantity: num(o.quantity),
    producedQuantity: producedQty,
    status: o.status,
    bomId: o.bomId,
    bomNumber: o.bom?.number ?? null,
    bomLabel: o.bom ? `#${o.bom.number} (از ${isoDay(o.bom.effectiveDate)})` : "",
    salesOrderLineId: o.salesOrderLineId,
    salesQuoteLineId: o.salesQuoteLineId,
    sourceLabel: so ? `سفارش فروش ${so.number} — ${so.customer?.party?.detailTitle ?? ""}` : sq ? `پیش‌فاکتور ${sq.number} — ${sq.customer?.party?.detailTitle ?? ""}` : "",
    kind: o.salesOrderLineId || o.salesQuoteLineId ? "CUSTOM" : "STOCK",
    plannedStart: isoDay(o.plannedStart),
    plannedEnd: isoDay(o.plannedEnd),
    description: o.description ?? "",
    mrpPlannedOrderId: o.mrpPlannedOrderId,
    parentOrderId: o.parentOrderId ?? null,
    parentOrderNumber: o.parentOrder?.number ?? null,
    documentCount: docCount,
    updatedAt: o.updatedAt,
    lines: (o.lines ?? []).map((l: any) => ({
      id: l.id,
      componentItemId: l.componentItemId,
      componentCode: l.componentItem?.fullCode ?? "",
      componentTitle: l.componentItem?.title ?? "",
      unit: l.componentItem?.mainUnit?.title ?? "",
      quantity: num(l.quantity),
      consumedQuantity: consumedByItem ? consumedByItem.get(l.componentItemId) ?? 0 : 0,
      note: l.note ?? "",
    })),
  };
}

async function loadSalesLink(body: any, outputItemId: number) {
  const orderLineId = body?.salesOrderLineId ? Number(body.salesOrderLineId) : null;
  const quoteLineId = body?.salesQuoteLineId ? Number(body.salesQuoteLineId) : null;
  if (orderLineId && quoteLineId) fail("اتصال هم‌زمان به سفارش فروش و پیش‌فاکتور ممکن نیست");
  if (orderLineId) {
    const l = await prisma.salesOrderLine.findUnique({ where: { id: orderLineId }, select: { goodsItemId: true } });
    if (!l) return fail("ردیف سفارش فروش یافت نشد");
    if (l!.goodsItemId !== outputItemId) fail("کالای ردیف سفارش فروش با کالای خروجی دستور یکی نیست");
  }
  if (quoteLineId) {
    const l = await prisma.salesQuoteLine.findUnique({ where: { id: quoteLineId }, select: { goodsItemId: true } });
    if (!l) return fail("ردیف پیش‌فاکتور یافت نشد");
    if (l!.goodsItemId !== outputItemId) fail("کالای ردیف پیش‌فاکتور با کالای خروجی دستور یکی نیست");
  }
  return { salesOrderLineId: orderLineId, salesQuoteLineId: quoteLineId };
}

/** اعتبارسنجی و آماده‌سازی داده‌ی دستور (ایجاد/ویرایش) */
async function cleanOrder(body: any, existing?: { id: number; status: string; outputItemId: number; bomId: number | null }) {
  const date = parseDay(body?.date, "تاریخ دستور");
  await assertDateWithinCurrentFiscalPeriod(date);
  const outputItemId = Number(body?.outputItemId);
  const item = outputItemId
    ? await prisma.goodsItem.findUnique({ where: { id: outputItemId }, select: { id: true, kind: true, isActive: true, title: true, accountingGroup: { select: { goodsType: true } } } })
    : null;
  if (!item) return fail("کالای خروجی را انتخاب کنید");
  if (item!.kind !== "GOODS") fail("کالای خروجی باید کالا باشد");
  if (!isProducedType(item!.accountingGroup?.goodsType)) fail(`کالای «${item!.title}» نیمه‌ساخته یا محصول نیست`);
  if (existing && existing.status !== "DRAFT" && existing.outputItemId !== outputItemId) fail("کالای خروجی دستور صادرشده قابل تغییر نیست");
  const quantity = positive(body?.quantity, "مقدار دستور");
  const plannedStart = body?.plannedStart ? parseDay(body.plannedStart, "تاریخ شروع برنامه‌ای") : null;
  const plannedEnd = body?.plannedEnd ? parseDay(body.plannedEnd, "تاریخ پایان برنامه‌ای") : null;
  if (plannedStart && plannedEnd && plannedEnd < plannedStart) fail("تاریخ پایان برنامه‌ای قبل از شروع است");
  const link = await loadSalesLink(body, outputItemId);

  // دستور صادرشده: فرمول و اجزا ثابت می‌مانند (کنترل و مقیاس‌دهی در updateProductionOrder)
  if (existing && existing.status !== "DRAFT") {
    return { data: { date, outputItemId, quantity, bomId: existing.bomId, ...link, plannedStart, plannedEnd, description: String(body?.description ?? "").trim() || null }, lines: [] as { componentItemId: number; quantity: Prisma.Decimal; note: string | null }[] };
  }

  // BOM: انتخاب صریح (باید برای همین کالا، فعال و با تاریخ شروع ≤ تاریخ دستور باشد؛ فرمول قبلاً ذخیره‌شده‌ی دستور مجاز می‌ماند) یا
  // جدیدترین فرمول فعال در تاریخ دستور (می‌تواند نباشد)
  let bom: any = null;
  if (body?.bomId) {
    bom = await assertLineBom(body.bomId, outputItemId, date, "فرمول ساخت", new Set(existing?.bomId ? [existing.bomId] : []));
  } else if (!Array.isArray(body?.lines)) {
    bom = await activeBomFor(outputItemId, date);
  }

  // ردیف‌ها: ارسالی کاربر (BOM سفارشی) یا محاسبه از BOM
  let lines: { componentItemId: number; quantity: Prisma.Decimal; note: string | null }[];
  if (Array.isArray(body?.lines)) {
    const ids = body.lines.map((l: any) => Number(l?.componentItemId));
    if (ids.some((x: number) => !x)) fail("کالای همه‌ی اجزا را انتخاب کنید");
    if (new Set(ids).size !== ids.length) fail("یک جزء بیش از یک بار آمده است");
    if (ids.includes(outputItemId)) fail("کالای خروجی نمی‌تواند جزء خودش باشد");
    const found = await prisma.goodsItem.count({ where: { id: { in: ids }, kind: "GOODS" } });
    if (found !== ids.length) fail("اجزا باید کالا باشند");
    lines = body.lines.map((l: any, i: number) => ({ componentItemId: Number(l.componentItemId), quantity: positive(l?.quantity, `مقدار جزء ردیف ${i + 1}`), note: String(l?.note ?? "").trim() || null }));
  } else if (bom) {
    lines = requiredComponents(bom, num(quantity)).map((r) => ({ componentItemId: r.componentItemId, quantity: D(r.quantity), note: r.note }));
  } else {
    lines = [];
  }
  return {
    data: {
      date,
      outputItemId,
      quantity,
      bomId: bom ? (bom.id as number) : null,
      ...link,
      plannedStart,
      plannedEnd,
      description: String(body?.description ?? "").trim() || null,
    },
    lines,
  };
}

/** ساخت دستور (فرم، MRP): شماره‌ی بعدی در دوره‌ی مالی زیر قفل مشورتی */
export async function createProductionOrder(body: any, userId?: number | null, extra: { mrpPlannedOrderId?: number | null; parentOrderId?: number | null } = {}) {
  const { data, lines } = await cleanOrder(body);
  const fp = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: data.date }, toDate: { gte: data.date } }, select: { id: true } });
  if (!fp) return fail("دوره‌ی مالی تاریخ دستور یافت نشد");
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(7100120, ${fp!.id}::int)`;
    const last = await tx.productionOrder.findFirst({ where: { fiscalPeriodId: fp!.id }, orderBy: { number: "desc" }, select: { number: true } });
    return tx.productionOrder.create({
      data: { ...data, number: (last?.number ?? 0) + 1, fiscalPeriodId: fp!.id, status: "DRAFT", createdById: userId ?? null, mrpPlannedOrderId: extra.mrpPlannedOrderId ?? null, parentOrderId: extra.parentOrderId ?? null, lines: { create: lines } },
      include: ORDER_INCLUDE,
    });
  });
}

export async function updateProductionOrder(id: number, body: any) {
  const ex = await prisma.productionOrder.findUnique({
    where: { id },
    select: { id: true, status: true, outputItemId: true, bomId: true, quantity: true, lines: { select: { componentItemId: true, quantity: true, note: true }, orderBy: { id: "asc" } }, _count: { select: { documents: true } } },
  });
  if (!ex) return fail("دستور تولید یافت نشد");
  if (ex!.status === "CLOSED") fail("دستور بسته‌شده قابل ویرایش نیست؛ ابتدا آن را باز کنید");
  const { data, lines: cleaned } = await cleanOrder(body, ex!);
  if (ex!._count.documents > 0 && data.outputItemId !== ex!.outputItemId) fail("دستور سند انبار دارد و کالای خروجی‌اش قابل تغییر نیست");

  // کنترل تغییر کالای خروجی (پیش‌نویس): اجزای ذخیره‌شده مال کالای قبلی‌اند؛ اگر دقیقاً همان‌ها دوباره فرستاده شوند یعنی کاربر کالا را عوض کرده و اجزا را نه
  if (ex!.status === "DRAFT" && data.outputItemId !== ex!.outputItemId && Array.isArray(body?.lines) && body.lines.length > 0 && ex!.lines.length > 0) {
    const sent = new Set<number>(body.lines.map((l: any) => Number(l?.componentItemId)));
    if (sent.size === ex!.lines.length && ex!.lines.every((l) => sent.has(l.componentItemId))) {
      fail("کالای خروجی عوض شده ولی اجزای قبلی (مربوط به کالای قبلی) مانده‌اند؛ اجزا را از فرمول کالای جدید بسازید یا خودتان اصلاح کنید");
    }
  }

  let lines = cleaned;
  if (ex!.status === "RELEASED") {
    // قفل بعد از صدور: فرمول و اجزا نباید عوض شوند (تغییرشان فقط با «برگشت به پیش‌نویس»)
    const hint = "؛ برای تغییر، دستور را به پیش‌نویس برگردانید (فقط وقتی سند انبار، آمار تولید و محاسبه‌ی بها ندارد)";
    if (body?.bomId !== undefined && body?.bomId !== null && body?.bomId !== "" && Number(body.bomId) !== (ex!.bomId ?? 0)) fail(`فرمول ساخت دستور صادرشده قابل تغییر نیست${hint}`);
    const stored = new Map(ex!.lines.map((l) => [l.componentItemId, l]));
    if (Array.isArray(body?.lines)) {
      const sent = new Map<number, number>(body.lines.map((l: any) => [Number(l?.componentItemId), num(l?.quantity)]));
      const same = sent.size === stored.size && [...stored].every(([cid, l]) => sent.has(cid) && Math.abs((sent.get(cid) ?? 0) - num(l.quantity)) < 1e-6);
      if (!same) fail(`اجزای دستور صادرشده قابل تغییر نیست${hint}`);
    }
    // مقدار دستور: نه کمتر از تولیدشده؛ اجزا با همان نسبت تغییر می‌کنند (اگر مقدار عوض نشده، دقیقاً همان مقدارهای ذخیره‌شده می‌مانند)
    const newQty = num(data.quantity);
    const produced = (await orderQuantities([id])).produced.get(id) ?? 0;
    if (newQty < produced) fail(`مقدار دستور نمی‌تواند از مقدار تولیدشده‌ی تا حالا (${produced}) کمتر باشد`);
    const oldQty = num(ex!.quantity);
    const factor = oldQty > 0 ? newQty / oldQty : 1;
    const noteOf = new Map<number, string>(Array.isArray(body?.lines) ? body.lines.map((l: any) => [Number(l?.componentItemId), String(l?.note ?? "").trim()]) : []);
    lines = ex!.lines.map((l) => ({
      componentItemId: l.componentItemId,
      quantity: factor === 1 ? l.quantity : D(Math.round(num(l.quantity) * factor * 1e6) / 1e6),
      note: (noteOf.has(l.componentItemId) ? noteOf.get(l.componentItemId) || null : l.note) ?? null,
    }));
  }
  return prisma.$transaction(async (tx) => {
    await tx.productionOrderLine.deleteMany({ where: { orderId: id } });
    return tx.productionOrder.update({ where: { id }, data: { ...data, lines: { create: lines } }, include: ORDER_INCLUDE });
  });
}

export async function setOrderStatus(id: number, to: "RELEASED" | "CLOSED" | "DRAFT") {
  const o = await prisma.productionOrder.findUnique({ where: { id }, select: { status: true, number: true, _count: { select: { documents: true, statLines: true, costItems: true } } } });
  if (!o) return fail("دستور تولید یافت نشد");
  if (to === "RELEASED" && !["DRAFT", "CLOSED"].includes(o!.status)) fail("دستور قبلاً صادر شده است");
  if (to === "CLOSED" && o!.status !== "RELEASED") fail("فقط دستور صادرشده بسته می‌شود");
  if (to === "DRAFT") {
    // برگشت از صدور برای اصلاح فرمول/اجزا: فقط وقتی هیچ چیزی به دستور وصل نیست
    if (o!.status !== "RELEASED") fail("فقط دستور صادرشده به پیش‌نویس برمی‌گردد");
    if (o!._count.documents || o!._count.statLines || o!._count.costItems) fail("دستور سند انبار، آمار تولید یا محاسبه‌ی بها دارد و به پیش‌نویس برنمی‌گردد");
  }
  return prisma.productionOrder.update({ where: { id }, data: { status: to, closedAt: to === "CLOSED" ? new Date() : null }, include: ORDER_INCLUDE });
}

/** مانده‌ی مصرف هر جزء دستور (لازم − مصرف خالص) برای ساخت سند مصرف */
export async function remainingConsumption(orderId: number) {
  const o = await prisma.productionOrder.findUnique({ where: { id: orderId }, include: { lines: true } });
  if (!o) return fail("دستور تولید یافت نشد");
  const { consumed } = await orderQuantities([orderId]);
  const c = consumed.get(orderId) ?? new Map<number, number>();
  return o!.lines.map((l) => ({ goodsItemId: l.componentItemId, quantity: Math.max(0, Math.round((num(l.quantity) - (c.get(l.componentItemId) ?? 0)) * 1e6) / 1e6) })).filter((r) => r.quantity > 0);
}
