import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { StoreSaleError } from "../services/storeSaleService";
import { issueStoreDeliveryJournal, revertStoreDeliveryJournal } from "../services/storeSaleDeliveryJournalService";
import { buildDeliveryPreview, confirmStoreDelivery, createStoreDelivery, deleteStoreDelivery, listStoreDeliveries, listStoreSaleIssues, loadStoreDelivery, unconfirmStoreDelivery, updateStoreDelivery } from "../services/storeSaleDeliveryService";

// فروش فروشگاهی › عملیات › «تحویل فروش»؛ منطق فقط در services/storeSaleDeliveryService.ts.

const FORM = findFormPrefix("store-deliveries");
const router = Router();

const fail = (res: any, e: any, fallback: string) => res.status(400).json({ error: e instanceof StoreSaleError ? e.message : e?.message || fallback });

router.get("/store-sale-deliveries", can(`${FORM}.view`), async (_req, res) => {
  res.json(await listStoreDeliveries());
});

// پیش‌نمایش پنجره‌ی «جدید»: ایستگاه + تا تاریخ (statuses = وضعیت‌های انتخابی کاربر برای فروش‌های تسویه‌نشده)
router.post("/store-sale-deliveries/preview", can(`${FORM}.create`), async (req, res) => {
  try {
    res.json(await buildDeliveryPreview(Number(req.body?.stationId), req.body?.date, req.body?.statuses ?? {}));
  } catch (e) {
    fail(res, e, "خطا در بارگذاری فروش‌ها");
  }
});

router.get("/store-sale-deliveries/:id", can(`${FORM}.view`), async (req, res) => {
  const d = await loadStoreDelivery(Number(req.params.id));
  if (!d) return res.status(404).json({ error: "تحویل فروش یافت نشد" });
  res.json(d);
});

router.post("/store-sale-deliveries", can(`${FORM}.create`), async (req, res) => {
  try {
    const d = await createStoreDelivery(req.body ?? {});
    res.status(201).json({ id: d.id, number: d.number });
  } catch (e) {
    fail(res, e, "خطا در ثبت تحویل فروش");
  }
});

router.put("/store-sale-deliveries/:id", can(`${FORM}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!(await prisma.storeSaleDelivery.findUnique({ where: { id }, select: { id: true } }))) return res.status(404).json({ error: "تحویل فروش یافت نشد" });
    await updateStoreDelivery(id, req.body?.statuses ?? {});
    res.json({ id });
  } catch (e) {
    fail(res, e, "خطا در ویرایش تحویل فروش");
  }
});

router.delete("/store-sale-deliveries/:id", can(`${FORM}.delete`), async (req, res) => {
  try {
    await deleteStoreDelivery(Number(req.params.id));
    res.status(204).send();
  } catch (e) {
    fail(res, e, "خطا در حذف تحویل فروش");
  }
});

router.post("/store-sale-deliveries/:id/confirm", can(`${FORM}.confirm`), async (req, res) => {
  try {
    res.json(await confirmStoreDelivery(Number(req.params.id)));
  } catch (e) {
    fail(res, e, "خطا در تایید تحویل فروش");
  }
});

router.post("/store-sale-deliveries/:id/unconfirm", can(`${FORM}.unconfirm`), async (req, res) => {
  try {
    await unconfirmStoreDelivery(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در لغو تایید تحویل فروش");
  }
});

router.post("/store-sale-deliveries/:id/issue-journal-entry", can(`${FORM}.issueJournalEntry`), async (req, res) => {
  try {
    const entry = await issueStoreDeliveryJournal(Number(req.params.id));
    res.json({ ok: true, journalEntryId: entry.id, referenceNumber: entry.referenceNumber });
  } catch (e) {
    fail(res, e, "خطا در صدور سند حسابداری تحویل فروش");
  }
});

router.delete("/store-sale-deliveries/:id/journal-entry", can(`${FORM}.revertJournalEntry`), async (req, res) => {
  try {
    await revertStoreDeliveryJournal(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در حذف سند حسابداری تحویل فروش");
  }
});

// فهرست فقط‌خواندنیِ حواله / برگشت حواله‌ی فروش فروشگاهی (اسناد انبارِ ساخته‌شده با تایید تحویل)
const ISSUE_FORM = findFormPrefix("store-sale-issues");
const RETURN_FORM = findFormPrefix("store-sale-returns");
router.get("/store-sale-issues", can(`${ISSUE_FORM}.view`), async (_req, res) => {
  res.json(await listStoreSaleIssues("ISSUE"));
});
router.get("/store-sale-returns", can(`${RETURN_FORM}.view`), async (_req, res) => {
  res.json(await listStoreSaleIssues("RETURN"));
});

export default router;
