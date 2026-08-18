import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

router.get("/", async (_req, res) => {
  const rows = await prisma.olapReport.findMany({
    select: { id: true, title: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
  res.json(rows);
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const row = await prisma.olapReport.findUnique({ where: { id } });
  if (!row) return res.status(404).json({ error: "گزارش یافت نشد" });
  res.json(row);
});

router.post("/", async (req, res) => {
  const { title, config } = req.body as { title: string; config: any };
  if (!title) return res.status(400).json({ error: "عنوان الزامی است" });
  if (config === undefined) return res.status(400).json({ error: "تنظیمات گزارش الزامی است" });

  const dup = await prisma.olapReport.findUnique({ where: { title } });
  if (dup) return res.status(400).json({ error: "عنوان تکراری است" });

  const created = await prisma.olapReport.create({ data: { title, config } });
  res.status(201).json(created);
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { title, config } = req.body as { title: string; config: any };

  const row = await prisma.olapReport.findUnique({ where: { id } });
  if (!row) return res.status(404).json({ error: "گزارش یافت نشد" });

  const dup = await prisma.olapReport.findFirst({ where: { title, NOT: { id } } });
  if (dup) return res.status(400).json({ error: "عنوان تکراری است" });

  const updated = await prisma.olapReport.update({ where: { id }, data: { title, config } });
  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const row = await prisma.olapReport.findUnique({ where: { id } });
  if (!row) return res.status(404).json({ error: "گزارش یافت نشد" });
  await prisma.olapReport.delete({ where: { id } });
  res.status(204).send();
});

export default router;
