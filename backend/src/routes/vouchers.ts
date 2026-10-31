import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can, userHasAction } from "../authz/guard";
import type { AuthedRequest } from "../middleware/auth";
import { findFormPrefix } from "../authz/registry";
import { assertRecordNotStale } from "../utils/concurrency";
import {
  VoucherError,
  createVoucherSale,
  createVoucherType,
  deleteVoucherSale,
  issueVoucherBatch,
  issueVoucherSaleJournal,
  listVoucherBatches,
  listVoucherSales,
  listVoucherTypes,
  listVouchers,
  liabilityReport,
  loadVoucherSale,
  lookupVoucher,
  revertVoucherSaleJournal,
  typeShape,
  updateVoucherType,
  voidVoucher,
} from "../services/voucherService";

// باشگاه مشتریان › بن‌کارت؛ منطق فقط در services/voucherService.ts.

const TYPE = findFormPrefix("voucher-types");
const BATCH = findFormPrefix("voucher-batches");
const SALE = findFormPrefix("voucher-sales");
const LIST = findFormPrefix("vouchers");
const REPORT = findFormPrefix("voucher-liability");
const STORE_SALE = findFormPrefix("store-sales");
const router = Router();
const fail = (res: any, e: any, fallback: string) => {
  if (e?.code === "P2002") return res.status(400).json({ error: "مقدار تکراری است (عنوان نوع بن باید یکتا باشد)" });
  return res.status(400).json({ error: e instanceof VoucherError ? e.message : e?.message || fallback });
};
const num = (v: unknown) => (v ? Number(v) : undefined);

// ── نوع بن ──
router.get("/voucher-types", async (_req, res) => {
  res.json(await listVoucherTypes());
});
router.post("/voucher-types", can(`${TYPE}.create`), async (req, res) => {
  try {
    const t = await createVoucherType(req.body);
    res.status(201).json({ id: t.id, code: t.code });
  } catch (e) {
    fail(res, e, "خطا در ثبت نوع بن");
  }
});
router.put("/voucher-types/:id", can(`${TYPE}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.voucherType.findUnique({ where: { id }, select: { updatedAt: true } });
    if (!ex) return res.status(404).json({ error: "نوع بن یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "نوع بن");
    await updateVoucherType(id, req.body);
    res.json({ id });
  } catch (e) {
    fail(res, e, "خطا در ویرایش نوع بن");
  }
});
router.delete("/voucher-types/:id", can(`${TYPE}.delete`), async (req, res) => {
  try {
    await prisma.voucherType.delete({ where: { id: Number(req.params.id) } });
    res.status(204).send();
  } catch (e) {
    fail(res, e, "خطا در حذف نوع بن");
  }
});
router.get("/voucher-types/:id", can(`${TYPE}.view`), async (req, res) => {
  const t = await prisma.voucherType.findUnique({ where: { id: Number(req.params.id) }, include: { _count: { select: { vouchers: true } } } });
  if (!t) return res.status(404).json({ error: "نوع بن یافت نشد" });
  res.json(typeShape(t));
});

// ── صدور دسته‌ای ──
router.get("/voucher-batches", can(`${BATCH}.view`), async (_req, res) => {
  res.json(await listVoucherBatches());
});
router.post("/voucher-batches", can(`${BATCH}.create`), async (req, res) => {
  try {
    const b = await issueVoucherBatch(req.body);
    res.status(201).json({ id: b.id, number: b.number });
  } catch (e) {
    fail(res, e, "خطا در صدور بن");
  }
});

// ── بن‌ها ──
router.get("/vouchers", can(`${LIST}.view`), async (req, res) => {
  const q = req.query;
  res.json(await listVouchers({ typeId: num(q.typeId), batchId: num(q.batchId), customerId: num(q.customerId), saleId: num(q.saleId), status: q.status ? String(q.status) : undefined, search: q.search ? String(q.search) : undefined, limit: num(q.limit) }));
});
// استعلام یک بن هنگام ثبت دریافت در فروش فروشگاهی (هر کاربری که دریافت فروش ثبت می‌کند)
router.get("/vouchers/lookup", async (req, res) => {
  try {
    const uid = (req as AuthedRequest).user!.id;
    if (!(await userHasAction(uid, `${STORE_SALE}.create`)) && !(await userHasAction(uid, `${STORE_SALE}.edit`))) return res.status(403).json({ error: "دسترسی کافی ندارید" });
    const d = new Date(String(req.query.date ?? ""));
    if (Number.isNaN(d.getTime())) throw new VoucherError("تاریخ نامعتبر است");
    res.json(await lookupVoucher(req.query.serial, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))));
  } catch (e) {
    fail(res, e, "خطا در استعلام بن");
  }
});
router.post("/vouchers/:id/void", can(`${LIST}.void`), async (req, res) => {
  try {
    await voidVoucher(Number(req.params.id), req.body?.reason);
    res.json({ id: Number(req.params.id) });
  } catch (e) {
    fail(res, e, "خطا در ابطال بن");
  }
});

// ── فروش بن به سازمان ──
router.get("/voucher-sales", can(`${SALE}.view`), async (_req, res) => {
  res.json(await listVoucherSales());
});
router.get("/voucher-sales/:id", can(`${SALE}.view`), async (req, res) => {
  const s = await loadVoucherSale(Number(req.params.id));
  if (!s) return res.status(404).json({ error: "فروش بن یافت نشد" });
  res.json(s);
});
router.post("/voucher-sales", can(`${SALE}.create`), async (req, res) => {
  try {
    const s = await createVoucherSale(req.body);
    res.status(201).json({ id: s.id, number: s.number });
  } catch (e) {
    fail(res, e, "خطا در ثبت فروش بن");
  }
});
router.delete("/voucher-sales/:id", can(`${SALE}.delete`), async (req, res) => {
  try {
    await deleteVoucherSale(Number(req.params.id));
    res.status(204).send();
  } catch (e) {
    fail(res, e, "خطا در حذف فروش بن");
  }
});
router.post("/voucher-sales/:id/issue-journal-entry", can(`${SALE}.issueJournalEntry`), async (req, res) => {
  try {
    const e = await issueVoucherSaleJournal(Number(req.params.id));
    res.json({ journalEntryId: e.id });
  } catch (e) {
    fail(res, e, "خطا در صدور سند حسابداری");
  }
});
router.delete("/voucher-sales/:id/journal-entry", can(`${SALE}.deleteJournalEntry`), async (req, res) => {
  try {
    await revertVoucherSaleJournal(Number(req.params.id));
    res.status(204).send();
  } catch (e) {
    fail(res, e, "خطا در حذف سند حسابداری");
  }
});

// ── گزارش تعهد ──
router.get("/voucher-liability-report", can(`${REPORT}.view`), async (_req, res) => {
  res.json(await liabilityReport());
});

export default router;
