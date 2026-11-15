import { Router } from "express";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { sendError } from "../services/productionCommon";
import { createDriver, deleteDriver, getDriver, listDrivers, updateDriver } from "../services/productionTimeService";

// تولید › تنظیمات › «مبناهای زمانی تسهیم» (زمان بافت، زمان دوخت، …). قواعد: services/productionTimeService.ts

const FORM = findFormPrefix("cost-time-drivers");
const router = Router();

router.get("/cost-time-drivers", can(`${FORM}.view`), async (_req, res) => {
  try {
    res.json(await listDrivers());
  } catch (e) {
    sendError(res, e, "خطا");
  }
});

router.get("/cost-time-drivers/:id", can(`${FORM}.view`), async (req, res) => {
  const d = await getDriver(Number(req.params.id));
  if (!d) return res.status(404).json({ error: "مبنای زمانی یافت نشد" });
  res.json(d);
});

router.post("/cost-time-drivers", can(`${FORM}.create`), async (req, res) => {
  try {
    const d = await createDriver(req.body);
    res.status(201).json(await getDriver(d.id));
  } catch (e) {
    sendError(res, e, "خطا در ثبت مبنای زمانی");
  }
});

router.put("/cost-time-drivers/:id", can(`${FORM}.edit`), async (req, res) => {
  try {
    const d = await updateDriver(Number(req.params.id), req.body);
    res.json(await getDriver(d.id));
  } catch (e) {
    sendError(res, e, "خطا در ویرایش مبنای زمانی");
  }
});

router.delete("/cost-time-drivers/:id", can(`${FORM}.delete`), async (req, res) => {
  try {
    await deleteDriver(Number(req.params.id));
    res.status(204).send();
  } catch (e) {
    sendError(res, e, "خطا در حذف مبنای زمانی");
  }
});

export default router;
