import { Router } from "express";
import {
  assertDateInCurrentFiscalPeriod,
  listConfirmCandidates,
  listRevertCandidates,
  confirmWarehouses,
  revertWarehouses,
} from "../services/warehouseConfirmationService";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

// =========================================================================
// «تایید انبار» — طبق سند «تایید انبار.md». جایگزین کامل «بستن موجودی انبار» قدیمی (بدون تاریخچه/Audit).
// منطق واقعی در services/warehouseConfirmationService.ts پیاده شده — این فایل فقط لایه‌ی REST آن است.
// =========================================================================

const FORM = findFormPrefix("warehousing-warehouse-confirmation");

const router = Router();

router.get("/warehouse-confirmations/candidates", can(`${FORM}.view`), async (req, res) => {
  const mode = req.query.mode as string;
  const dateStr = req.query.date as string;
  if (mode !== "CONFIRM" && mode !== "REVERT") return res.status(400).json({ error: "نوع عملیات نامعتبر است" });
  if (!dateStr) return res.status(400).json({ error: "تاریخ الزامی است" });

  try {
    const date = new Date(dateStr);
    await assertDateInCurrentFiscalPeriod(date);
    const candidates = mode === "CONFIRM" ? await listConfirmCandidates(date) : await listRevertCandidates(date);
    res.json(candidates);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در بارگذاری اطلاعات" });
  }
});

router.post("/warehouse-confirmations/confirm", can(`${FORM}.confirm`), async (req, res) => {
  const { date, warehouseIds } = req.body as { date: string; warehouseIds: number[] };
  if (!date || !Array.isArray(warehouseIds) || !warehouseIds.length) {
    return res.status(400).json({ error: "تاریخ و حداقل یک انبار الزامی است" });
  }
  try {
    const results = await confirmWarehouses(warehouseIds, new Date(date));
    res.json(results);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در تایید انبارها" });
  }
});

router.post("/warehouse-confirmations/revert", can(`${FORM}.revertConfirm`), async (req, res) => {
  const { date, warehouseIds } = req.body as { date: string; warehouseIds: number[] };
  if (!date || !Array.isArray(warehouseIds) || !warehouseIds.length) {
    return res.status(400).json({ error: "تاریخ و حداقل یک انبار الزامی است" });
  }
  try {
    const results = await revertWarehouses(warehouseIds, new Date(date));
    res.json(results);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در برگشت از تایید انبارها" });
  }
});

export default router;
