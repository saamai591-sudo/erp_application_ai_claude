import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can, userHasAction } from "../authz/guard";
import type { AuthedRequest } from "../middleware/auth";
import { findFormPrefix } from "../authz/registry";
import { assertRecordNotStale } from "../utils/concurrency";
import { StoreSaleError, sellableItems } from "../services/storeSaleService";
import {
  createStorePayment,
  createStoreReturn,
  deleteStorePayment,
  deleteStoreReturn,
  listStorePayments,
  listStoreReturns,
  loadStorePayment,
  loadStoreReturn,
  payableReturns,
  paymentOptions,
  returnableLines,
  returnableSales,
  updateStorePayment,
  updateStoreReturn,
} from "../services/storeReturnService";

// فروش فروشگاهی › «برگشت فروش» و «پرداخت فروشگاهی»؛ منطق فقط در services/storeReturnService.ts.

const RET = findFormPrefix("store-returns");
const PAY = findFormPrefix("store-payments");
const SALE = findFormPrefix("store-sales");
const canChangePrice = (req: any) => userHasAction((req as AuthedRequest).user!.id, `${SALE}.changePrice`);
const router = Router();
const fail = (res: any, e: any, fallback: string) => res.status(400).json({ error: e instanceof StoreSaleError ? e.message : e?.message || fallback });

// ── برگشت فروش ──
// اقلام قابل‌برگشتِ بدون مبنا (بارکد/جست‌وجو): همان اقلامِ قابل‌فروشِ ایستگاه با فی اعلامیه‌ی مؤثر در تاریخ برگشت
router.get("/store-returns/sellable-items", can(`${RET}.create`), async (req, res) => {
  try {
    const d = new Date(String(req.query.date ?? ""));
    if (Number.isNaN(d.getTime())) throw new StoreSaleError("تاریخ نامعتبر است");
    res.json({ ...(await sellableItems(Number(req.query.stationId), new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())))), canChangePrice: await canChangePrice(req) });
  } catch (e) {
    fail(res, e, "خطا در دریافت اقلام قابل برگشت");
  }
});

router.get("/store-returns/returnable-sales", can(`${RET}.create`), async (req, res) => {
  res.json(await returnableSales(req.query.saleId ? Number(req.query.saleId) : undefined, req.query.stationId ? Number(req.query.stationId) : undefined));
});

// ردیف‌های قابل‌برگشتِ یک فروش (excludeReturnId = برگشتِ در حال ویرایش)
router.get("/store-returns/returnable-lines", can(`${RET}.view`), async (req, res) => {
  try {
    const r = await returnableLines(Number(req.query.saleId), req.query.excludeReturnId ? Number(req.query.excludeReturnId) : undefined);
    res.json({ saleNumber: r.sale.number, saleDate: r.sale.date.toISOString().slice(0, 10), lines: r.lines });
  } catch (e) {
    fail(res, e, "خطا در بارگذاری ردیف‌های فروش");
  }
});

router.get("/store-returns", can(`${RET}.view`), async (req, res) => {
  res.json(await listStoreReturns(req.query.saleId ? Number(req.query.saleId) : undefined));
});

router.get("/store-returns/:id", can(`${RET}.view`), async (req, res) => {
  const r = await loadStoreReturn(Number(req.params.id));
  if (!r) return res.status(404).json({ error: "برگشت فروش یافت نشد" });
  res.json(r);
});

router.post("/store-returns", can(`${RET}.create`), async (req, res) => {
  try {
    const c = await createStoreReturn(req.body, await canChangePrice(req));
    res.status(201).json({ id: c.id, number: c.number });
  } catch (e) {
    fail(res, e, "خطا در ثبت برگشت فروش");
  }
});

router.put("/store-returns/:id", can(`${RET}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.storeSaleReturn.findUnique({ where: { id }, select: { updatedAt: true } });
    if (!ex) return res.status(404).json({ error: "برگشت فروش یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "برگشت فروش");
    await updateStoreReturn(id, req.body, await canChangePrice(req));
    res.json({ id });
  } catch (e) {
    fail(res, e, "خطا در ویرایش برگشت فروش");
  }
});

router.delete("/store-returns/:id", can(`${RET}.delete`), async (req, res) => {
  try {
    await deleteStoreReturn(Number(req.params.id));
    res.status(204).send();
  } catch (e) {
    fail(res, e, "خطا در حذف برگشت فروش");
  }
});

// ── پرداخت فروشگاهی ──
router.get("/store-payments/payable-returns", can(`${PAY}.create`), async (req, res) => {
  res.json(await payableReturns(req.query.returnId ? Number(req.query.returnId) : undefined));
});

router.get("/store-payments/options", can(`${PAY}.view`), async (req, res) => {
  try {
    res.json(await paymentOptions(Number(req.query.returnId)));
  } catch (e) {
    fail(res, e, "خطا در بارگذاری");
  }
});

router.get("/store-payments", can(`${PAY}.view`), async (req, res) => {
  res.json(await listStorePayments(req.query.returnId ? Number(req.query.returnId) : undefined));
});

router.get("/store-payments/:id", can(`${PAY}.view`), async (req, res) => {
  const p = await loadStorePayment(Number(req.params.id));
  if (!p) return res.status(404).json({ error: "پرداخت یافت نشد" });
  res.json(p);
});

router.post("/store-payments", can(`${PAY}.create`), async (req, res) => {
  try {
    const c = await createStorePayment(req.body);
    res.status(201).json({ id: c.id, number: c.number });
  } catch (e) {
    fail(res, e, "خطا در ثبت پرداخت");
  }
});

router.put("/store-payments/:id", can(`${PAY}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.storePayment.findUnique({ where: { id }, select: { updatedAt: true } });
    if (!ex) return res.status(404).json({ error: "پرداخت یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "پرداخت فروشگاهی");
    await updateStorePayment(id, req.body);
    res.json({ id });
  } catch (e) {
    fail(res, e, "خطا در ویرایش پرداخت");
  }
});

router.delete("/store-payments/:id", can(`${PAY}.delete`), async (req, res) => {
  try {
    await deleteStorePayment(Number(req.params.id));
    res.status(204).send();
  } catch (e) {
    fail(res, e, "خطا در حذف پرداخت");
  }
});

export default router;
