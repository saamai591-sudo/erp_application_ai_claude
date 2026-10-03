import { Router } from "express";
import { AuthedRequest } from "../middleware/auth";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { listQuantityCloseStatus, closeWarehouseQuantity } from "../services/warehouseQuantityCloseService";

// =========================================================================
// «بستن تعدادی موجودی انبار» (مدیریت موجودی و انبار › عملیات پایان دوره). همه‌ی قواعد و هم‌زمانی در
// services/warehouseQuantityCloseService.ts — این فایل فقط لایه‌ی REST است.
// =========================================================================

const FORM = findFormPrefix("warehousing-quantity-close");

const router = Router();

router.get("/warehouse-quantity-close", can(`${FORM}.view`), async (_req, res) => {
  try {
    const { current, next, rows } = await listQuantityCloseStatus();
    res.json({
      current: { id: current.id, title: current.title, fromDate: current.fromDate, toDate: current.toDate },
      next: next ? { id: next.id, title: next.title, fromDate: next.fromDate, toDate: next.toDate } : null,
      warehouses: rows,
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در بارگذاری اطلاعات" });
  }
});

router.post("/warehouse-quantity-close/:warehouseId/close", can(`${FORM}.close`), async (req: AuthedRequest, res) => {
  const warehouseId = Number(req.params.warehouseId);
  if (!Number.isInteger(warehouseId) || warehouseId <= 0) return res.status(400).json({ error: "انبار نامعتبر است" });
  try {
    res.json(await closeWarehouseQuantity(warehouseId, req.user?.id ?? null));
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در بستن تعدادی انبار" });
  }
});

export default router;
