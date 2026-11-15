import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { getLineAmounts } from "../services/documentItemAmountService";
import { orderQuantities } from "../services/productionOrderService";
import { isoDay, num, parseDay, sendError } from "../services/productionCommon";

// تولید › گزارش: بهای تمام‌شده، مصرف در برابر فرمول (BOM)، برنامه در برابر انجام. فقط خواندنی؛ اعداد از جدول‌های خود ماژول و اسناد انبار.

const COST_ORDERS = findFormPrefix("production-order-cost-report");
const VARIANCE = findFormPrefix("production-variance-report");
const PLAN = findFormPrefix("production-plan-report");
const router = Router();

function range(req: any) {
  const from = req.query.from ? parseDay(req.query.from, "از تاریخ") : null;
  const to = req.query.to ? parseDay(req.query.to, "تا تاریخ") : null;
  return { from, to };
}

// بهای تمام‌شده‌ی منتسب به دستورها: آمار تولیدِ هر دستور × فی مرکز/کالای همان آمار (یک ردیف به ازای هر دوره و دستور)
router.get("/production-reports/cost-orders", can(`${COST_ORDERS}.view`), async (req, res) => {
  try {
    const { from, to } = range(req);
    const items = await prisma.productionCostItem.findMany({
      where: { run: { reportingPeriod: { ...(from ? { toDate: { gte: from } } : {}), ...(to ? { fromDate: { lte: to } } : {}) } } },
      include: {
        run: { select: { reportingPeriod: { select: { title: true, fromDate: true } } } },
        productionOrder: { include: { salesOrderLine: { include: { salesOrder: { select: { number: true, customer: { select: { party: { select: { detailTitle: true } } } } } } } }, salesQuoteLine: { include: { salesQuote: { select: { number: true, customer: { select: { party: { select: { detailTitle: true } } } } } } } } } },
        outputItem: { select: { fullCode: true, title: true } },
      },
      orderBy: [{ run: { reportingPeriod: { fromDate: "desc" } } }, { productionOrderId: "asc" }],
    });
    res.json(
      items.map((i) => {
        const so = i.productionOrder.salesOrderLine?.salesOrder;
        const sq = i.productionOrder.salesQuoteLine?.salesQuote;
        const qty = num(i.finishedQty);
        return {
          id: i.id,
          period: i.run.reportingPeriod.title,
          orderNumber: i.productionOrder.number,
          kind: so || sq ? "CUSTOM" : "STOCK",
          customer: (so ?? sq)?.customer?.party?.detailTitle ?? "",
          itemCode: i.outputItem.fullCode,
          itemTitle: i.outputItem.title,
          finishedQty: qty,
          materialCost: num(i.materialCost),
          conversionCost: num(i.conversionCost),
          totalCost: num(i.receiptValue),
          unitCost: qty > 0 ? num(i.receiptValue) / qty : 0,
        };
      })
    );
  } catch (e) {
    sendError(res, e, "خطا");
  }
});

