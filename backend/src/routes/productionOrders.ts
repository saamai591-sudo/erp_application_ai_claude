import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { AuthedRequest } from "../middleware/auth";
import { assertRecordNotStale } from "../utils/concurrency";
import { ORDER_INCLUDE, createProductionOrder, orderQuantities, orderShape, remainingConsumption, setOrderStatus, updateProductionOrder } from "../services/productionOrderService";
import { createProductionConsumption } from "./productionConsumptions";
import { getStockAnalysis } from "../services/stockAnalysisService";
import { planBatchAllocationFefo } from "../services/batchService";
import { assertExplosionBody, createChildOrders, explodeOrderPreview, parseChildScope, planChildOrders } from "../services/productionExplosionService";
import { PRODUCED_TYPES, fail, isoDay, num, sendError } from "../services/productionCommon";

// تولید › عملیات › دستور تولید. قواعد: services/productionOrderService.ts

const FORM = findFormPrefix("production-orders");
const router = Router();

router.get("/production-orders", can(`${FORM}.view`), async (req, res) => {
  const where: any = {};
  if (req.query.status) where.status = String(req.query.status);
  if (req.query.outputItemId) where.outputItemId = Number(req.query.outputItemId);
  const rows = await prisma.productionOrder.findMany({
    where,
    include: { ...ORDER_INCLUDE, _count: { select: { documents: true } } },
    orderBy: [{ date: "desc" }, { number: "desc" }],
  });
  const { produced } = await orderQuantities(rows.map((r) => r.id));
  res.json(rows.map((o) => ({ ...orderShape(o, produced.get(o.id) ?? 0, undefined, o._count.documents), lines: undefined })));
});

// ردیف‌های سفارش فروش/پیش‌فاکتورِ تاییدشده‌ی کالاهای تولیدی (برای اتصال دستور سفارشی)
router.get("/production-orders/sales-lines", can(`${FORM}.view`), async (_req, res) => {
  const groupFilter = { accountingGroup: { goodsType: { in: PRODUCED_TYPES as any } } };
  const [orderLines, quoteLines] = await Promise.all([
    prisma.salesOrderLine.findMany({
      where: { salesOrder: { status: "APPROVED" }, goodsItem: { ...groupFilter, kind: "GOODS" } },
      include: { goodsItem: { select: { id: true, fullCode: true, title: true } }, salesOrder: { select: { number: true, date: true, customer: { select: { party: { select: { detailTitle: true } } } } } } },
      orderBy: { id: "desc" },
      take: 500,
    }),
    prisma.salesQuoteLine.findMany({
      where: { salesQuote: { status: "APPROVED" }, goodsItem: { ...groupFilter, kind: "GOODS" } },
      include: { goodsItem: { select: { id: true, fullCode: true, title: true } }, salesQuote: { select: { number: true, date: true, customer: { select: { party: { select: { detailTitle: true } } } } } } },
      orderBy: { id: "desc" },
      take: 500,
    }),
  ]);
  res.json([
    ...orderLines.map((l) => ({ key: `O${l.id}`, kind: "ORDER", lineId: l.id, docNumber: l.salesOrder.number, docDate: isoDay(l.salesOrder.date), customer: l.salesOrder.customer?.party?.detailTitle ?? "", goodsItemId: l.goodsItemId, itemCode: l.goodsItem.fullCode, itemTitle: l.goodsItem.title, quantity: num(l.quantity) })),
    ...quoteLines.map((l) => ({ key: `Q${l.id}`, kind: "QUOTE", lineId: l.id, docNumber: l.salesQuote.number, docDate: isoDay(l.salesQuote.date), customer: l.salesQuote.customer?.party?.detailTitle ?? "", goodsItemId: l.goodsItemId, itemCode: l.goodsItem.fullCode, itemTitle: l.goodsItem.title, quantity: num(l.quantity) })),
  ]);
});

// موجودی/در راه/در حال تولید/تعهدشده/در دسترس اجزای یک دستور (فقط نمایشی؛ همان تعریف «آنالیز موجودی» — services/stockAnalysisService.ts).
// ?itemIds=1,2,3 ؛ برای هر کالای (GOODS) درخواستی یک ردیف برمی‌گردد (مقدار صفر هم).
router.get("/production-orders/availability", can(`${FORM}.view`), async (req, res) => {
  const itemIds = String(req.query.itemIds ?? "").split(",").map((s) => Number(s)).filter((n) => Number.isInteger(n) && n > 0).slice(0, 200);
  res.json(await getStockAnalysis(itemIds));
});

// پیش‌نمایش انفجار چندسطحی (فقط نمایشی، POST چون ردیف‌های فرم ذخیره‌نشده را می‌گیرد) — services/productionExplosionService.ts
router.post("/production-orders/explosion", can(`${FORM}.view`), async (req, res) => {
  try {
    res.json(await explodeOrderPreview(assertExplosionBody(req.body)));
  } catch (e) {
    sendError(res, e, "خطا در پیش‌نمایش انفجار");
  }
});

