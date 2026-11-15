import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { AuthedRequest } from "../middleware/auth";
import { convertPlanned, runMrp } from "../services/mrpService";
import { D, fail, isoDay, num, sendError } from "../services/productionCommon";

// تولید › برنامه‌ریزی (MRP): پارامترهای برنامه‌ریزی کالا + اجرای MRP + تبدیل پیشنهادها. قواعد: services/mrpService.ts

const MRP = findFormPrefix("mrp-runs");
const PLAN = findFormPrefix("item-planning");
const router = Router();

// ───── پارامترهای برنامه‌ریزی کالا ─────
const planShape = (p: any) => ({ id: p.id, goodsItemId: p.goodsItemId, itemCode: p.goodsItem?.fullCode ?? "", itemTitle: p.goodsItem?.title ?? "", leadTimeDays: p.leadTimeDays, safetyStock: num(p.safetyStock), lotSize: p.lotSize === null ? null : num(p.lotSize) });

async function cleanPlan(b: any) {
  const goodsItemId = Number(b?.goodsItemId);
  const item = goodsItemId ? await prisma.goodsItem.findUnique({ where: { id: goodsItemId }, select: { id: true, kind: true } }) : null;
  if (!item) return fail("کالا را انتخاب کنید");
  if (item!.kind !== "GOODS") fail("کالا باید کالا باشد");
  const lead = Number(b?.leadTimeDays ?? 0);
  if (!Number.isInteger(lead) || lead < 0 || lead > 3650) fail("زمان تامین باید عدد صحیح بین ۰ و ۳۶۵۰ روز باشد");
  const safety = Number(b?.safetyStock ?? 0);
  if (!Number.isFinite(safety) || safety < 0) fail("موجودی اطمینان نمی‌تواند منفی باشد");
  let lot: any = null;
  if (b?.lotSize !== null && b?.lotSize !== undefined && b?.lotSize !== "") {
    const x = Number(b.lotSize);
    if (!Number.isFinite(x) || x <= 0) fail("اندازه‌ی سفارش باید بزرگ‌تر از صفر باشد");
    lot = D(x);
  }
  return { goodsItemId, leadTimeDays: lead, safetyStock: D(safety), lotSize: lot };
}

router.get("/item-planning", can(`${PLAN}.view`), async (_req, res) => {
  const rows = await prisma.itemPlanning.findMany({ include: { goodsItem: { select: { fullCode: true, title: true } } }, orderBy: { goodsItemId: "asc" } });
  res.json(rows.map(planShape));
});
router.get("/item-planning/:id", can(`${PLAN}.view`), async (req, res) => {
  const p = await prisma.itemPlanning.findUnique({ where: { id: Number(req.params.id) }, include: { goodsItem: { select: { fullCode: true, title: true } } } });
  if (!p) return res.status(404).json({ error: "پارامتر برنامه‌ریزی یافت نشد" });
  res.json(planShape(p));
});
router.post("/item-planning", can(`${PLAN}.create`), async (req, res) => {
  try {
    const created = await prisma.itemPlanning.create({ data: await cleanPlan(req.body), include: { goodsItem: { select: { fullCode: true, title: true } } } });
    res.status(201).json(planShape(created));
  } catch (e: any) {
    if (e?.code === "P2002") return res.status(400).json({ error: "برای این کالا پارامتر برنامه‌ریزی قبلاً ثبت شده است" });
    sendError(res, e, "خطا");
  }
});
router.put("/item-planning/:id", can(`${PLAN}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!(await prisma.itemPlanning.findUnique({ where: { id }, select: { id: true } }))) return res.status(404).json({ error: "یافت نشد" });
    const updated = await prisma.itemPlanning.update({ where: { id }, data: await cleanPlan(req.body), include: { goodsItem: { select: { fullCode: true, title: true } } } });
    res.json(planShape(updated));
  } catch (e: any) {
    if (e?.code === "P2002") return res.status(400).json({ error: "برای این کالا پارامتر برنامه‌ریزی قبلاً ثبت شده است" });
    sendError(res, e, "خطا");
  }
});
router.delete("/item-planning/:id", can(`${PLAN}.delete`), async (req, res) => {
  try {
    await prisma.itemPlanning.delete({ where: { id: Number(req.params.id) } });
    res.status(204).send();
  } catch (e) {
    sendError(res, e, "خطا");
  }
});

// ───── اجرای MRP ─────
const PLANNED_INCLUDE = { goodsItem: { select: { fullCode: true, title: true, mainUnit: { select: { title: true } } } }, productionOrder: { select: { number: true } } } as const;
const plannedShape = (p: any) => ({ id: p.id, goodsItemId: p.goodsItemId, itemCode: p.goodsItem?.fullCode ?? "", itemTitle: p.goodsItem?.title ?? "", unit: p.goodsItem?.mainUnit?.title ?? "", type: p.type, quantity: num(p.quantity), dueDate: isoDay(p.dueDate), releaseDate: isoDay(p.releaseDate), status: p.status, note: p.note ?? "", productionOrderNumber: p.productionOrder?.number ?? null, supplyRequestId: p.supplyRequestId });

router.get("/mrp-runs", can(`${MRP}.view`), async (_req, res) => {
  const rows = await prisma.mrpRun.findMany({ orderBy: { number: "desc" }, include: { _count: { select: { planned: true } } } });
  res.json(rows.map((r) => ({ id: r.id, number: r.number, date: isoDay(r.date), horizonEnd: isoDay(r.horizonEnd), description: r.description ?? "", plannedCount: r._count.planned })));
});

router.get("/mrp-runs/:id", can(`${MRP}.view`), async (req, res) => {
  const r = await prisma.mrpRun.findUnique({ where: { id: Number(req.params.id) }, include: { planned: { include: PLANNED_INCLUDE, orderBy: [{ type: "asc" }, { dueDate: "asc" }] } } });
  if (!r) return res.status(404).json({ error: "اجرای MRP یافت نشد" });
  res.json({ id: r.id, number: r.number, date: isoDay(r.date), horizonEnd: isoDay(r.horizonEnd), description: r.description ?? "", planned: r.planned.map(plannedShape) });
});

router.post("/mrp-runs", can(`${MRP}.create`), async (req: AuthedRequest, res) => {
  try {
    const run = await runMrp({ date: req.body?.date, horizonEnd: req.body?.horizonEnd, description: req.body?.description }, req.user?.id ?? null);
    res.status(201).json({ id: run.id, number: run.number, plannedCount: run.planned.length });
  } catch (e) {
    sendError(res, e, "خطا در اجرای MRP");
  }
});

router.delete("/mrp-runs/:id", can(`${MRP}.delete`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (await prisma.mrpPlannedOrder.count({ where: { runId: id, status: "CONVERTED" } })) fail("بعضی از پیشنهادها به دستور/درخواست تبدیل شده‌اند و اجرا حذف نمی‌شود");
    await prisma.mrpRun.delete({ where: { id } });
    res.status(204).send();
  } catch (e) {
    sendError(res, e, "خطا");
  }
});

router.post("/mrp-runs/convert", can(`${MRP}.convert`), async (req: AuthedRequest, res) => {
  try {
    const ids: number[] = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean) : [];
    res.json(await convertPlanned(ids, { orgUnitId: req.body?.orgUnitId ? Number(req.body.orgUnitId) : undefined, date: req.body?.date }, req.user?.id ?? null));
  } catch (e) {
    sendError(res, e, "خطا در تبدیل پیشنهادها");
  }
});

export default router;
