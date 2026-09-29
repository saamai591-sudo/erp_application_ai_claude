"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
const FORM = (0, registry_1.findFormPrefix)("physical-locations");
const router = (0, express_1.Router)();
// درخت محل فیزیکی هر انبار مستقل از بقیه انبارهاست (stockAnalysis.md بند ۲۱) — بدون محدودیت عمق،
// بر خلاف مناطق جغرافیایی (کشور/استان/شهر) که سطح‌بندی ثابت دارد
router.get("/", async (req, res) => {
    const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
    if (!warehouseId)
        return res.status(400).json({ error: "انبار الزامی است" });
    res.json(await prisma_1.prisma.physicalLocation.findMany({ where: { warehouseId }, orderBy: { code: "asc" } }));
});
router.post("/", (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
    const { warehouseId, parentId, code, title } = req.body;
    if (!warehouseId)
        return res.status(400).json({ error: "انبار الزامی است" });
    if (!title)
        return res.status(400).json({ error: "عنوان الزامی است" });
    const warehouse = await prisma_1.prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse)
        return res.status(404).json({ error: "انبار یافت نشد" });
    if (parentId) {
        const parent = await prisma_1.prisma.physicalLocation.findUnique({ where: { id: parentId } });
        if (!parent || parent.warehouseId !== warehouseId)
            return res.status(404).json({ error: "محل مرجع یافت نشد" });
    }
    let finalCode = code;
    if (!finalCode) {
        const siblings = await prisma_1.prisma.physicalLocation.findMany({
            where: { warehouseId, parentId: parentId ?? null },
            orderBy: { code: "desc" },
            take: 1,
        });
        const lastNum = siblings.length ? parseInt(siblings[0].code, 10) || 0 : 0;
        finalCode = String(lastNum + 1);
    }
    const dup = await prisma_1.prisma.physicalLocation.findFirst({ where: { warehouseId, parentId: parentId ?? null, code: finalCode } });
    if (dup)
        return res.status(400).json({ error: "کد در این سطح تکراری است" });
    const dupTitle = await prisma_1.prisma.physicalLocation.findFirst({ where: { warehouseId, parentId: parentId ?? null, title } });
    if (dupTitle)
        return res.status(400).json({ error: "عنوان در این سطح تکراری است" });
    const node = await prisma_1.prisma.physicalLocation.create({
        data: { warehouseId, parentId: parentId ?? null, code: finalCode, title },
    });
    res.status(201).json(node);
});
router.put("/:id", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const { title, code } = req.body;
    const node = await prisma_1.prisma.physicalLocation.findUnique({ where: { id } });
    if (!node)
        return res.status(404).json({ error: "محل فیزیکی یافت نشد" });
    if (node.hasTransactions && code && code !== node.code) {
        return res.status(400).json({ error: "این محل گردش دارد و کد آن قابل تغییر نیست" });
    }
    if (code && code !== node.code) {
        const dup = await prisma_1.prisma.physicalLocation.findFirst({
            where: { warehouseId: node.warehouseId, parentId: node.parentId, code, NOT: { id } },
        });
        if (dup)
            return res.status(400).json({ error: "کد در این سطح تکراری است" });
    }
    if (title && title !== node.title) {
        const dupTitle = await prisma_1.prisma.physicalLocation.findFirst({
            where: { warehouseId: node.warehouseId, parentId: node.parentId, title, NOT: { id } },
        });
        if (dupTitle)
            return res.status(400).json({ error: "عنوان در این سطح تکراری است" });
    }
    const updated = await prisma_1.prisma.physicalLocation.update({ where: { id }, data: { title, code } });
    res.json(updated);
});
router.delete("/:id", (0, guard_1.can)(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const node = await prisma_1.prisma.physicalLocation.findUnique({ where: { id } });
    if (!node)
        return res.status(404).json({ error: "محل فیزیکی یافت نشد" });
    if (node.hasTransactions)
        return res.status(400).json({ error: "این محل گردش دارد و قابل حذف نیست" });
    const children = await prisma_1.prisma.physicalLocation.findFirst({ where: { parentId: id } });
    if (children)
        return res.status(400).json({ error: "این محل دارای زیرشاخه است و قابل حذف نیست" });
    await prisma_1.prisma.physicalLocation.delete({ where: { id } });
    res.status(204).send();
});
exports.default = router;
