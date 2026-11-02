import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { assertRecordNotStale } from "../utils/concurrency";
import { StoreSaleError } from "../services/storeSaleService";
import { createPrintGroup, listPrintGroups, listJobsForSale, loadPrintGroup, printSaleInvoice, printSaleOrder, reportJobResult, retryJob, updatePrintGroup } from "../services/storePrintService";

// فروش فروشگاهی › گروه چاپ + دستور چاپ فاکتور/سفارش؛ منطق فقط در services/storePrintService.ts.
const GROUP = findFormPrefix("print-groups");
const SALE = findFormPrefix("store-sales");
const router = Router();
const fail = (res: any, e: any, fallback: string) => {
  if (e?.code === "P2002") return res.status(400).json({ error: "عنوان گروه چاپ تکراری است" });
  return res.status(400).json({ error: e instanceof StoreSaleError ? e.message : e?.message || fallback });
};

// فهرست برای انتخابگر تب «چاپگرها»ی ایستگاه
router.get("/print-groups", async (req, res) => {
  const all = await listPrintGroups();
  res.json(req.query.activeOnly === "true" ? all.filter((g) => g.isActive) : all);
});

router.get("/print-groups/:id", can(`${GROUP}.view`), async (req, res) => {
  const g = await loadPrintGroup(Number(req.params.id));
  if (!g) return res.status(404).json({ error: "گروه چاپ یافت نشد" });
  res.json(g);
});

router.post("/print-groups", can(`${GROUP}.create`), async (req, res) => {
  try {
    const g = await createPrintGroup(req.body);
    res.status(201).json({ id: g.id, code: g.code });
  } catch (e) {
    fail(res, e, "خطا در ثبت گروه چاپ");
  }
});

router.put("/print-groups/:id", can(`${GROUP}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.printGroup.findUnique({ where: { id }, select: { updatedAt: true } });
    if (!ex) return res.status(404).json({ error: "گروه چاپ یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "گروه چاپ");
    await updatePrintGroup(id, req.body);
    res.json({ id });
  } catch (e) {
    fail(res, e, "خطا در ویرایش گروه چاپ");
  }
});

router.delete("/print-groups/:id", can(`${GROUP}.delete`), async (req, res) => {
  try {
    await prisma.printGroup.delete({ where: { id: Number(req.params.id) } });
    res.status(204).send();
  } catch (e) {
    fail(res, e, "خطا در حذف گروه چاپ");
  }
});

// چاپ فاکتور یا سفارش یک فروش: { kind: "INVOICE" | "ORDER", mode?: "NEW" | "ALL" } — فقط مجوز مشاهده‌ی فروش فروشگاهی
router.post("/store-sales/:id/print", can(`${SALE}.view`), async (req, res) => {
  try {
    const saleId = Number(req.params.id);
    if (req.body?.kind === "INVOICE") return res.json(await printSaleInvoice(saleId));
    if (req.body?.kind === "ORDER") return res.json(await printSaleOrder(saleId, req.body?.mode === "ALL" ? "ALL" : "NEW"));
    throw new StoreSaleError("نوع چاپ نامعتبر است");
  } catch (e) {
    fail(res, e, "خطا در چاپ");
  }
});

router.get("/store-sales/:id/print-jobs", can(`${SALE}.view`), async (req, res) => {
  try {
    res.json(await listJobsForSale(Number(req.params.id)));
  } catch (e) {
    fail(res, e, "خطا");
  }
});

router.post("/print-jobs/:id/retry", can(`${SALE}.view`), async (req, res) => {
  try {
    res.json(await retryJob(Number(req.params.id)));
  } catch (e) {
    fail(res, e, "خطا در تکرار چاپ");
  }
});

// نتیجه‌ی چاپ از برنامه‌ی صندوق (کلاینت): { ok, error? }
router.post("/print-jobs/:id/result", can(`${SALE}.view`), async (req, res) => {
  try {
    res.json(await reportJobResult(Number(req.params.id), req.body ?? {}));
  } catch (e) {
    fail(res, e, "خطا در ثبت نتیجه‌ی چاپ");
  }
});

export default router;
