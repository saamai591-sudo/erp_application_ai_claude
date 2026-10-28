import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can, userHasAction } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import type { AuthedRequest } from "../middleware/auth";
import { assertRecordNotStale } from "../utils/concurrency";
import { paidBySale, receiptShape } from "../services/storeReceiptService";
import { StoreSaleError, createStoreSale, declareStoreSaleCredit, deleteStoreSale, revokeStoreSaleCredit, saleShape, sellableItems, updateStoreSale } from "../services/storeSaleService";

// فروش فروشگاهی › عملیات › «فروش فروشگاهی»؛ منطق فقط در services/storeSaleService.ts.

const FORM = findFormPrefix("store-sales");
const router = Router();

const INCLUDE = { station: { select: { id: true, title: true } }, customer: { select: { party: { select: { detailTitle: true, name: true, firstName: true, lastName: true } } } }, lines: true } as const;
const DETAIL_INCLUDE = {
  station: { select: { id: true, title: true } },
  customer: { select: { party: { select: { detailTitle: true, name: true, firstName: true, lastName: true } } } },
  lines: { include: { goodsItem: { select: { fullCode: true, title: true, barcode: true } }, unit: { select: { title: true } } }, orderBy: { rowOrder: "asc" } },
} as const;

const fail = (res: any, e: any, fallback: string) => res.status(400).json({ error: e instanceof StoreSaleError ? e.message : e?.message || fallback });
const canChangePrice = (req: any) => userHasAction((req as AuthedRequest).user!.id, `${FORM}.changePrice`);

// اقلام قابل‌فروش یک ایستگاه در یک تاریخ (برای بارکد و جست‌وجوی فرم)
router.get("/store-sales/sellable-items", can(`${FORM}.create`), async (req, res) => {
  try {
    const d = new Date(String(req.query.date ?? ""));
    if (Number.isNaN(d.getTime())) throw new StoreSaleError("تاریخ نامعتبر است");
    res.json({ ...(await sellableItems(Number(req.query.stationId), new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())))), canChangePrice: await canChangePrice(req) });
  } catch (e) {
    fail(res, e, "خطا در دریافت اقلام قابل فروش");
  }
});

router.get("/store-sales", can(`${FORM}.view`), async (req, res) => {
  const where: any = {};
  if (req.query.stationId) where.stationId = Number(req.query.stationId);
  const rows = await prisma.storeSale.findMany({ where, include: INCLUDE, orderBy: { id: "desc" }, take: 5000 });
  const paid = await paidBySale(rows.map((s) => s.id));
  res.json(rows.map((s) => saleShape(s, false, paid.get(s.id) ?? 0)));
});

router.get("/store-sales/:id", can(`${FORM}.view`), async (req, res) => {
  const s = await prisma.storeSale.findUnique({ where: { id: Number(req.params.id) }, include: DETAIL_INCLUDE });
  if (!s) return res.status(404).json({ error: "فروش یافت نشد" });
  const receipts = await prisma.storeReceipt.findMany({ where: { saleId: s.id }, include: { station: { select: { title: true } }, cashBox: { select: { title: true } }, cardReader: { select: { title: true } } }, orderBy: { id: "asc" } });
  const paid = receipts.reduce((n, r) => n + Number(r.amount), 0);
  res.json({ ...saleShape(s, true, paid), receipts: receipts.map((r) => receiptShape(r)) });
});

// «ثبت نسیه» عامدانه‌ی باقیمانده‌ی دریافت (و لغو آن)
router.post("/store-sales/:id/declare-credit", can(`${FORM}.declareCredit`), async (req, res) => {
  try {
    await declareStoreSaleCredit(Number(req.params.id), req.body?.note ? String(req.body.note) : null, (req as AuthedRequest).user?.id ?? null);
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در ثبت نسیه");
  }
});
router.post("/store-sales/:id/revoke-credit", can(`${FORM}.declareCredit`), async (req, res) => {
  try {
    await revokeStoreSaleCredit(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در لغو نسیه");
  }
});

router.post("/store-sales", can(`${FORM}.create`), async (req, res) => {
  try {
    const created = await createStoreSale(req.body, await canChangePrice(req));
    res.status(201).json({ id: created.id, number: created.number });
  } catch (e) {
    fail(res, e, "خطا در ثبت فروش");
  }
});

router.put("/store-sales/:id", can(`${FORM}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.storeSale.findUnique({ where: { id }, select: { updatedAt: true } });
    if (!ex) return res.status(404).json({ error: "فروش یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "فروش فروشگاهی");
    await updateStoreSale(id, req.body, await canChangePrice(req));
    res.json({ id });
  } catch (e) {
    fail(res, e, "خطا در ویرایش فروش");
  }
});

router.delete("/store-sales/:id", can(`${FORM}.delete`), async (req, res) => {
  try {
    await deleteStoreSale(Number(req.params.id));
    res.status(204).send();
  } catch (e) {
    fail(res, e, "خطا در حذف فروش");
  }
});

export default router;
