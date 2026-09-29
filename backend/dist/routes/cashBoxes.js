"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const coding_1 = require("../utils/coding");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
const DETAIL_TYPE_CASHBOX = 3;
const FORM = (0, registry_1.findFormPrefix)("cash-boxes");
const router = (0, express_1.Router)();
router.get("/", async (_req, res) => {
    res.json(await prisma_1.prisma.cashBox.findMany({ orderBy: { detailCode: "asc" } }));
});
router.post("/", (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
    const { title, detailCode } = req.body;
    if (!title)
        return res.status(400).json({ error: "عنوان الزامی است" });
    const dup = await prisma_1.prisma.cashBox.findUnique({ where: { title } });
    if (dup)
        return res.status(400).json({ error: "عنوان تکراری است" });
    try {
        const { code, detailTypeId } = await (0, coding_1.resolveDetailCode)(DETAIL_TYPE_CASHBOX, detailCode);
        const cashBox = await prisma_1.prisma.cashBox.create({ data: { detailCode: code, title } });
        await (0, coding_1.registerDetailCode)(code, detailTypeId, "CashBox", cashBox.id);
        res.status(201).json(cashBox);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
router.put("/:id", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const { title } = req.body;
    if (!title)
        return res.status(400).json({ error: "عنوان الزامی است" });
    const dup = await prisma_1.prisma.cashBox.findFirst({ where: { title, NOT: { id } } });
    if (dup)
        return res.status(400).json({ error: "عنوان تکراری است" });
    const updated = await prisma_1.prisma.cashBox.update({ where: { id }, data: { title } });
    res.json(updated);
});
router.delete("/:id", (0, guard_1.can)(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const cashBox = await prisma_1.prisma.cashBox.findUnique({ where: { id } });
    if (!cashBox)
        return res.status(404).json({ error: "صندوق یافت نشد" });
    if (cashBox.hasTransactions)
        return res.status(400).json({ error: "این صندوق گردش دارد و قابل حذف نیست" });
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.detailCodeUsage.deleteMany({ where: { entityTable: "CashBox", entityId: id } }),
        prisma_1.prisma.cashBox.delete({ where: { id } }),
    ]);
    res.status(204).send();
});
exports.default = router;
