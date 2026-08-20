import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AuthedRequest } from "../middleware/auth";
import { closeInventory, rollbackClosing, getCurrentClosing } from "../services/inventoryClosingService";

// =========================================================================
// «بستن موجودی انبار» / «برگشت بستن موجودی» — طبق stockAnalysis.md بند ۴-۹ و ۴۸-۶۰. منطق واقعی
// (Snapshot، محدودیت‌های تاریخ، تاریخچه‌ی حفظ‌شده) در inventoryClosingService.ts پیاده شده — این فایل
// فقط لایه‌ی REST آن است. نگاه کنید به یادداشت بالای آن سرویس برای معنای دقیق «Closing جاری».
// =========================================================================

const router = Router();

router.get("/inventory-closings", async (req, res) => {
  const warehouseId = Number(req.query.warehouseId);
  if (!warehouseId) return res.status(400).json({ error: "انبار الزامی است" });

  const [current, history, audits] = await Promise.all([
    getCurrentClosing(warehouseId),
    prisma.inventoryClosing.findMany({
      where: { warehouseId },
      include: { createdBy: true, _count: { select: { lines: true } } },
      orderBy: { id: "desc" },
    }),
    prisma.inventoryClosingAudit.findMany({
      where: { warehouseId },
      include: { user: true },
      orderBy: { id: "desc" },
    }),
  ]);

  res.json({
    current: current ? { id: current.id, closingDate: current.closingDate, closedAt: current.closedAt } : null,
    history: history.map((h: any) => ({
      id: h.id,
      closingDate: h.closingDate,
      closedAt: h.closedAt,
      lineCount: h._count.lines,
      createdByName: h.createdBy ? `${h.createdBy.firstName} ${h.createdBy.lastName}` : null,
      isCurrent: current?.id === h.id,
    })),
    audits: audits.map((a: any) => ({
      id: a.id,
      action: a.action,
      oldClosingDate: a.oldClosingDate,
      newClosingDate: a.newClosingDate,
      reason: a.reason,
      actionAt: a.actionAt,
      userName: a.user ? `${a.user.firstName} ${a.user.lastName}` : null,
    })),
  });
});

router.get("/inventory-closings/:id/lines", async (req, res) => {
  const id = Number(req.params.id);
  const lines = await prisma.inventoryClosingLine.findMany({
    where: { closingId: id },
    include: { goodsItem: true, physicalLocation: true, batch: true, serial: true },
    orderBy: { id: "asc" },
  });
  res.json(
    lines.map((l: any) => ({
      id: l.id,
      goodsItemCode: l.goodsItem.fullCode,
      goodsItemTitle: l.goodsItem.title,
      physicalLocationTitle: l.physicalLocation?.title ?? null,
      batchNumber: l.batch?.batchNumber ?? null,
      serialNumber: l.serial?.serialNumber ?? null,
      quantity: Number(l.quantity),
    }))
  );
});

router.post("/inventory-closings/close", async (req: AuthedRequest, res) => {
  const { warehouseId, closingDate } = req.body as { warehouseId: number; closingDate: string };
  if (!warehouseId || !closingDate) return res.status(400).json({ error: "انبار و تاریخ بستن الزامی است" });

  try {
    const result = await closeInventory(warehouseId, new Date(closingDate), req.user?.id ?? null);
    res.status(201).json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در بستن موجودی" });
  }
});

router.post("/inventory-closings/rollback", async (req: AuthedRequest, res) => {
  const { warehouseId, newClosingDate, reason } = req.body as { warehouseId: number; newClosingDate: string; reason?: string };
  if (!warehouseId || !newClosingDate) return res.status(400).json({ error: "انبار و تاریخ جدید الزامی است" });
  if (!reason || !reason.trim()) return res.status(400).json({ error: "دلیل برگشت بستن موجودی الزامی است" });

  try {
    const result = await rollbackClosing(warehouseId, new Date(newClosingDate), reason.trim(), req.user?.id ?? null);
    res.status(201).json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message || "خطا در برگشت بستن موجودی" });
  }
});

export default router;