// مصرف در برابر فرمول: به ازای هر (مرکز هزینه، جزء) — لازم (آمار تولید × فرمول ساخت) در برابر مصرف خالص اسناد همان مرکز و مبلغش
router.get("/production-reports/variance", can(`${VARIANCE}.view`), async (req, res) => {
  try {
    const { from, to } = range(req);
    const dateWhere = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
    const hasDate = !!from || !!to;
    const centers = await prisma.costCenter.findMany({ select: { id: true, title: true, detailCode: true } });
    const centerByCode = new Map(centers.map((c) => [c.detailCode, c]));
    const stats = await prisma.productionStatLine.findMany({ where: hasDate ? { stat: { date: dateWhere } } : {}, select: { goodsItemId: true, quantity: true, bomId: true, stat: { select: { costCenterId: true, date: true } } } });
    const planned = new Map<string, number>(); // مرکز:جزء ← مقدار لازم
    const bomCache = new Map<string, any>();
    for (const st of stats) {
      // فرمولی که ردیف آمار صریح انتخاب کرده است
      if (!bomCache.has(String(st.bomId))) bomCache.set(String(st.bomId), await prisma.bom.findUnique({ where: { id: st.bomId }, include: { lines: true } }));
      const bom = bomCache.get(String(st.bomId));
      if (!bom) continue;
      const out = num(bom.outputQuantity) || 1;
      for (const l of bom.lines) {
        const need = (num(st.quantity) * num(l.quantity)) / out / (1 - num(l.scrapPercent) / 100);
        const key = `${st.stat.costCenterId}:${l.componentItemId}`;
        planned.set(key, (planned.get(key) ?? 0) + need);
      }
    }
    const docs = await prisma.inventoryDocument.findMany({
      where: { documentType: { in: ["PRODUCTION_CONSUMPTION", "PRODUCTION_CONSUMPTION_RETURN"] }, ...(hasDate ? { date: dateWhere } : {}) },
      select: { documentType: true, detailCode: true, lines: { select: { id: true, goodsItemId: true, quantity: true } } },
    });
    const amounts = await getLineAmounts(docs.flatMap((d) => d.lines.map((l) => l.id)));
    const used = new Map<string, { qty: number; amount: number }>();
    for (const d of docs) {
      const c = d.detailCode ? centerByCode.get(d.detailCode) : undefined;
      if (!c) continue;
      const sign = d.documentType === "PRODUCTION_CONSUMPTION" ? 1 : -1;
      for (const l of d.lines) {
        const key = `${c.id}:${l.goodsItemId}`;
        const cur = used.get(key) ?? { qty: 0, amount: 0 };
        cur.qty += sign * num(l.quantity);
        cur.amount += sign * num(amounts.get(l.id));
        used.set(key, cur);
      }
    }
    const keys = new Set([...planned.keys(), ...used.keys()]);
    const itemIds = [...new Set([...keys].map((k) => Number(k.split(":")[1])))];
    const items = await prisma.goodsItem.findMany({ where: { id: { in: itemIds } }, select: { id: true, fullCode: true, title: true } });
    const itemById = new Map(items.map((i) => [i.id, i]));
    const centerById = new Map(centers.map((c) => [c.id, c]));
    const rows = [...keys]
      .map((k) => {
        const [cid, iid] = k.split(":").map(Number);
        const p = planned.get(k) ?? 0;
        const u = used.get(k) ?? { qty: 0, amount: 0 };
        const it = itemById.get(iid);
        return {
          costCenter: centerById.get(cid)?.title ?? "",
          itemCode: it?.fullCode ?? "",
          itemTitle: it?.title ?? "",
          plannedQty: Math.round(p * 1e6) / 1e6,
          usedQty: u.qty,
          diffQty: Math.round((u.qty - p) * 1e6) / 1e6,
          usedAmount: u.amount,
          unplanned: p === 0,
        };
      })
      .filter((r) => r.plannedQty !== 0 || r.usedQty !== 0)
      .sort((a, b) => a.costCenter.localeCompare(b.costCenter) || a.itemCode.localeCompare(b.itemCode));
    res.json(rows);
  } catch (e) {
    sendError(res, e, "خطا");
  }
});

// برنامه در برابر انجام: دستورها با مقدار برنامه‌ای، تولیدشده و وضعیت زمان‌بندی
router.get("/production-reports/plan", can(`${PLAN}.view`), async (req, res) => {
  try {
    const { from, to } = range(req);
    const orders = await prisma.productionOrder.findMany({
      where: { ...(from ? { date: { gte: from } } : {}), ...(to ? { date: { lte: to } } : {}), ...(req.query.status ? { status: String(req.query.status) as any } : {}) },
      include: { outputItem: { select: { fullCode: true, title: true } }, salesOrderLine: { select: { id: true } }, salesQuoteLine: { select: { id: true } } },
      orderBy: [{ date: "desc" }, { number: "desc" }],
    });
    const { produced } = await orderQuantities(orders.map((o) => o.id));
    const today = new Date();
    res.json(
      orders.map((o) => {
        const p = produced.get(o.id) ?? 0;
        const qty = num(o.quantity);
        const late = o.status !== "CLOSED" && o.plannedEnd && o.plannedEnd < today && p < qty;
        return {
          id: o.id,
          number: o.number,
          date: isoDay(o.date),
          kind: o.salesOrderLine || o.salesQuoteLine ? "CUSTOM" : "STOCK",
          status: o.status,
          itemCode: o.outputItem.fullCode,
          itemTitle: o.outputItem.title,
          plannedQty: qty,
          producedQty: p,
          remainingQty: Math.max(0, qty - p),
          percent: qty > 0 ? Math.round((p / qty) * 1000) / 10 : 0,
          plannedStart: isoDay(o.plannedStart),
          plannedEnd: isoDay(o.plannedEnd),
          late: !!late,
        };
      })
    );
  } catch (e) {
    sendError(res, e, "خطا");
  }
});

export default router;