// دستورهای صادرشده (برای انتخاب در اسناد انبار تولید و فرم پای کار)
router.get("/production-orders/options", async (req, res) => {
  const where: any = { status: req.query.all === "1" ? { in: ["RELEASED", "CLOSED"] } : "RELEASED" };
  if (req.query.outputItemId) where.outputItemId = Number(req.query.outputItemId);
  const rows = await prisma.productionOrder.findMany({ where, include: { outputItem: { select: { id: true, fullCode: true, title: true } }, bom: { select: { number: true } } }, orderBy: [{ date: "desc" }, { number: "desc" }] });
  const { produced } = await orderQuantities(rows.map((r) => r.id));
  res.json(rows.map((o) => ({ producedQuantity: produced.get(o.id) ?? 0, id: o.id, number: o.number, date: isoDay(o.date), outputItemId: o.outputItemId, outputItemCode: o.outputItem.fullCode, outputItemTitle: o.outputItem.title, quantity: num(o.quantity), status: o.status, bomId: o.bomId, bomNumber: o.bom?.number ?? null, kind: o.salesOrderLineId || o.salesQuoteLineId ? "CUSTOM" : "STOCK" })));
});

router.get("/production-orders/:id", can(`${FORM}.view`), async (req, res) => {
  const id = Number(req.params.id);
  const o = await prisma.productionOrder.findUnique({ where: { id }, include: { ...ORDER_INCLUDE, _count: { select: { documents: true } } } });
  if (!o) return res.status(404).json({ error: "دستور تولید یافت نشد" });
  const { produced, consumed } = await orderQuantities([id]);
  const children = await prisma.productionOrder.findMany({ where: { parentOrderId: id }, select: { id: true, number: true, quantity: true, status: true, outputItem: { select: { fullCode: true, title: true } } }, orderBy: { number: "asc" } });
  // بچ‌های تولیدیِ این دستور (برای نمایش و پیوند به فرم بچ‌ها)
  const batches = await prisma.batch.findMany({ where: { productionOrderId: id }, select: { id: true, batchNumber: true, productionDate: true, goodsItem: { select: { title: true } } }, orderBy: { id: "asc" } });
  res.json({
    ...orderShape(o, produced.get(id) ?? 0, consumed.get(id), o._count.documents),
    children: children.map((c) => ({ id: c.id, number: c.number, quantity: num(c.quantity), status: c.status, itemCode: c.outputItem.fullCode, itemTitle: c.outputItem.title })),
    batches: batches.map((b) => ({ id: b.id, batchNumber: b.batchNumber, productionDate: isoDay(b.productionDate), itemTitle: b.goodsItem.title })),
  });
});

router.post("/production-orders", can(`${FORM}.create`), async (req: AuthedRequest, res) => {
  try {
    const created = await createProductionOrder(req.body, req.user?.id);
    res.status(201).json(orderShape(created));
  } catch (e) {
    sendError(res, e, "خطا در ثبت دستور تولید");
  }
});

