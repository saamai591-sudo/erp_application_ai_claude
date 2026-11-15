import { Router } from "express";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { prisma } from "../lib/prisma";
import { sendError } from "../services/productionCommon";
import { createSheet, deleteSheet, getSheet, listSheets, sheetItemOptions, updateSheet } from "../services/productionTimeService";

// تولید › تنظیمات › «زمان‌بندی تولید»: زمان استاندارد هر کالا در هر مرکز هزینه به تفکیک مبنای زمانی. قواعد: services/productionTimeService.ts

const FORM = findFormPrefix("production-time-sheets");
const router = Router();

router.get("/production-time-sheets", can(`${FORM}.view`), async (_req, res) => {
  try {
    res.json(await listSheets());
  } catch (e) {
    sendError(res, e, "خطا");
  }
});

// کالاها و مبناهای قابل انتخاب در فرم
router.get("/production-time-sheets/options", can(`${FORM}.view`), async (_req, res) => {
  try {
    const drivers = await prisma.costTimeDriver.findMany({ orderBy: { code: "asc" }, select: { id: true, title: true, isActive: true } });
    res.json({ items: await sheetItemOptions(), drivers });
  } catch (e) {
    sendError(res, e, "خطا");
  }
});

router.get("/production-time-sheets/:id", can(`${FORM}.view`), async (req, res) => {
  const s = await getSheet(Number(req.params.id));
  if (!s) return res.status(404).json({ error: "برگه‌ی زمان‌بندی یافت نشد" });
  res.json(s);
});

router.post("/production-time-sheets", can(`${FORM}.create`), async (req, res) => {
  try {
    const s = await createSheet(req.body);
    res.status(201).json(await getSheet(s.id));
  } catch (e) {
    sendError(res, e, "خطا در ثبت زمان‌بندی");
  }
});

router.put("/production-time-sheets/:id", can(`${FORM}.edit`), async (req, res) => {
  try {
    const s = await updateSheet(Number(req.params.id), req.body);
    res.json(await getSheet(s.id));
  } catch (e) {
    sendError(res, e, "خطا در ویرایش زمان‌بندی");
  }
});

router.delete("/production-time-sheets/:id", can(`${FORM}.delete`), async (req, res) => {
  try {
    await deleteSheet(Number(req.params.id));
    res.status(204).send();
  } catch (e) {
    sendError(res, e, "خطا در حذف زمان‌بندی");
  }
});

export default router;
