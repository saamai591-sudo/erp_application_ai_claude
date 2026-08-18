import { Router } from "express";
import { prisma } from "../lib/prisma";
import { generateDetailCode, registerDetailCode, resolveDetailCode } from "../utils/coding";

const DETAIL_TYPE_CASHBOX = 3;
const router = Router();

router.get("/", async (_req, res) => {
  res.json(await prisma.cashBox.findMany({ orderBy: { detailCode: "asc" } }));
});

router.post("/", async (req, res) => {
  const { title, detailCode } = req.body as { title: string; detailCode?: string };
  if (!title) return res.status(400).json({ error: "عنوان الزامی است" });

  const dup = await prisma.cashBox.findUnique({ where: { title } });
  if (dup) return res.status(400).json({ error: "عنوان تکراری است" });

  try {
    const { code, detailTypeId } = await resolveDetailCode(DETAIL_TYPE_CASHBOX, detailCode);
    const cashBox = await prisma.cashBox.create({ data: { detailCode: code, title } });
    await registerDetailCode(code, detailTypeId, "CashBox", cashBox.id);
    res.status(201).json(cashBox);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { title } = req.body as { title: string };
  if (!title) return res.status(400).json({ error: "عنوان الزامی است" });

  const dup = await prisma.cashBox.findFirst({ where: { title, NOT: { id } } });
  if (dup) return res.status(400).json({ error: "عنوان تکراری است" });

  const updated = await prisma.cashBox.update({ where: { id }, data: { title } });
  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const cashBox = await prisma.cashBox.findUnique({ where: { id } });
  if (!cashBox) return res.status(404).json({ error: "صندوق یافت نشد" });
  if (cashBox.hasTransactions) return res.status(400).json({ error: "این صندوق گردش دارد و قابل حذف نیست" });
  await prisma.$transaction([
    prisma.detailCodeUsage.deleteMany({ where: { entityTable: "CashBox", entityId: id } }),
    prisma.cashBox.delete({ where: { id } }),
  ]);
  res.status(204).send();
});

export default router;
