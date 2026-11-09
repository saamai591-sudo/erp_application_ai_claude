import { Router } from "express";
import { prisma } from "../lib/prisma";
import { nextSerialNumber } from "../utils/coding";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

// «گروه مشتری» (فروش › تنظیمات) و «گروه تامین‌کننده» (زنجیره تامین › تنظیمات): فهرست‌های تخت برای طبقه‌بندی طرف‌حساب‌ها و گزارش «مانده به تفکیک گروه».
// هر مشتری/تامین‌کننده حداکثر یک گروه دارد (Customer.groupId / Supplier.classGroupId، خالی = «بدون گروه»). دو فهرست مستقل با مجوز خودشان؛
// «گروه تامین‌کننده» با «گروه خرید» (PurchaseGroup: ساختار خرید با کارشناس/کالا) یکی نیست. کد خودکار، عنوان یکتا؛ گروهِ دارای عضو حذف نمی‌شود (پیام «موارد استفاده»)، فقط غیرفعال می‌شود.

const router = Router();

interface Def {
  path: string;
  form: string;
  label: string;
  model: "customerGroup" | "supplierGroup";
  membersKey: "customers" | "suppliers";
}

const DEFS: Def[] = [
  { path: "customer-groups", form: "customer-groups", label: "گروه مشتری", model: "customerGroup", membersKey: "customers" },
  { path: "supplier-groups", form: "supplier-groups", label: "گروه تامین‌کننده", model: "supplierGroup", membersKey: "suppliers" },
];

for (const d of DEFS) {
  const F = findFormPrefix(d.form);
  const m = (prisma as any)[d.model];
  const shape = (g: any) => ({ id: g.id, code: g.code, title: g.title, isActive: g.isActive, usageCount: g._count?.[d.membersKey] ?? 0 });

  // فهرست باز برای کاربر واردشده (انتخابگر گروه در فرم مشتری/تامین‌کننده)؛ مثل سایر فهرست‌های پایه
  router.get(`/${d.path}`, async (_req, res) => {
    const rows = await m.findMany({ orderBy: { code: "asc" }, include: { _count: { select: { [d.membersKey]: true } } } });
    res.json(rows.map(shape));
  });

  router.post(`/${d.path}`, can(`${F}.create`), async (req, res) => {
    const title = typeof req.body?.title === "string" ? req.body.title.trim().replace(/\s+/g, " ") : "";
    if (!title) return res.status(400).json({ error: "عنوان الزامی است" });
    try {
      if (await m.findUnique({ where: { title } })) return res.status(400).json({ error: "عنوان تکراری است" });
      const created = await m.create({ data: { code: await nextSerialNumber(m, "code"), title, isActive: req.body?.isActive !== false } });
      res.status(201).json(shape(created));
    } catch (e: any) {
      if (e.code === "P2002") return res.status(400).json({ error: "عنوان تکراری است" });
      res.status(400).json({ error: e.message || `خطا در ثبت ${d.label}` });
    }
  });

  router.put(`/${d.path}/:id`, can(`${F}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const existing = await m.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: `${d.label} یافت نشد` });
    const title = typeof req.body?.title === "string" ? req.body.title.trim().replace(/\s+/g, " ") : existing.title;
    if (!title) return res.status(400).json({ error: "عنوان الزامی است" });
    try {
      if (await m.findFirst({ where: { title, NOT: { id } } })) return res.status(400).json({ error: "عنوان تکراری است" });
      const updated = await m.update({ where: { id }, data: { title, isActive: typeof req.body?.isActive === "boolean" ? req.body.isActive : existing.isActive } });
      res.json(shape(updated));
    } catch (e: any) {
      if (e.code === "P2002") return res.status(400).json({ error: "عنوان تکراری است" });
      res.status(400).json({ error: e.message || `خطا در ویرایش ${d.label}` });
    }
  });

  // حذف: اگر عضو دارد، خطای کلید خارجی توسط کلاینت مشترک به پیام «موارد استفاده» تبدیل می‌شود (lib/deleteUsage.ts)
  router.delete(`/${d.path}/:id`, can(`${F}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    if (!(await m.findUnique({ where: { id } }))) return res.status(404).json({ error: `${d.label} یافت نشد` });
    try {
      await m.delete({ where: { id } });
      res.status(204).send();
    } catch (e: any) {
      res.status(400).json({ error: e.message || `خطا در حذف ${d.label}` });
    }
  });
}

/** گروه انتخاب‌شده برای مشتری/تامین‌کننده: باید وجود داشته باشد؛ گروه غیرفعال فقط اگر همان گروه فعلیِ رکورد باشد قابل انتخاب است */
export async function assertPartyGroup(model: "customerGroup" | "supplierGroup", groupId: unknown, currentGroupId: number | null = null): Promise<number | null> {
  if (groupId === undefined || groupId === null || groupId === "") return null;
  const id = Number(groupId);
  const g = await (prisma as any)[model].findUnique({ where: { id } });
  if (!g) throw new Error(model === "customerGroup" ? "گروه مشتری انتخاب‌شده یافت نشد" : "گروه تامین‌کننده انتخاب‌شده یافت نشد");
  if (!g.isActive && id !== currentGroupId) throw new Error(`گروه «${g.title}» غیرفعال است`);
  return id;
}

export default router;
