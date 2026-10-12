import { Router } from "express";
import { prisma } from "../lib/prisma";
import { nextSerialNumber } from "../utils/coding";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

// منابع انسانی › پرسنلی: سه فهرست پایه‌ی ساده (نوع همکاری، مدرک تحصیلی، دلایل خاتمه همکاری) با یک پیاده‌سازی مشترک.
// هر فهرست: کد (عددی، خودکار)، عنوان یکتا، فعال، hasTransactions (ردیف دارای گردش قابل حذف نیست).

interface MasterDef {
  path: string;
  formKey: string;
  label: string;
  model: "employmentType" | "educationLevel" | "terminationReason";
}

const DEFS: MasterDef[] = [
  { path: "employment-types", formKey: "employment-types", label: "نوع همکاری", model: "employmentType" },
  { path: "education-levels", formKey: "education-levels", label: "مدرک تحصیلی", model: "educationLevel" },
  { path: "termination-reasons", formKey: "termination-reasons", label: "دلیل خاتمه همکاری", model: "terminationReason" },
];

const router = Router();

for (const def of DEFS) {
  const FORM = findFormPrefix(def.formKey);
  const m = (): any => (prisma as any)[def.model];
  const base = `/${def.path}`;

  router.get(base, async (req, res) => {
    const activeOnly = req.query.activeOnly === "true";
    res.json(await m().findMany({ where: activeOnly ? { isActive: true } : {}, orderBy: { code: "asc" } }));
  });

  router.post(base, can(`${FORM}.create`), async (req, res) => {
    const body = req.body as { code?: number; title?: string; isActive?: boolean };
    const title = (body.title ?? "").trim();
    if (!title) return res.status(400).json({ error: "عنوان الزامی است" });
    try {
      if (await m().findUnique({ where: { title } })) return res.status(400).json({ error: "عنوان تکراری است" });
      const code = body.code ?? (await nextSerialNumber(m(), "code"));
      res.status(201).json(await m().create({ data: { code, title, isActive: body.isActive ?? true } }));
    } catch (e: any) {
      if (e.code === "P2002") return res.status(400).json({ error: "کد یا عنوان تکراری است" });
      res.status(400).json({ error: e.message || `خطا در ثبت ${def.label}` });
    }
  });

  router.put(`${base}/:id`, can(`${FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body as { title?: string; isActive?: boolean };
    const existing = await m().findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: `${def.label} یافت نشد` });
    const title = body.title === undefined ? undefined : body.title.trim();
    if (title !== undefined) {
      if (!title) return res.status(400).json({ error: "عنوان الزامی است" });
      if (await m().findFirst({ where: { title, NOT: { id } } })) return res.status(400).json({ error: "عنوان تکراری است" });
    }
    try {
      res.json(await m().update({ where: { id }, data: { title, isActive: body.isActive } }));
    } catch (e: any) {
      res.status(400).json({ error: e.message || `خطا در ویرایش ${def.label}` });
    }
  });

  router.delete(`${base}/:id`, can(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const existing = await m().findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: `${def.label} یافت نشد` });
    if (existing.hasTransactions) return res.status(400).json({ error: `این ${def.label} گردش دارد و قابل حذف نیست` });
    try {
      await m().delete({ where: { id } });
      res.status(204).send();
    } catch (e: any) {
      if (e.code === "P2003") return res.status(400).json({ error: `این ${def.label} در جایی استفاده شده و قابل حذف نیست` });
      res.status(400).json({ error: e.message || `خطا در حذف ${def.label}` });
    }
  });
}

export default router;
