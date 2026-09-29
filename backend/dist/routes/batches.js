"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const batchService_1 = require("../services/batchService");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
const FORM = (0, registry_1.findFormPrefix)("batches");
const router = (0, express_1.Router)();
router.get("/", async (req, res) => {
    const goodsItemId = req.query.goodsItemId ? Number(req.query.goodsItemId) : undefined;
    const batches = await (0, batchService_1.getBatches)({ goodsItemId });
    // موجودی فعلی فقط وقتی محاسبه می‌شود که goodsItemId داده شده باشد (یعنی پیکر بچ یک ردیف سند)، نه در
    // فهرست کامل و بدون فیلتر صفحه‌ی مدیریت بچ‌ها، تا از N+1 غیرضروری جلوگیری شود.
    if (!goodsItemId)
        return res.json(batches);
    const withQuantity = await Promise.all(batches.map(async (b) => ({ ...b, availableQuantity: await (0, batchService_1.computeBatchAvailableQuantity)(b.id) })));
    res.json(withQuantity);
});
router.get("/suggest-number", (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
    const goodsItemId = Number(req.query.goodsItemId);
    if (!goodsItemId)
        return res.status(400).json({ error: "کالا الزامی است" });
    res.json({ batchNumber: await (0, batchService_1.generateBatchNumber)(goodsItemId) });
});
router.post("/", (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
    try {
        const created = await (0, batchService_1.createBatch)(req.body);
        res.status(201).json(created);
    }
    catch (e) {
        if (e.code === "P2002")
            return res.status(400).json({ error: "این شماره بچ قبلا برای همین کالا ثبت شده است" });
        res.status(400).json({ error: e.message || "خطا در ثبت بچ" });
    }
});
router.put("/:id", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body;
    const batch = await prisma_1.prisma.batch.findUnique({ where: { id } });
    if (!batch)
        return res.status(404).json({ error: "بچ یافت نشد" });
    if (batch.hasTransactions && body.batchNumber && body.batchNumber !== batch.batchNumber) {
        return res.status(400).json({ error: "این بچ گردش دارد و شماره آن قابل تغییر نیست" });
    }
    if (body.batchNumber && body.batchNumber.trim() !== batch.batchNumber) {
        const dup = await prisma_1.prisma.batch.findUnique({
            where: { goodsItemId_batchNumber: { goodsItemId: batch.goodsItemId, batchNumber: body.batchNumber.trim() } },
        });
        if (dup)
            return res.status(400).json({ error: "این شماره بچ قبلا برای همین کالا ثبت شده است" });
    }
    try {
        const updated = await prisma_1.prisma.batch.update({
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
    }
    catch (e) {
        if (e.code === "P2002")
            return res.status(400).json({ error: "این شماره بچ قبلا برای همین کالا ثبت شده است" });
        res.status(400).json({ error: e.message || "خطا در ویرایش بچ" });
    }
});
router.delete("/:id", (0, guard_1.can)(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const batch = await prisma_1.prisma.batch.findUnique({ where: { id } });
    if (!batch)
        return res.status(404).json({ error: "بچ یافت نشد" });
    if (batch.hasTransactions)
        return res.status(400).json({ error: "این بچ گردش دارد و قابل حذف نیست" });
    await prisma_1.prisma.batch.delete({ where: { id } });
    res.status(204).send();
});
exports.default = router;
