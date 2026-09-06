import { Router } from "express";
import { prisma } from "../lib/prisma";
import { createBatch, generateBatchNumber, getBatches, computeBatchAvailableQuantity } from "../services/batchService";
import { can } from "../authz/guard";
import { findFormPrefix } from "../authz/registry";

const FORM = findFormPrefix("batches");

const router = Router();

router.get("/", async (req, res) => {
  const goodsItemId = req.query.goodsItemId ? Number(req.query.goodsItemId) : undefined;
  const batches = await getBatches({ goodsItemId });
  // موجودی فعلی فقط وقتی محاسبه می‌شود که goodsItemId داده شده باشد (یعنی پیکر بچ یک ردیف سند)، نه در
  // فهرست کامل و بدون فیلتر صفحه‌ی مدیریت بچ‌ها، تا از N+1 غیرضروری جلوگیری شود.
  if (!goodsItemId) return res.json(batches);
  const withQuantity = await Promise.all(
    batches.map(async (b: any) => ({ ...b, availableQuantity: await computeBatchAvailableQuantity(b.id) }))
  );
  res.json(withQuantity);
});

router.get("/suggest-number", can(`${FORM}.create`), async (req, res) => {
  const goodsItemId = Number(req.query.goodsItemId);
  if (!goodsItemId) return res.status(400).json({ error: "کالا الزامی است" });
  res.json({ batchNumber: await generateBatchNumber(goodsItemId) });
});

router.post("/", can(`${FORM}.create`), async (req, res) => {
  try {
    const created = await createBatch(req.body);
    res.status(201).json(created);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(400).json({ error: "این شماره بچ قبلا برای همین کالا ثبت شده است" });
    res.status(400).json({ error: e.message || "خطا در ثبت بچ" });
  }
});

router.put("/:id", can(`${FORM}.edit`), async (req, res) => {
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

router.delete("/:id", can(`${FORM}.delete`), async (req, res) => {
  const id = Number(req.params.id);
  const batch = await prisma.batch.findUnique({ where: { id }, include: { _count: { select: { serials: true } } } });
  if (!batch) return res.status(404).json({ error: "بچ یافت نشد" });
  if (batch.hasTransactions) return res.status(400).json({ error: "این بچ گردش دارد و قابل حذف نیست" });
  if (batch._count.serials > 0) return res.status(400).json({ error: "این بچ به یک یا چند سریال متصل است و قابل حذف نیست" });
  await prisma.batch.delete({ where: { id } });
  res.status(204).send();
});

export default router;