router.put("/production-orders/:id", can(`${FORM}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.productionOrder.findUnique({ where: { id }, select: { updatedAt: true } });
    if (!ex) return res.status(404).json({ error: "دستور تولید یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "دستور تولید");
    res.json(orderShape(await updateProductionOrder(id, req.body)));
  } catch (e) {
    sendError(res, e, "خطا در ویرایش دستور تولید");
  }
});

router.delete("/production-orders/:id", can(`${FORM}.delete`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const o = await prisma.productionOrder.findUnique({ where: { id }, select: { status: true, childOrders: { select: { number: true } }, _count: { select: { documents: true, costItems: true, statLines: true } } } });
    if (!o) return res.status(404).json({ error: "دستور تولید یافت نشد" });
    if (o.status !== "DRAFT") fail("فقط دستور پیش‌نویس حذف می‌شود");
    if (o.childOrders.length) fail(`دستور سطح پایین دارد (${o.childOrders.map((c) => c.number).join("، ")}) و حذف نمی‌شود؛ ابتدا آن‌ها را حذف کنید`);
    if (o._count.documents || o._count.costItems || o._count.statLines) fail("دستور سند، آمار تولید یا محاسبه دارد و حذف نمی‌شود");
    await prisma.productionOrder.delete({ where: { id } });
    res.status(204).send();
  } catch (e) {
    sendError(res, e, "خطا در حذف دستور تولید");
  }
});

router.post("/production-orders/:id/release", can(`${FORM}.release`), async (req, res) => {
  try {
    res.json(orderShape(await setOrderStatus(Number(req.params.id), "RELEASED")));
  } catch (e) {
    sendError(res, e, "خطا");
  }
});
// برگشت از صدور (برای اصلاح فرمول/اجزا): هم‌مجوز «صدور»؛ فقط وقتی دستور سند، آمار و محاسبه‌ی بها ندارد (services/productionOrderService.ts)
router.post("/production-orders/:id/unrelease", can(`${FORM}.release`), async (req, res) => {
  try {
    res.json(orderShape(await setOrderStatus(Number(req.params.id), "DRAFT")));
  } catch (e) {
    sendError(res, e, "خطا");
  }
});
router.post("/production-orders/:id/close", can(`${FORM}.close`), async (req, res) => {
  try {
    res.json(orderShape(await setOrderStatus(Number(req.params.id), "CLOSED")));
  } catch (e) {
    sendError(res, e, "خطا");
  }
});
router.post("/production-orders/:id/reopen", can(`${FORM}.reopen`), async (req, res) => {
  try {
    res.json(orderShape(await setOrderStatus(Number(req.params.id), "RELEASED")));
  } catch (e) {
    sendError(res, e, "خطا");
  }
});

// ساخت دستورهای سطح پایین برای کسری اجزا: طرح (فقط نمایشی) و ساخت (پیش‌نویس‌ها با پیوند دستور مادر) — services/productionExplosionService.ts
router.get("/production-orders/:id/children-plan", can(`${FORM}.createChildren`), async (req, res) => {
  try {
    const plan = await planChildOrders(Number(req.params.id), parseChildScope(req.query.scope));
    res.json({ blockedReason: plan.blockedReason, rows: plan.rows });
  } catch (e) {
    sendError(res, e, "خطا در محاسبه‌ی طرح");
  }
});
router.post("/production-orders/:id/create-children", can(`${FORM}.createChildren`), async (req: AuthedRequest, res) => {
  try {
    res.status(201).json(await createChildOrders(Number(req.params.id), parseChildScope(req.body?.scope), req.user?.id));
  } catch (e) {
    sendError(res, e, "خطا در ساخت دستورهای سطح پایین");
  }
});

// ایجاد سند مصرف تولید از مانده‌ی اجزای دستور (یک سند مصرف معمولی)
router.post("/production-orders/:id/create-consumption", can(`${FORM}.createConsumption`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const o = await prisma.productionOrder.findUnique({ where: { id }, select: { id: true, number: true, status: true } });
    if (!o) return res.status(404).json({ error: "دستور تولید یافت نشد" });
    if (o.status !== "RELEASED") fail("دستور باید صادرشده باشد");
    const { warehouseId, date, costCenterId } = req.body ?? {};
    if (!warehouseId || !date || !costCenterId) fail("انبار، تاریخ و مرکز هزینه الزامی است");
    const lines = await remainingConsumption(id);
    if (!lines.length) fail("برای این دستور مانده‌ی مصرفی نیست");
    // اجزای دارای ردیابی «بچ»: تخصیص خودکار به بچ‌های موجود همان انبار به ترتیب FEFO (اول نزدیک‌ترین انقضا)؛
    // کاربر بعد از ایجاد، همین بچ‌ها را در فرم سند مصرف می‌بیند و می‌تواند عوض کند
    const asOf = new Date(String(date));
    const tracked = await prisma.goodsItem.findMany({ where: { id: { in: lines.map((l) => l.goodsItemId) } }, select: { id: true, title: true, trackingMethod: true } });
    const trackedById = new Map(tracked.map((g) => [g.id, g]));
    const docLines: { goodsItemId: number; quantity: number; batchAllocations?: { batchId: number; quantity: number }[] }[] = [];
    for (const l of lines) {
      const g = trackedById.get(l.goodsItemId);
      if (g?.trackingMethod === "BATCH") {
        const plan = await planBatchAllocationFefo(l.goodsItemId, Number(warehouseId), l.quantity, asOf);
        if (plan.shortage > 0) fail(`موجودی بچ‌های کالای «${g.title}» در انبار انتخاب‌شده کافی نیست (لازم ${l.quantity}، موجود ${plan.available}). سند مصرف را دستی و با انتخاب بچ ثبت کنید`);
        docLines.push({ goodsItemId: l.goodsItemId, quantity: l.quantity, batchAllocations: plan.allocations.map((a) => ({ batchId: a.batchId, quantity: a.quantity })) });
      } else docLines.push({ goodsItemId: l.goodsItemId, quantity: l.quantity });
    }
    const doc = await createProductionConsumption({
      warehouseId: Number(warehouseId),
      date: String(date),
      costCenterId: Number(costCenterId),
      description: `مصرف دستور تولید ${o.number}`,
      productionOrderId: id,
      lines: docLines,
    });
    res.status(201).json({ id: doc.id, number: doc.number });
  } catch (e) {
    sendError(res, e, "خطا در ایجاد سند مصرف");
  }
});

export default router;
