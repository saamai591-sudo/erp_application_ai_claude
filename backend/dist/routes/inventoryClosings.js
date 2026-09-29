"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const inventoryClosingService_1 = require("../services/inventoryClosingService");
// =========================================================================
// «بستن موجودی انبار» / «برگشت بستن موجودی» — طبق stockAnalysis.md بند ۴-۹ و ۴۸-۶۰. منطق واقعی
// (Snapshot، محدودیت‌های تاریخ، تاریخچه‌ی حفظ‌شده) در inventoryClosingService.ts پیاده شده — این فایل
// فقط لایه‌ی REST آن است. نگاه کنید به یادداشت بالای آن سرویس برای معنای دقیق «Closing جاری».
// =========================================================================
const router = (0, express_1.Router)();
router.get("/inventory-closings", async (req, res) => {
    const warehouseId = Number(req.query.warehouseId);
    if (!warehouseId)
        return res.status(400).json({ error: "انبار الزامی است" });
    const [current, history, audits] = await Promise.all([
        (0, inventoryClosingService_1.getCurrentClosing)(warehouseId),
        prisma_1.prisma.inventoryClosing.findMany({
            where: { warehouseId },
            include: { createdBy: true, _count: { select: { lines: true } } },
            orderBy: { id: "desc" },
        }),
        prisma_1.prisma.inventoryClosingAudit.findMany({
            where: { warehouseId },
            include: { user: true },
            orderBy: { id: "desc" },
        }),
    ]);
    res.json({
        current: current ? { id: current.id, closingDate: current.closingDate, closedAt: current.closedAt } : null,
        history: history.map((h) => ({
            id: h.id,
            closingDate: h.closingDate,
            closedAt: h.closedAt,
            lineCount: h._count.lines,
            createdByName: h.createdBy ? `${h.createdBy.firstName} ${h.createdBy.lastName}` : null,
            isCurrent: current?.id === h.id,
        })),
        audits: audits.map((a) => ({
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
    const lines = await prisma_1.prisma.inventoryClosingLine.findMany({
        where: { closingId: id },
        include: { goodsItem: true, physicalLocation: true, batch: true, serial: true },
        orderBy: { id: "asc" },
    });
    res.json(lines.map((l) => ({
        id: l.id,
        goodsItemCode: l.goodsItem.fullCode,
        goodsItemTitle: l.goodsItem.title,
        physicalLocationTitle: l.physicalLocation?.title ?? null,
        batchNumber: l.batch?.batchNumber ?? null,
        serialNumber: l.serial?.serialNumber ?? null,
        quantity: Number(l.quantity),
    })));
});
router.post("/inventory-closings/close", async (req, res) => {
    const { warehouseId, closingDate } = req.body;
    if (!warehouseId || !closingDate)
        return res.status(400).json({ error: "انبار و تاریخ بستن الزامی است" });
    try {
        const result = await (0, inventoryClosingService_1.closeInventory)(warehouseId, new Date(closingDate), req.user?.id ?? null);
        res.status(201).json(result);
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در بستن موجودی" });
    }
});
router.post("/inventory-closings/rollback", async (req, res) => {
    const { warehouseId, newClosingDate, reason } = req.body;
    if (!warehouseId || !newClosingDate)
        return res.status(400).json({ error: "انبار و تاریخ جدید الزامی است" });
    if (!reason || !reason.trim())
        return res.status(400).json({ error: "دلیل برگشت بستن موجودی الزامی است" });
    try {
        const result = await (0, inventoryClosingService_1.rollbackClosing)(warehouseId, new Date(newClosingDate), reason.trim(), req.user?.id ?? null);
        res.status(201).json(result);
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در برگشت بستن موجودی" });
    }
});
exports.default = router;
