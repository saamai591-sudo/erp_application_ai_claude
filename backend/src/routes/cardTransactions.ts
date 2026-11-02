import { Router } from "express";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { StoreSaleError } from "../services/storeSaleService";
import { cancelTransaction, driverOptions, listTransactions, refreshTransaction, resolveTransaction, startTransaction } from "../services/cardTerminalService";

// فروش فروشگاهی › تراکنش‌های کارتخوان؛ منطق فقط در services/cardTerminalService.ts. دسترسی = همان فرم «دریافت فروشگاهی» (مشاهده / ایجاد).
const FORM = findFormPrefix("store-receipts");
const router = Router();
const fail = (res: any, e: any) => res.status(400).json({ error: e instanceof StoreSaleError ? e.message : e?.message || "خطا در تراکنش کارتخوان" });

router.get("/card-transactions/drivers", (_req, res) => res.json(driverOptions()));

router.get("/card-transactions", can(`${FORM}.view`), async (req, res) => {
  try {
    const saleId = Number(req.query.saleId);
    if (!saleId) throw new StoreSaleError("فروش مشخص نیست");
    res.json(await listTransactions(saleId));
  } catch (e) {
    fail(res, e);
  }
});

router.post("/card-transactions", can(`${FORM}.create`), async (req, res) => {
  try {
    res.status(201).json(await startTransaction(req.body ?? {}));
  } catch (e) {
    fail(res, e);
  }
});

router.post("/card-transactions/:id/refresh", can(`${FORM}.create`), async (req, res) => {
  try {
    res.json(await refreshTransaction(Number(req.params.id)));
  } catch (e) {
    fail(res, e);
  }
});

router.post("/card-transactions/:id/cancel", can(`${FORM}.create`), async (req, res) => {
  try {
    res.json(await cancelTransaction(Number(req.params.id)));
  } catch (e) {
    fail(res, e);
  }
});

router.post("/card-transactions/:id/resolve", can(`${FORM}.create`), async (req, res) => {
  try {
    res.json(await resolveTransaction(Number(req.params.id), req.body ?? {}));
  } catch (e) {
    fail(res, e);
  }
});

export default router;
