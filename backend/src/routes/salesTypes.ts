import { Router } from "express";
import { prisma } from "../lib/prisma";
import { nextSerialNumber } from "../utils/coding";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

// دقیقاً هم‌الگوی purchaseTypes.ts — طبق تصمیم صریح کاربر (۱۴۰۵/۰۶/۱۷).
const FORM = findFormPrefix("sales-types");

const router = Router();

router.get("/sales-types", async (_req, res) => {
  res.json(await prisma.salesType.findMany({ orderBy: { code: "asc" } }));
});

router.post("/sales-types", can(`${FORM}.create`), async (req, res) => {
  const body = req.body as { code?: number; title: string; nature: string };
  if (!body.title) return res.status(400).json({ error: "عنوان الزامی است" });
  if (!body.nature) return res.status(400).json({ error: "نوع الزامی است" });

  try {
    const dup = await prisma.salesType.findUnique({ where: { title: body.title } });
    if (dup) return res.status(400).json({ error: "عنوان تکراری است" });

    const finalCode = body.code ?? (await nextSerialNumber(prisma.salesType, "code"));
    const created = await prisma.salesType.create({
      data: { code: finalCode, title: body.title, nature: body.nature as any },
    });
    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "کد یا عنوان تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ثبت نوع فروش" });
  }
});

router.put("/sales-types/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as { title?: string; nature?: string };

  const existing = await prisma.salesType.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "نوع فروش یافت نشد" });

  if (body.title) {
    const dup = await prisma.salesType.findFirst({ where: { title: body.title, NOT: { id } } });
    if (dup) return res.status(400).json({ error: "عنوان تکراری است" });
  }

  try {
    const updated = await prisma.salesType.update({
      where: { id },
      data: { title: body.title, nature: body.nature as any },
    });
    res.json(updated);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "عنوان تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ویرایش نوع فروش" });
  }
});

router.delete("/sales-types/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.salesType.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "نوع فروش یافت نشد" });
  if (existing.hasTransactions) return res.status(400).json({ error: "این نوع فروش گردش دارد و قابل حذف نیست" });
  try {
    await prisma.salesType.delete({ where: { id } });
    res.status(204).send();
  } catch (e: any) {
    if (e.code === "P2003") return res.status(400).json({ error: "این نوع فروش در جایی استفاده شده و قابل حذف نیست" });
    res.status(400).json({ error: e.message || "خطا در حذف نوع فروش" });
  }
});

export default router;
