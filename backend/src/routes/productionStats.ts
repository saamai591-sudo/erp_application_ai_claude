import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { AuthedRequest } from "../middleware/auth";
import { assertRecordNotStale } from "../utils/concurrency";
import { DELIVERY_INCLUDE, STAT_INCLUDE, createProductionDelivery, confirmProductionStat, createProductionStat, deleteProductionDelivery, deleteProductionStat, deliveryShape, pickableStatLines, statLineUsage, statShape, unconfirmProductionStat, updateProductionDelivery, updateProductionStat } from "../services/productionStatService";
import { parseDay, sendError } from "../services/productionCommon";
import { eligibleBoms } from "../services/bomService";

// تولید › تولید › «آمار تولید» و «تحویل تولید». قواعد: services/productionStatService.ts

const STAT_FORM = findFormPrefix("production-stats");
const DELIVERY_FORM = findFormPrefix("production-deliveries");
const router = Router();

// ردیف‌های آمار با مانده برای انتخاب در رسید تولید و تحویل تولید
router.get("/production-stats/pickable-lines", async (req, res) => {
  try {
    const costCenterId = Number(req.query.costCenterId);
    if (!costCenterId) return res.json([]);
    const date = req.query.date ? parseDay(req.query.date, "تاریخ") : new Date();
    res.json(await pickableStatLines(costCenterId, date, { receiptDocId: Number(req.query.receiptDocId) || undefined, deliveryId: Number(req.query.deliveryId) || undefined }));
  } catch (e) {
    sendError(res, e, "خطا");
  }
});

// فرمول‌های فعال و معتبر کالاها در یک تاریخ (برای انتخاب فرمول در آمار تولید و موجودی پای کار): { [کالا]: فرمول‌ها (جدیدترین اول) }
router.get("/production-stats/eligible-boms", async (req, res) => {
  try {
    const itemIds = String(req.query.itemIds ?? "").split(",").map(Number).filter((x) => Number.isInteger(x) && x > 0);
    const date = req.query.date ? parseDay(req.query.date, "تاریخ") : new Date();
    const map = await eligibleBoms(itemIds, date);
    res.json(Object.fromEntries([...map].map(([k, v]) => [k, v])));
  } catch (e) {
    sendError(res, e, "خطا");
  }
});

router.get("/production-stats", can(`${STAT_FORM}.view`), async (_req, res) => {
  const rows = await prisma.productionStat.findMany({ include: STAT_INCLUDE, orderBy: [{ date: "desc" }, { number: "desc" }] });
  res.json(rows.map((s) => ({ ...statShape(s), lines: undefined })));
});

router.get("/production-stats/:id", can(`${STAT_FORM}.view`), async (req, res) => {
  const s = await prisma.productionStat.findUnique({ where: { id: Number(req.params.id) }, include: STAT_INCLUDE });
  if (!s) return res.status(404).json({ error: "آمار تولید یافت نشد" });
  res.json(statShape(s, await statLineUsage(s.lines.map((l) => l.id))));
});

router.post("/production-stats", can(`${STAT_FORM}.create`), async (req: AuthedRequest, res) => {
  try {
    res.status(201).json(statShape(await createProductionStat(req.body, req.user?.id)));
  } catch (e) {
    sendError(res, e, "خطا در ثبت آمار تولید");
  }
});

router.put("/production-stats/:id", can(`${STAT_FORM}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.productionStat.findUnique({ where: { id }, select: { updatedAt: true } });
    if (!ex) return res.status(404).json({ error: "آمار تولید یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "آمار تولید");
    const updated = await updateProductionStat(id, req.body);
    res.json(statShape(updated, await statLineUsage(updated.lines.map((l) => l.id))));
  } catch (e) {
    sendError(res, e, "خطا در ویرایش آمار تولید");
  }
});

// تایید آمار: ساخت بچ کالاهای بچ‌دار (یا ادغام با بچ موجود) و قفل‌شدن آمار
router.post("/production-stats/:id/confirm", can(`${STAT_FORM}.confirm`), async (req: AuthedRequest, res) => {
  try {
    const id = Number(req.params.id);
    const done = await confirmProductionStat(id, req.body, req.user?.id);
    res.json(statShape(done, await statLineUsage(done.lines.map((l) => l.id))));
  } catch (e) {
    sendError(res, e, "خطا در تایید آمار تولید");
  }
});

router.post("/production-stats/:id/unconfirm", can(`${STAT_FORM}.unconfirm`), async (req, res) => {
  try {
    const done = await unconfirmProductionStat(Number(req.params.id));
    res.json(statShape(done, await statLineUsage(done.lines.map((l) => l.id))));
  } catch (e) {
    sendError(res, e, "خطا در برگشت از تایید آمار تولید");
  }
});

router.delete("/production-stats/:id", can(`${STAT_FORM}.delete`), async (req, res) => {
  try {
    await deleteProductionStat(Number(req.params.id));
    res.status(204).send();
  } catch (e) {
    sendError(res, e, "خطا در حذف آمار تولید");
  }
});

// ───────────── تحویل تولید ─────────────

router.get("/production-deliveries", can(`${DELIVERY_FORM}.view`), async (_req, res) => {
  const rows = await prisma.productionDelivery.findMany({ include: DELIVERY_INCLUDE, orderBy: [{ date: "desc" }, { number: "desc" }] });
  res.json(rows.map((d) => ({ ...deliveryShape(d), lines: undefined })));
});

router.get("/production-deliveries/:id", can(`${DELIVERY_FORM}.view`), async (req, res) => {
  const d = await prisma.productionDelivery.findUnique({ where: { id: Number(req.params.id) }, include: DELIVERY_INCLUDE });
  if (!d) return res.status(404).json({ error: "تحویل تولید یافت نشد" });
  res.json(deliveryShape(d, await statLineUsage(d.lines.map((l) => l.statLineId), { deliveryId: d.id })));
});

router.post("/production-deliveries", can(`${DELIVERY_FORM}.create`), async (req: AuthedRequest, res) => {
  try {
    res.status(201).json(deliveryShape(await createProductionDelivery(req.body, req.user?.id)));
  } catch (e) {
    sendError(res, e, "خطا در ثبت تحویل تولید");
  }
});

router.put("/production-deliveries/:id", can(`${DELIVERY_FORM}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.productionDelivery.findUnique({ where: { id }, select: { updatedAt: true } });
    if (!ex) return res.status(404).json({ error: "تحویل تولید یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "تحویل تولید");
    res.json(deliveryShape(await updateProductionDelivery(id, req.body)));
  } catch (e) {
    sendError(res, e, "خطا در ویرایش تحویل تولید");
  }
});

router.delete("/production-deliveries/:id", can(`${DELIVERY_FORM}.delete`), async (req, res) => {
  try {
    await deleteProductionDelivery(Number(req.params.id));
    res.status(204).send();
  } catch (e) {
    sendError(res, e, "خطا در حذف تحویل تولید");
  }
});

export default router;
