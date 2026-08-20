import { Router } from "express";
import { prisma } from "../lib/prisma";
import { createBatch, generateBatchNumber, getBatches } from "../services/batchService";

const router = Router();

router.get("/", async (req, res) => {
  const goodsItemId = req.query.goodsItemId ? Number(req.query.goodsItemId) : undefined;
  res.json(await getBatches({ goodsItemId }));
});

router.get("/suggest-number", async (req, res) => {
  const goodsItemId = Number(req.query.goodsItemId);
  if (!goodsItemId) return res.status(400).json({ error: "کالا الزامی است" });
  res.json({ batchNumber: await generateBatchNumber(goodsItemId) });
});

router.post("/", async (req, res) => {
  try {
    const created = await createBatch(req.body);
    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "این شماره بچ قبلا برای همین کالا ثبت شده است" });
    res.status(400).json({ error: e.message || "خطا در ثبت بچ" });
  }
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as {
    batchNumber?: string;
    productionDate?: string | null;
    expiryDate?: string | null;
    sourceType?: "MANUAL" | "PURCHASE" | "PRODUCTION";
    supplierId?: number | null;
    productionReferenceId?: number | null;
    description?: string | null;
    isActive?: boolean;
  };

  const batch = await prisma.batch.findUnique({ where: { id } });
  if (!batch) return res.status(404).json({ error: "بچ یافت نشد" });

  if (batch.hasTransactions && body.batchNumber && body.batchNumber !== batch.batchNumber) {
    return res.status(400).json({ error: "این بچ گردش دارد و شماره آن قابل تغییر نیست" });
  }

  if (body.batchNumber && body.batchNumber.trim() !== batch.batchNumber) {
    const dup = await prisma.batch.findUnique({
      where: { goodsItemId_batchNumber: { goodsItemId: batch.goodsItemId, batchNumber: body.batchNumber.trim() } },
    });
    if (dup) return res.status(400).json({ error: "این شماره بچ قبلا برای همین کالا ثبت شده است" });
  }

  try {
    const updated = await prisma.batch.update({
      where: { id },
      data: {
        batchNumber: body.batchNumber?.trim(),
        productionDate: body.productionDate !== undefined ? (body.productionDate ? new Date(body.productionDate) : null) : undefined,
        expiryDate: body.expiryDate !== undefined ? (body.expiryDate ? new Date(body.expiryDate) : null) : undefined,
        sourceType: body.sourceType,
        supplierId: body.supplierId,
        productionReferenceId: body.productionReferenceId,
        description: body.description,
        isActive: body.isActive,
      },
    });
    res.json(updated);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "این شماره بچ قبلا برای همین کالا ثبت شده است" });
    res.status(400).json({ error: e.message || "خطا در ویرایش بچ" });
  }
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const batch = await prisma.batch.findUnique({ where: { id } });
  if (!batch) return res.status(404).json({ error: "بچ یافت نشد" });
  if (batch.hasTransactions) return res.status(400).json({ error: "این بچ گردش دارد و قابل حذف نیست" });
  await prisma.batch.delete({ where: { id } });
  res.status(204).send();
});

export default router;
