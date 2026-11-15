import { Router } from "express";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { prisma } from "../lib/prisma";
import { sendError } from "../services/productionCommon";
import { createRule, deleteRule, getRule, leafOptions, listRules, updateRule } from "../services/costStructureService";

// تولید › تنظیمات › «عامل جمع‌آوری هزینه‌ها»: قاعده‌ی تاریخ‌دار معین (از دوره‌ی گزارشگری شروع). قواعد: services/costStructureService.ts

const FORM = findFormPrefix("cost-collectors");
const router = Router();

router.get("/cost-collectors", can(`${FORM}.view`), async (_req, res) => {
  try {
    res.json(await listRules());
  } catch (e) {
    sendError(res, e, "خطا");
  }
});

// مبناهای زمانی فعال برای انتخاب مبنای تسهیم
router.get("/cost-collectors/drivers", can(`${FORM}.view`), async (_req, res) => {
  try {
    res.json(await prisma.costTimeDriver.findMany({ where: { isActive: true }, orderBy: { code: "asc" }, select: { id: true, title: true } }));
  } catch (e) {
    sendError(res, e, "خطا");
  }
});

// برگ‌های دستمزد و سربار برای انتخابگر
router.get("/cost-collectors/leaves", can(`${FORM}.view`), async (_req, res) => {
  try {
    res.json(await leafOptions(["LABOR", "OVERHEAD"]));
  } catch (e) {
    sendError(res, e, "خطا");
  }
});

router.get("/cost-collectors/:id", can(`${FORM}.view`), async (req, res) => {
  const r = await getRule(Number(req.params.id));
  if (!r) return res.status(404).json({ error: "قاعده یافت نشد" });
  res.json(r);
});

router.post("/cost-collectors", can(`${FORM}.create`), async (req, res) => {
  try {
    const r = await createRule(req.body);
    res.status(201).json(await getRule(r.id));
  } catch (e) {
    sendError(res, e, "خطا در ثبت قاعده");
  }
});

router.put("/cost-collectors/:id", can(`${FORM}.edit`), async (req, res) => {
  try {
    const r = await updateRule(Number(req.params.id), req.body);
    res.json(await getRule(r.id));
  } catch (e) {
    sendError(res, e, "خطا در ویرایش قاعده");
  }
});

router.delete("/cost-collectors/:id", can(`${FORM}.delete`), async (req, res) => {
  try {
    await deleteRule(Number(req.params.id));
    res.status(204).send();
  } catch (e) {
    sendError(res, e, "خطا در حذف قاعده");
  }
});

export default router;
