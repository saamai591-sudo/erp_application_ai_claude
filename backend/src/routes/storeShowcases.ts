import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can, userHasAction } from "../authz/guard";
import type { AuthedRequest } from "../middleware/auth";
import { findFormPrefix } from "../authz/registry";
import { assertRecordNotStale } from "../utils/concurrency";
import { ShowcaseError, createShowcase, listShowcases, loadShowcase, stationShowcases, updateShowcase } from "../services/storeShowcaseService";

// فروش فروشگاهی › تنظیمات › «ویترین کالا»؛ منطق فقط در services/storeShowcaseService.ts.

const FORM = findFormPrefix("store-showcases");
const SALE = findFormPrefix("store-sales");
const RET = findFormPrefix("store-returns");
const router = Router();
const fail = (res: any, e: any, fallback: string) => {
  if (e?.code === "P2002") return res.status(400).json({ error: "عنوان ویترین تکراری است" });
  return res.status(400).json({ error: e instanceof ShowcaseError ? e.message : e?.message || fallback });
};

// ویترین‌های یک ایستگاه برای سایدبار فرم فروش / برگشت فروش (کاربری که یکی از آن فرم‌ها را ایجاد/ویرایش می‌کند)
router.get("/store-showcases/for-station", async (req, res) => {
  try {
    const uid = (req as AuthedRequest).user!.id;
    const ok = (await userHasAction(uid, `${SALE}.create`)) || (await userHasAction(uid, `${SALE}.edit`)) || (await userHasAction(uid, `${RET}.create`));
    if (!ok) return res.status(403).json({ error: "دسترسی کافی ندارید" });
    res.json(await stationShowcases(Number(req.query.stationId)));
  } catch (e) {
    fail(res, e, "خطا در دریافت ویترین‌ها");
  }
});

// فهرست برای انتخابگر تب «ویترین‌ها»ی ایستگاه (activeOnly=true فقط فعال‌ها)
router.get("/store-showcases", async (req, res) => {
  const all = await listShowcases();
  res.json(req.query.activeOnly === "true" ? all.filter((s) => s.isActive) : all);
});

router.get("/store-showcases/:id", can(`${FORM}.view`), async (req, res) => {
  const s = await loadShowcase(Number(req.params.id));
  if (!s) return res.status(404).json({ error: "ویترین یافت نشد" });
  res.json(s);
});

router.post("/store-showcases", can(`${FORM}.create`), async (req, res) => {
  try {
    const c = await createShowcase(req.body);
    res.status(201).json({ id: c.id, code: c.code });
  } catch (e) {
    fail(res, e, "خطا در ثبت ویترین");
  }
});

router.put("/store-showcases/:id", can(`${FORM}.edit`), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const ex = await prisma.storeShowcase.findUnique({ where: { id }, select: { updatedAt: true } });
    if (!ex) return res.status(404).json({ error: "ویترین یافت نشد" });
    assertRecordNotStale(ex.updatedAt, req.body?.updatedAt, "ویترین");
    await updateShowcase(id, req.body);
    res.json({ id });
  } catch (e) {
    fail(res, e, "خطا در ویرایش ویترین");
  }
});

router.delete("/store-showcases/:id", can(`${FORM}.delete`), async (req, res) => {
  try {
    await prisma.storeShowcase.delete({ where: { id: Number(req.params.id) } });
    res.status(204).send();
  } catch (e) {
    fail(res, e, "خطا در حذف ویترین");
  }
});

export default router;
