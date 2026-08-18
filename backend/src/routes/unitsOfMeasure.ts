import { Router } from "express";
import { prisma } from "../lib/prisma";
import { nextSerialNumber } from "../utils/coding";

const router = Router();

router.get("/", async (_req, res) => {
  res.json(await prisma.unitOfMeasure.findMany({ orderBy: { code: "asc" } }));
});

router.post("/", async (req, res) => {
  const body = req.body as { code?: number; title: string; isWeight?: boolean; kgEquivalent?: number | string | null };
  if (!body.title) return res.status(400).json({ error: "عنوان الزامی است" });
  const isWeight = !!body.isWeight;
  if (isWeight && (body.kgEquivalent === undefined || body.kgEquivalent === null || body.kgEquivalent === "")) {
    return res.status(400).json({ error: "برای واحد وزنی، معادل به کیلوگرم الزامی است" });
  }

  try {
    const dup = await prisma.unitOfMeasure.findUnique({ where: { title: body.title } });
    if (dup) return res.status(400).json({ error: "عنوان تکراری است" });

    const finalCode = body.code ?? (await nextSerialNumber(prisma.unitOfMeasure, "code"));
    const created = await prisma.unitOfMeasure.create({
      data: {
        code: finalCode,
        title: body.title,
        isWeight,
        kgEquivalent: isWeight ? Number(body.kgEquivalent) : null,
      },
    });
    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "کد یا عنوان تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ثبت واحد سنجش" });
  }
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as { title?: string; isWeight?: boolean; kgEquivalent?: number | string | null };

  const unit = await prisma.unitOfMeasure.findUnique({ where: { id } });
  if (!unit) return res.status(404).json({ error: "واحد سنجش یافت نشد" });

  const isWeight = body.isWeight ?? unit.isWeight;
  if (isWeight && (body.kgEquivalent === undefined || body.kgEquivalent === null || body.kgEquivalent === "")) {
    return res.status(400).json({ error: "برای واحد وزنی، معادل به کیلوگرم الزامی است" });
  }

  if (body.title) {
    const dup = await prisma.unitOfMeasure.findFirst({ where: { title: body.title, NOT: { id } } });
    if (dup) return res.status(400).json({ error: "عنوان تکراری است" });
  }

  try {
    const updated = await prisma.unitOfMeasure.update({
      where: { id },
      data: {
        title: body.title,
        isWeight,
        kgEquivalent: isWeight ? Number(body.kgEquivalent) : null,
      },
    });
    res.json(updated);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "عنوان تکراری است" });
    res.status(400).json({ error: e.message || "خطا در ویرایش واحد سنجش" });
  }
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const unit = await prisma.unitOfMeasure.findUnique({ where: { id } });
  if (!unit) return res.status(404).json({ error: "واحد سنجش یافت نشد" });
  if (unit.hasTransactions) return res.status(400).json({ error: "این واحد سنجش گردش دارد و قابل حذف نیست" });
  await prisma.unitOfMeasure.delete({ where: { id } });
  res.status(204).send();
});

export default router;
