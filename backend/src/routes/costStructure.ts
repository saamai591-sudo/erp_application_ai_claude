import { Router } from "express";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { sendError } from "../services/productionCommon";
import { createNode, deleteNode, listTree, updateNode } from "../services/costStructureService";

// تولید › تنظیمات › «ساختار بهای تمام‌شده»: درخت با چهار ریشه‌ی سیستمی. قواعد: services/costStructureService.ts

const FORM = findFormPrefix("cost-structure");
const router = Router();

router.get("/cost-structure", can(`${FORM}.view`), async (_req, res) => {
  try {
    res.json(await listTree());
  } catch (e) {
    sendError(res, e, "خطا");
  }
});

router.post("/cost-structure", can(`${FORM}.create`), async (req, res) => {
  try {
    res.status(201).json(await createNode(req.body));
  } catch (e) {
    sendError(res, e, "خطا در ثبت شاخه");
  }
});

router.put("/cost-structure/:id", can(`${FORM}.edit`), async (req, res) => {
  try {
    res.json(await updateNode(Number(req.params.id), req.body));
  } catch (e) {
    sendError(res, e, "خطا در ویرایش شاخه");
  }
});

router.delete("/cost-structure/:id", can(`${FORM}.delete`), async (req, res) => {
  try {
    await deleteNode(Number(req.params.id));
    res.status(204).send();
  } catch (e) {
    sendError(res, e, "خطا در حذف شاخه");
  }
});

export default router;
