import { Router } from "express";
import { prisma } from "../lib/prisma";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";
import { MACRO_ACTIONS, MACRO_PRESETS, createMacro, draftFromQuote, deleteMacro, getMacro, listMacros, updateMacro } from "../services/assistantMacroService";

// تنظیم «دستورهای میانبر دستیار» (برای کل شرکت)؛ قواعد در services/assistantMacroService.ts
const FORM = findFormPrefix("assistant-macros");
const router = Router();
const fail = (res: any, e: any, fallback: string) => res.status(400).json({ error: e?.message || fallback });

router.get("/assistant-macros/actions", can(`${FORM}.view`), (_req, res) => res.json(MACRO_ACTIONS.map((a) => ({ ...a, presets: MACRO_PRESETS[a.key] ?? [] }))));

// گزینه‌های فرم (نقش‌ها، انواع و مراکز فروش) تا فرم به دسترسی فرم‌های دیگر وابسته نباشد
router.get("/assistant-macros/options", can(`${FORM}.view`), async (_req, res) => {
  const [roles, salesTypes, salesCenters] = await Promise.all([
    prisma.role.findMany({ select: { id: true, title: true }, orderBy: { code: "asc" } }),
    prisma.salesType.findMany({ select: { id: true, title: true }, orderBy: { code: "asc" } }),
    prisma.salesCenter.findMany({ where: { isActive: true }, select: { id: true, title: true }, orderBy: { code: "asc" } }),
  ]);
  res.json({ roles, salesTypes, salesCenters });
});

// پیش‌نویس دستور از روی یک پیش‌فاکتور ذخیره‌شده (برای دکمه‌ی «ساخت دستور دستیار» در فرم پیش‌فاکتور)
router.get("/assistant-macros/draft-from-quote/:quoteId", can(`${FORM}.create`), async (req, res) => {
  try {
    res.json(await draftFromQuote(Number(req.params.quoteId)));
  } catch (e) {
    fail(res, e, "خطا در ساخت پیش‌نویس");
  }
});

router.get("/assistant-macros", can(`${FORM}.view`), async (_req, res) => {
  try {
    res.json(await listMacros());
  } catch (e) {
    fail(res, e, "خطا در خواندن دستورها");
  }
});

router.get("/assistant-macros/:id", can(`${FORM}.view`), async (req, res) => {
  try {
    res.json(await getMacro(Number(req.params.id)));
  } catch (e) {
    fail(res, e, "خطا در خواندن دستور");
  }
});

router.post("/assistant-macros", can(`${FORM}.create`), async (req, res) => {
  try {
    res.status(201).json(await createMacro(req.body));
  } catch (e) {
    fail(res, e, "خطا در ثبت دستور");
  }
});

router.put("/assistant-macros/:id", can(`${FORM}.edit`), async (req, res) => {
  try {
    res.json(await updateMacro(Number(req.params.id), req.body));
  } catch (e) {
    fail(res, e, "خطا در ویرایش دستور");
  }
});

router.delete("/assistant-macros/:id", can(`${FORM}.delete`), async (req, res) => {
  try {
    await deleteMacro(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    fail(res, e, "خطا در حذف دستور");
  }
});

export default router;
