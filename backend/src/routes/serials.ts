import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

router.get("/", async (req, res) => {
  const goodsItemId = req.query.goodsItemId ? Number(req.query.goodsItemId) : undefined;
  res.json(
    await prisma.serial.findMany({
      where: goodsItemId ? { goodsItemId } : undefined,
      include: { goodsItem: true },
      orderBy: { serialNumber: "asc" },
    })
  );
});

router.post("/", async (req, res) => {
  const body = req.body as { goodsItemId: number; serialNumber: string; description?: string | null };
  if (!body.goodsItemId) return res.status(400).json({ error: "کالا الزامی است" });
  if (!body.serialNumber || !body.serialNumber.trim()) return res.status(400).json({ error: "شماره سریال الزامی است" });

  try {
    const goodsItem = await prisma.goodsItem.findUnique({ where: { id: body.goodsItemId } });
    if (!goodsItem) return res.status(404).json({ error: "کالا یافت نشد" });

    const created = await prisma.serial.create({
      data: { goodsItemId: body.goodsItemId, serialNumber: body.serialNumber.trim(), description: body.description ?? null },
    });
    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "این شماره سریال قبلا برای همین کالا ثبت شده است" });
    res.status(400).json({ error: e.message || "خطا در ثبت سریال" });
  }
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as { serialNumber?: string; description?: string | null; isActive?: boolean };

  const serial = await prisma.serial.findUnique({ where: { id } });
  if (!serial) return res.status(404).json({ error: "سریال یافت نشد" });

  if (serial.hasTransactions && body.serialNumber && body.serialNumber !== serial.serialNumber) {
    return res.status(400).json({ error: "این سریال گردش دارد و شماره آن قابل تغییر نیست" });
  }

  if (body.serialNumber && body.serialNumber.trim() !== serial.serialNumber) {
    const dup = await prisma.serial.findUnique({
      where: { goodsItemId_serialNumber: { goodsItemId: serial.goodsItemId, serialNumber: body.serialNumber.trim() } },
    });
    if (dup) return res.status(400).json({ error: "این شماره سریال قبلا برای همین کالا ثبت شده است" });
  }

  try {
    const updated = await prisma.serial.update({
      where: { id },
      data: { serialNumber: body.serialNumber?.trim(), description: body.description, isActive: body.isActive },
    });
    res.json(updated);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "این شماره سریال قبلا برای همین کالا ثبت شده است" });
    res.status(400).json({ error: e.message || "خطا در ویرایش سریال" });
  }
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const serial = await prisma.serial.findUnique({ where: { id } });
  if (!serial) return res.status(404).json({ error: "سریال یافت نشد" });
  if (serial.hasTransactions) return res.status(400).json({ error: "این سریال گردش دارد و قابل حذف نیست" });
  await prisma.serial.delete({ where: { id } });
  res.status(204).send();
});

export default router;
