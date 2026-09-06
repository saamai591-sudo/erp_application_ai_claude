import { Router } from "express";
import { prisma } from "../lib/prisma";
import { nextSerialNumber } from "../utils/coding";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

const FORM = findFormPrefix("purchase-types");

const router = Router();

router.get("/purchase-types", async (_req, res) => {
  res.json(await prisma.purchaseType.findMany({ orderBy: { code: "asc" } }));
});

router.post("/purchase-types", can(`${FORM}.create`), async (req, res) => {
  const body = req.body as { code?: number; title: string; nature: string };
  if (!body.title) return res.status(400).json({ error: "عنوان الزامی است" });
  if (!body.nature) return res.status(400).json({ error: "نوع الزامی است" });

  try {
    const dup = await prisma.purchaseType.findUnique({ where: { title: body.title } });
    if (dup) return res.status(400).json({ error: "عنوان تکراری است" });

    const finalCode = body.code ?? (await nextSerialNumber(prisma.purchaseType, "code"));
    const created = await prisma.purchaseType.create({
      data: { code: finalCode, title: body.title, nature: body.nature as any },
    });
    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "کد یا عنوان تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ثبت نوع خرید" });
  }
});

router.put("/purchase-types/:id", can(`${FORM}.edit`), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as { title?: string; nature?: string };

  const existing = await prisma.purchaseType.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "نوع خرید یافت نشد" });

  if (body.title) {
    const dup = await prisma.purchaseType.findFirst({ where: { title: body.title, NOT: { id } } });
    if (dup) return res.status(400).json({ error: "عنوان تکراری است" });
  }

  try {
    const updated = await prisma.purchaseType.update({
      where: { id },
      data: { title: body.title, nature: body.nature as any },
    });
    res.json(updated);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "عنوان تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ویرایش نوع خرید" });
  }
});

router.delete("/purchase-types/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.purchaseType.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: "نوع خرید یافت نشد" });
  if (existing.hasTransactions) return res.status(400).json({ error: "این نوع خرید گردش دارد و قابل حذف نیست" });
  try {
    await prisma.purchaseType.delete({ where: { id } });
    res.status(204).send();
  } catch (e: any) {
    if (e.code === "P2003") return res.status(400).json({ error: "این نوع خرید در جایی استفاده شده و قابل حذف نیست" });
    res.status(400).json({ error: e.message || "خطا در حذف نوع خرید" });
  }
});

export default router;
