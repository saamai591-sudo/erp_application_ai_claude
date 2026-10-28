import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { assertRecordNotStale } from "../utils/concurrency";
import { StoreSaleError } from "../services/storeSaleService";
import { createStoreReceipt, createStoreReceipts, deleteStoreReceipt, payableSales, receiptShape, updateStoreReceipt } from "../services/storeReceiptService";

// فروش فروشگاهی › عملیات › «دریافت فروشگاهی»؛ منطق فقط در services/storeReceiptService.ts.

const FORM = findFormPrefix("store-receipts");
const router = Router();

const INCLUDE = {
  station: { select: { title: true } },
  cashBox: { select: { title: true } },
  cardReader: { select: { title: true } },
  sale: { select: { number: true, customer: { select: { party: { select: { detailTitle: true, name: true, firstName: true, lastName: true } } } } } },
} as const;

const fail = (res: any, e: any, fallback: string) => res.status(400).json({ error: e instanceof StoreSaleError ? e.message : e?.message || fallback });

// فروش‌های دارای باقی‌مانده برای انتخاب در فرم (saleId = فروشِ دریافتِ در حال ویرایش)
router.get("/store-receipts/payable-sales", can(`${FORM}.create`), async (req, res) => {
  res.json(await payableSales(req.query.saleId ? Number(req.query.saleId) : undefined));
});

router.get("/store-receipts", can(`${FORM}.view`), async (req, res) => {
  const where: any = {};
  if (req.query.saleId) where.saleId = Number(req.query.saleId);
  const rows = await prisma.storeReceipt.findMany({ where, include: INCLUDE, orderBy: { id: "desc" }, take: 5000 });
  res.json(rows.map(receiptShape));
});

router.get("/store-receipts/:id", can(`${FORM}.view`), async (req, res) => {
  const r = await prisma.storeReceipt.findUnique({ where: { id: Number(req.params.id) }, include: INCLUDE });
  if (!r) return res.status(404).json({ error: "دریافت یافت نشد" });
  res.json(receiptShape(r));
});

router.post("/store-receipts", can(`${FORM}.create`), async (req, res) => {
  try {
    const c = await createStoreReceipt(req.body);
    res.status(201).json({ id: c.id, number: c.number });
  } catch (e) {
    fail(res, e, "خطا در ثبت دریافت");
  }
});

// ثبت هم‌زمانِ چند دریافت کارتی (از دیالوگ «دریافت با کارتخوان» فرم فروش): { saleId, date, description?, items: [{ cardReaderId, amount }] } — همه‌یا‌هیچ
router.post("/store-receipts/card-batch", can(`${FORM}.create`), async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) throw new StoreSaleError("حداقل یک کارتخوان را انتخاب کنید");
    if (items.some((x: any) => !x?.cardReaderId)) throw new StoreSaleError("برای هر ردیف کارتخوان الزامی است");
    const created = await createStoreReceipts({ ...req.body, items });
    res.status(201).json({ created });
  } catch (e) {
    fail(res, e, "خطا در ثبت دریافت کارتی");
  }
});

router.put("/store-receipts/:id", can(`${FORM}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.storeReceipt.findUnique({ where: { id }, select: { updatedAt: true } });
    if (!ex) return res.status(404).json({ error: "دریافت یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "دریافت فروشگاهی");
    await updateStoreReceipt(id, req.body);
    res.json({ id });
  } catch (e) {
    fail(res, e, "خطا در ویرایش دریافت");
  }
});

router.delete("/store-receipts/:id", can(`${FORM}.delete`), async (req, res) => {
  try {
    await deleteStoreReceipt(Number(req.params.id));
    res.status(204).send();
  } catch (e) {
    fail(res, e, "خطا در حذف دریافت");
  }
});

export default router;
