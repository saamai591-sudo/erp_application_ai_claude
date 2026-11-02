import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can, userHasAction } from "../authz/guard";
import type { AuthedRequest } from "../middleware/auth";
import { findFormPrefix } from "../authz/registry";
import { assertRecordNotStale } from "../utils/concurrency";
import {
  LoyaltyError,
  chargeTypeShape,
  createCard,
  createChargeType,
  createCharges,
  deleteCharges,
  listCards,
  listChargeTypes,
  listCharges,
  loadCard,
  loadCharge,
  lookupCard,
  updateCard,
  updateChargeType,
} from "../services/loyaltyService";

// باشگاه مشتریان › کارت وفاداری؛ منطق فقط در services/loyaltyService.ts.

const TYPE = findFormPrefix("loyalty-charge-types");
const CARD = findFormPrefix("loyalty-cards");
const CHARGE = findFormPrefix("loyalty-charges");
const STORE_SALE = findFormPrefix("store-sales");
const router = Router();
const fail = (res: any, e: any, fallback: string) => {
  if (e?.code === "P2002") return res.status(400).json({ error: "مقدار تکراری است (عنوان نوع شارژ / شماره‌ی کارت باید یکتا باشد)" });
  return res.status(400).json({ error: e instanceof LoyaltyError ? e.message : e?.message || fallback });
};
const num = (v: unknown) => (v ? Number(v) : undefined);

// ── نوع شارژ ──
router.get("/loyalty-charge-types", async (_req, res) => {
  res.json(await listChargeTypes());
});
router.get("/loyalty-charge-types/:id", can(`${TYPE}.view`), async (req, res) => {
  const t = await prisma.loyaltyChargeType.findUnique({ where: { id: Number(req.params.id) }, include: { _count: { select: { charges: true } } } });
  if (!t) return res.status(404).json({ error: "نوع شارژ یافت نشد" });
  res.json(chargeTypeShape(t));
});
router.post("/loyalty-charge-types", can(`${TYPE}.create`), async (req, res) => {
  try {
    const t = await createChargeType(req.body);
    res.status(201).json({ id: t.id, code: t.code });
  } catch (e) {
    fail(res, e, "خطا در ثبت نوع شارژ");
  }
});
router.put("/loyalty-charge-types/:id", can(`${TYPE}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.loyaltyChargeType.findUnique({ where: { id }, select: { updatedAt: true } });
    if (!ex) return res.status(404).json({ error: "نوع شارژ یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "نوع شارژ");
    await updateChargeType(id, req.body);
    res.json({ id });
  } catch (e) {
    fail(res, e, "خطا در ویرایش نوع شارژ");
  }
});
router.delete("/loyalty-charge-types/:id", can(`${TYPE}.delete`), async (req, res) => {
  try {
    await prisma.loyaltyChargeType.delete({ where: { id: Number(req.params.id) } });
    res.status(204).send();
  } catch (e) {
    fail(res, e, "خطا در حذف نوع شارژ");
  }
});

// ── کارت ──
router.get("/loyalty-cards", can(`${CARD}.view`), async (_req, res) => {
  res.json(await listCards());
});
router.get("/loyalty-cards/:id", can(`${CARD}.view`), async (req, res) => {
  const c = await loadCard(Number(req.params.id));
  if (!c) return res.status(404).json({ error: "کارت وفاداری یافت نشد" });
  res.json(c);
});
router.post("/loyalty-cards", can(`${CARD}.create`), async (req, res) => {
  try {
    const c = await createCard(req.body);
    res.status(201).json({ id: c.id });
  } catch (e) {
    fail(res, e, "خطا در ثبت کارت");
  }
});
router.put("/loyalty-cards/:id", can(`${CARD}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.loyaltyCard.findUnique({ where: { id }, select: { updatedAt: true } });
    if (!ex) return res.status(404).json({ error: "کارت وفاداری یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "کارت وفاداری");
    await updateCard(id, req.body);
    res.json({ id });
  } catch (e) {
    fail(res, e, "خطا در ویرایش کارت");
  }
});
router.delete("/loyalty-cards/:id", can(`${CARD}.delete`), async (req, res) => {
  try {
    await prisma.loyaltyCard.delete({ where: { id: Number(req.params.id) } });
    res.status(204).send();
  } catch (e) {
    fail(res, e, "خطا در حذف کارت");
  }
});
// استعلام کارت هنگام تسویه‌ی فروش فروشگاهی (شماره‌ی کارت + کلمه‌ی عبور)؛ POST تا کلمه‌ی عبور در آدرس نیاید
router.post("/loyalty-cards/lookup", async (req, res) => {
  try {
    const uid = (req as AuthedRequest).user!.id;
    if (!(await userHasAction(uid, `${STORE_SALE}.create`)) && !(await userHasAction(uid, `${STORE_SALE}.edit`))) return res.status(403).json({ error: "دسترسی کافی ندارید" });
    res.json(await lookupCard(req.body ?? {}));
  } catch (e) {
    fail(res, e, "خطا در استعلام کارت");
  }
});

// ── شارژ ──
router.get("/loyalty-charges", can(`${CHARGE}.view`), async (req, res) => {
  res.json(await listCharges({ cardId: num(req.query.cardId), typeId: num(req.query.typeId), status: req.query.status ? String(req.query.status) : undefined }));
});
router.get("/loyalty-charges/:id", can(`${CHARGE}.view`), async (req, res) => {
  const c = await loadCharge(Number(req.params.id));
  if (!c) return res.status(404).json({ error: "شارژ یافت نشد" });
  res.json(c);
});
// شارژ یک کارت (فرم «جدید»)
router.post("/loyalty-charges", can(`${CHARGE}.create`), async (req, res) => {
  try {
    const r = await createCharges({ ...req.body, cardIds: req.body?.cardId ? [req.body.cardId] : req.body?.cardIds });
    res.status(201).json(r);
  } catch (e) {
    fail(res, e, "خطا در شارژ کارت");
  }
});
// شارژ گروهی (بالک اکشن)
router.post("/loyalty-charges/bulk", can(`${CHARGE}.bulkCharge`), async (req, res) => {
  try {
    res.status(201).json(await createCharges(req.body ?? {}));
  } catch (e) {
    fail(res, e, "خطا در شارژ گروهی");
  }
});
// حذف شارژهای استفاده‌نشده (بالک اکشن)
router.post("/loyalty-charges/delete", can(`${CHARGE}.delete`), async (req, res) => {
  try {
    res.json(await deleteCharges(req.body?.ids));
  } catch (e) {
    fail(res, e, "خطا در حذف شارژ");
  }
});

export default router;
