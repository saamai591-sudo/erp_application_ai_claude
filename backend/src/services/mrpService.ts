import { prisma } from "../lib/prisma";
import { getStockAnalysis } from "./stockAnalysisService";
import { activeBomFor, requiredComponents } from "./bomService";
import { createProductionOrder } from "./productionOrderService";
import { D, fail, isProducedType, isoDay, num, parseDay } from "./productionCommon";

// برنامه‌ریزی نیاز مواد (MRP) بدون ظرفیت — تک‌سطل زمانی (افق): به ازای هر کالا نیاز خالص = نیاز + موجودی اطمینان − (موجودی + در راه + دستور تولید باز).
//  • نیاز: مانده‌ی سفارش‌های فروش تاییدشده (پیش‌فاکتور تعهد نیست) + نیاز وابسته‌ی دستورهای پیشنهادیِ سطح بالاتر (انفجار BOM).
//  • به ترتیب «سطح پایین» (محصول نهایی اول، اجزا بعد) تا نیاز وابسته قبل از خالص‌کردن هر کالا کامل باشد.
//  • خروجی: دستور تولید پیشنهادی (MAKE: کالای تولیدی دارای BOM فعال) یا خرید پیشنهادی (BUY)؛ تبدیل به دستور تولید/درخواست تامین دستی است.

interface Demand {
  qty: number;
  date: Date;
}

export async function runMrp(params: { date: string; horizonEnd: string; description?: string }, userId: number | null) {
  const runDate = parseDay(params.date, "تاریخ اجرا");
  const horizonEnd = parseDay(params.horizonEnd, "پایان افق");
  if (horizonEnd < runDate) fail("پایان افق قبل از تاریخ اجراست");

  // موجودی/در راه/در حال تولید/تعهد فروش همه‌ی کالاها
  const stock = new Map((await getStockAnalysis()).map((r) => [r.id, r]));
  const planning = new Map((await prisma.itemPlanning.findMany()).map((p) => [p.goodsItemId, p]));
  const items = await prisma.goodsItem.findMany({
    where: { kind: "GOODS", isActive: true },
    select: { id: true, fullCode: true, title: true, mainUnitId: true, reorderControl: true, reorderPoint: true, accountingGroup: { select: { goodsType: true } } },
  });
  const itemById = new Map(items.map((i) => [i.id, i]));

  // نیاز مستقل: سفارش‌های فروش تاییدشده (مانده‌ی تحویل)
  const demands = new Map<number, Demand[]>();
  const addDemand = (itemId: number, qty: number, date: Date) => {
    if (qty <= 0) return;
    demands.set(itemId, [...(demands.get(itemId) ?? []), { qty, date }]);
  };
  const soLines = await prisma.salesOrderLine.findMany({
    where: { salesOrder: { status: "APPROVED" }, goodsItem: { kind: "GOODS" } },
    select: { id: true, goodsItemId: true, quantity: true, salesOrder: { select: { date: true } } },
  });
  const delivered = new Map<number, number>();
  if (soLines.length) {
    const rows = await prisma.inventoryDocumentLine.findMany({ where: { sourceSalesOrderLineId: { in: soLines.map((l) => l.id) }, document: { documentType: "SALES_DELIVERY" } }, select: { sourceSalesOrderLineId: true, quantity: true } });
    for (const r of rows) delivered.set(r.sourceSalesOrderLineId!, (delivered.get(r.sourceSalesOrderLineId!) ?? 0) + num(r.quantity));
  }
  for (const l of soLines) {
    const due = l.salesOrder.date < runDate ? runDate : l.salesOrder.date;
    if (due <= horizonEnd) addDemand(l.goodsItemId, num(l.quantity) - (delivered.get(l.id) ?? 0), due);
  }

  // سطح پایین هر کالا از گراف BOM فعال (کالای والد ← اجزا)
  const boms = new Map<number, any>();
  for (const i of items) {
    if (!isProducedType(i.accountingGroup?.goodsType)) continue;
    const b = await activeBomFor(i.id, runDate);
    if (b) boms.set(i.id, b);
  }
  const level = new Map<number, number>();
  const bump = (id: number, lv: number, depth = 0) => {
    if (depth > 30) return;
    if ((level.get(id) ?? -1) >= lv) return;
    level.set(id, lv);
    for (const l of boms.get(id)?.lines ?? []) bump(l.componentItemId, lv + 1, depth + 1);
  };
  for (const id of boms.keys()) bump(id, 0);
  // کالای بدون BOM و بدون والد سطح ۰ دارد
  for (const i of items) if (!level.has(i.id)) level.set(i.id, 0);

  const candidates = new Set<number>([...demands.keys()]);
  for (const i of items) {
    const p = planning.get(i.id);
    const safety = Math.max(num(p?.safetyStock), i.reorderControl ? num(i.reorderPoint) : 0);
    if (safety > 0) candidates.add(i.id);
  }

  const planned: { goodsItemId: number; type: "MAKE" | "BUY"; quantity: number; dueDate: Date; releaseDate: Date; note: string | null }[] = [];
  const queue = new Set<number>(candidates);
  const processed = new Set<number>();
  const byLevel = () => [...queue].filter((id) => !processed.has(id)).sort((a, b) => (level.get(a) ?? 0) - (level.get(b) ?? 0));
  let next = byLevel();
  while (next.length) {
    const id = next[0];
    processed.add(id);
    const item = itemById.get(id);
    if (!item) {
      next = byLevel();
      continue;
    }
    const p = planning.get(id);
    const s = stock.get(id);
    const safety = Math.max(num(p?.safetyStock), item.reorderControl ? num(item.reorderPoint) : 0);
    const ds = (demands.get(id) ?? []).sort((a, b) => a.date.getTime() - b.date.getTime());
    const demandTotal = ds.reduce((x, d) => x + d.qty, 0);
    // «در حال تولید» = مانده‌ی دستورهای تولید صادرشده؛ تعریفش فقط در stockAnalysisService است
    const supply = (s?.stock ?? 0) + (s?.inTransit ?? 0) + (s?.inProduction ?? 0);
    // تعهد فروش (committed) قبلاً به‌صورت نیاز مستقل آمده، پس از موجودی کم نمی‌شود
    let net = demandTotal + safety - supply;
    if (net > 1e-9) {
      const lot = num(p?.lotSize);
      if (lot > 0) net = Math.ceil(net / lot - 1e-9) * lot;
      const due = ds.length ? ds[0].date : runDate;
      const lead = p?.leadTimeDays ?? 0;
      const release = new Date(due.getTime() - lead * 86400000);
      const bom = boms.get(id);
      const type: "MAKE" | "BUY" = bom ? "MAKE" : "BUY";
      planned.push({ goodsItemId: id, type, quantity: Math.round(net * 1e6) / 1e6, dueDate: due, releaseDate: release < runDate ? runDate : release, note: !bom && isProducedType(item.accountingGroup?.goodsType) ? "فرمول ساخت فعال ندارد؛ خرید پیشنهاد شد" : null });
      // نیاز وابسته‌ی اجزا (در تاریخ صدور دستور)
      if (bom) {
        for (const r of requiredComponents(bom, net)) {
          addDemand(r.componentItemId, r.quantity, release < runDate ? runDate : release);
          queue.add(r.componentItemId);
        }
      }
    }
    next = byLevel();
  }

  return prisma.$transaction(async (tx) => {
    const last = await tx.mrpRun.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
    return tx.mrpRun.create({
      data: {
        number: (last?.number ?? 0) + 1,
        date: runDate,
        horizonEnd,
        description: params.description?.trim() || null,
        createdById: userId,
        planned: { create: planned.map((p) => ({ goodsItemId: p.goodsItemId, type: p.type, quantity: D(p.quantity), dueDate: p.dueDate, releaseDate: p.releaseDate, note: p.note })) },
      },
      include: { planned: true },
    });
  });
}

