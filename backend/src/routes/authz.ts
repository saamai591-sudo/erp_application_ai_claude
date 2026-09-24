import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthedRequest } from "../middleware/auth";
import { REGISTRY, BASE_ACTION_TITLES, sortSubModules } from "../authz/registry";
import { getUserActionKeys } from "../authz/guard";

const router = Router();

// درخت کامل Module → SubModule → Form → Actions، مستقیماً از Registry تولید می‌شود (نه از یک جدول
// جدا) و شناسه‌ی دیتابیسِ هر Action (برای ارسال در permissionIds/actionIds هنگام ذخیره‌ی نقش/کاربر)
// از جدول Action الحاق می‌شود. مصرف‌کننده: Roles.tsx و تب دسترسی مستقیم کاربر در Users.tsx.
router.get("/authz/tree", async (_req, res) => {
  const dbActions = await prisma.action.findMany();
  const idByKey = new Map(dbActions.map((a) => [a.key, a.id]));

  const tree = REGISTRY.map((mod) => ({
    key: mod.key,
    title: mod.title,
    subModules: sortSubModules(mod.subModules).map((sub) => ({
      key: sub.key,
      title: sub.title,
      forms: sub.forms.map((form) => {
        const prefix = `${mod.key}.${sub.key}.${form.key}`;
        const baseActions = form.baseActions.map((b) => ({
          key: `${prefix}.${b}`,
          id: idByKey.get(`${prefix}.${b}`) ?? null,
          title: BASE_ACTION_TITLES[b],
        }));
        const customActions = (form.actions ?? []).map((a) => ({
          key: `${prefix}.${a.key}`,
          id: idByKey.get(`${prefix}.${a.key}`) ?? null,
          title: a.title,
        }));
        return { key: form.key, title: form.title, baseActions, customActions };
      }),
    })),
  }));

  res.json(tree);
});

// فهرست کد Actionهای کاربر جاری (اجتماع نقش‌ها + اعطای مستقیم) — فرانت‌اند یک‌بار در ابتدای بارگذاری
// واکشی و کش می‌کند (نگاه کنید به frontend/src/lib/usePermissions.ts) تا تصمیم بگیرد
// دکمه‌ها/ستون‌ها/آیتم‌های منو را نشان بدهد یا نه. اجرای واقعیِ کنترل دسترسی همیشه سمت بک‌اند
// (can() در authz/guard.ts) است؛ این فقط برای تجربه‌ی کاربری (نمایش/عدم‌نمایش) است.
router.get("/me/permissions", async (req, res) => {
  const codes = await getUserActionKeys((req as AuthedRequest).user!.id);
  res.json(Array.from(codes));
});

export default router;
