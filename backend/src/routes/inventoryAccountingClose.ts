import { Router } from "express";
import { AuthedRequest } from "../middleware/auth";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { getAccountingCloseStatus, closeInventoryAccounting, reverseInventoryAccountingClose } from "../services/inventoryAccountingCloseService";

// =========================================================================
// «بستن حسابداری موجودی» / «برگشت بستن حسابداری موجودی» (مدیریت موجودی و انبار › عملیات پایان دوره). همه‌ی قواعد و هم‌زمانی در
// services/inventoryAccountingCloseService.ts — این فایل فقط لایه‌ی REST است.
// =========================================================================

const FORM = findFormPrefix("warehousing-accounting-close");

const router = Router();

router.get("/inventory-accounting-close", can(`${FORM}.view`), async (_req, res) => {
  try {
    res.json(await getAccountingCloseStatus());
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در بارگذاری اطلاعات" });
  }
});

router.post("/inventory-accounting-close/close", can(`${FORM}.close`), async (req: AuthedRequest, res) => {
  try {
    res.json(await closeInventoryAccounting(req.user?.id ?? null));
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در بستن حسابداری موجودی" });
  }
});

router.post("/inventory-accounting-close/reverse", can(`${FORM}.reverse`), async (req: AuthedRequest, res) => {
  try {
    res.json(await reverseInventoryAccountingClose(req.user?.id ?? null));
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در برگشت بستن حسابداری موجودی" });
  }
});

export default router;
