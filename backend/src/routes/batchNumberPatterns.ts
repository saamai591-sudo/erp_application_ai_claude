import { Router } from "express";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { sendError } from "../services/productionCommon";
import { createPattern, deletePattern, getPattern, listPatterns, previewPattern, updatePattern } from "../services/batchNumberPatternService";

// تولید › تنظیمات › «الگوی شماره‌گذاری بچ». قواعد: services/batchNumberPatternService.ts

const FORM = findFormPrefix("batch-number-patterns");
const router = Router();

// فهرست برای انتخابگر فرم کالا باز است (جستجوی ساده، بدون مجوز فرم)
router.get("/batch-number-patterns", async (_req, res) => {
  try {
    res.json(await listPatterns());
  } catch (e) {
    sendError(res, e, "خطا");
  }
});

router.post("/batch-number-patterns/preview", can(`${FORM}.view`), (req, res) => {
  try {
    res.json(previewPattern(req.body));
  } catch (e) {
    sendError(res, e, "خطا");
  }
});

router.get("/batch-number-patterns/:id", can(`${FORM}.view`), async (req, res) => {
  const p = await getPattern(Number(req.params.id));
  if (!p) return res.status(404).json({ error: "الگوی بچ یافت نشد" });
  res.json(p);
});

router.post("/batch-number-patterns", can(`${FORM}.create`), async (req, res) => {
  try {
    const p = await createPattern(req.body);
    res.status(201).json(await getPattern(p.id));
  } catch (e) {
    sendError(res, e, "خطا در ثبت الگوی بچ");
  }
});

router.put("/batch-number-patterns/:id", can(`${FORM}.edit`), async (req, res) => {
  try {
    const p = await updatePattern(Number(req.params.id), req.body);
    res.json(await getPattern(p.id));
  } catch (e) {
    sendError(res, e, "خطا در ویرایش الگوی بچ");
  }
});

router.delete("/batch-number-patterns/:id", can(`${FORM}.delete`), async (req, res) => {
  try {
    await deletePattern(Number(req.params.id));
    res.status(204).send();
  } catch (e) {
    sendError(res, e, "خطا در حذف الگوی بچ");
  }
});

export default router;
