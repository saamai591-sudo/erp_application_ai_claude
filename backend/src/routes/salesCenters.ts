import { Router } from "express";
import { prisma } from "../lib/prisma";
import { nextSerialNumber } from "../utils/coding";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

// «مرکز فروش» — موجودیت عملیاتی فروش، وابسته به یک واحد سازمانی (۱ واحد سازمانی → چند مرکز فروش)،
// برای شناسایی مرکز فروش مسئول یک سند فروش. دقیقاً هم‌الگوی warehouses.ts's «گروه انبار» (کد ساده‌ی
// سریالی، نه کد تفصیل).

const FORM = findFormPrefix("sales-centers");

const router = Router();

router.get("/sales-centers", async (_req, res) => {
  res.json(await prisma.salesCenter.findMany({ include: { organizationUnit: true }, orderBy: { code: "asc" } }));
});

router.post("/sales-centers", can(`${FORM}.create`), async (req, res) => {
  const body = req.body as { code?: number; title: string; description?: string | null; organizationUnitId: number; isActive?: boolean };
  if (!body.title || !body.organizationUnitId) return res.status(400).json({ error: "عنوان و واحد سازمانی الزامی است" });

  try {
    const orgUnit = await prisma.orgUnit.findUnique({ where: { id: body.organizationUnitId } });
    if (!orgUnit) return res.status(404).json({ error: "واحد سازمانی یافت نشد" });

    const dup = await prisma.salesCenter.findUnique({ where: { title: body.title } });
    if (dup) return res.status(400).json({ error: "عنوان تکراری است" });

    const finalCode = body.code ?? (await nextSerialNumber(prisma.salesCenter, "code"));
    const created = await prisma.salesCenter.create({
      data: {
        code: finalCode,
        title: body.title,
        description: body.description || null,
        organizationUnitId: body.organizationUnitId,
        isActive: body.isActive ?? true,
      },
      include: { organizationUnit: true },
    });
    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "کد یا عنوان تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ثبت مرکز فروش" });
  }
});

router.put("/sales-centers/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as { title?: string; description?: string | null; organizationUnitId?: number; isActive?: boolean };

  const existing = await prisma.salesCenter.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "مرکز فروش یافت نشد" });

  if (body.title) {
    const dup = await prisma.salesCenter.findFirst({ where: { title: body.title, NOT: { id } } });
    if (dup) return res.status(400).json({ error: "عنوان تکراری است" });
  }
  if (body.organizationUnitId) {
    const orgUnit = await prisma.orgUnit.findUnique({ where: { id: body.organizationUnitId } });
    if (!orgUnit) return res.status(404).json({ error: "واحد سازمانی یافت نشد" });
  }

  try {
    const updated = await prisma.salesCenter.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description === undefined ? undefined : body.description || null,
        organizationUnitId: body.organizationUnitId,
        isActive: body.isActive,
      },
      include: { organizationUnit: true },
    });
    res.json(updated);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "عنوان تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ویرایش مرکز فروش" });
  }
});

router.delete("/sales-centers/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.salesCenter.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "مرکز فروش یافت نشد" });
  if (existing.hasTransactions) return res.status(400).json({ error: "این مرکز فروش گردش دارد و قابل حذف نیست" });
  try {
    await prisma.salesCenter.delete({ where: { id } });
    res.status(204).send();
  } catch (e: any) {
    if (e.code === "P2003") return res.status(400).json({ error: "این مرکز فروش در جایی استفاده شده و قابل حذف نیست" });
    res.status(400).json({ error: e.message || "خطا در حذف مرکز فروش" });
  }
});

export default router;