/** تبدیل پیشنهادهای انتخاب‌شده: MAKE ← دستور تولید (پیش‌نویس)، BUY ← یک درخواست تامین (پیش‌نویس، خرید، بدون مبنا) */
export async function convertPlanned(ids: number[], opts: { orgUnitId?: number; date?: string }, userId: number | null) {
  const rows = await prisma.mrpPlannedOrder.findMany({ where: { id: { in: ids } }, include: { goodsItem: { select: { mainUnitId: true } }, run: { select: { number: true, date: true } } } });
  if (!rows.length) return fail("پیشنهادی انتخاب نشده است");
  if (rows.some((r) => r.status !== "OPEN")) fail("بعضی از پیشنهادها قبلاً تبدیل شده‌اند");
  const result = { productionOrders: [] as number[], supplyRequestNumber: null as number | null };
  const date = opts.date ? parseDay(opts.date, "تاریخ") : new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");

  for (const r of rows.filter((x) => x.type === "MAKE")) {
    const o = await createProductionOrder({ date: isoDay(date), outputItemId: r.goodsItemId, quantity: num(r.quantity), plannedStart: isoDay(r.releaseDate), plannedEnd: isoDay(r.dueDate), description: `پیشنهاد MRP شماره ${r.run.number}` }, userId, { mrpPlannedOrderId: r.id });
    await prisma.mrpPlannedOrder.update({ where: { id: r.id }, data: { status: "CONVERTED" } });
    result.productionOrders.push(o.number);
  }
  const buys = rows.filter((x) => x.type === "BUY");
  if (buys.length) {
    if (!opts.orgUnitId) fail("برای درخواست تامین، واحد سازمانی را انتخاب کنید");
    const fp = await prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } }, select: { id: true } });
    if (!fp) fail("دوره‌ی مالی تاریخ انتخاب‌شده یافت نشد");
    const created = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(7100122, ${fp!.id}::int)`;
      const last = await tx.supplyRequest.findFirst({ where: { fiscalPeriodId: fp!.id }, orderBy: { number: "desc" }, select: { number: true } });
      const sr = await tx.supplyRequest.create({
        data: {
          fiscalPeriodId: fp!.id, number: (last?.number ?? 0) + 1, date, basis: "NO_BASIS", route: "PURCHASE", orgUnitId: Number(opts.orgUnitId), description: "ایجادشده از پیشنهاد MRP", status: "DRAFT",
          lines: { create: buys.map((b, i) => ({ rowOrder: i, goodsItemId: b.goodsItemId, unitId: b.goodsItem.mainUnitId, quantity: b.quantity, description: `پیشنهاد MRP شماره ${b.run.number}` })) },
        },
      });
      await tx.mrpPlannedOrder.updateMany({ where: { id: { in: buys.map((b) => b.id) } }, data: { status: "CONVERTED", supplyRequestId: sr.id } });
      return sr;
    });
    result.supplyRequestNumber = created.number;
  }
  return result;
}
