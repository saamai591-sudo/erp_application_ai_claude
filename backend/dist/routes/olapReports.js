"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const concurrency_1 = require("../utils/concurrency");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
const FORM = (0, registry_1.findFormPrefix)("olap-reports");
const router = (0, express_1.Router)();
router.get("/", (0, guard_1.can)(`${FORM}.view`), async (_req, res) => {
    const rows = await prisma_1.prisma.olapReport.findMany({
        select: { id: true, title: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
    });
    res.json(rows);
});
router.get("/:id", (0, guard_1.can)(`${FORM}.view`), async (req, res) => {
    const id = Number(req.params.id);
    const row = await prisma_1.prisma.olapReport.findUnique({ where: { id } });
    if (!row)
        return res.status(404).json({ error: "گزارش یافت نشد" });
    res.json(row);
});
router.post("/", (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
    const { title, config } = req.body;
    if (!title)
        return res.status(400).json({ error: "عنوان الزامی است" });
    if (config === undefined)
        return res.status(400).json({ error: "تنظیمات گزارش الزامی است" });
    const dup = await prisma_1.prisma.olapReport.findUnique({ where: { title } });
    if (dup)
        return res.status(400).json({ error: "عنوان تکراری است" });
    const created = await prisma_1.prisma.olapReport.create({ data: { title, config } });
    res.status(201).json(created);
});
router.put("/:id", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const { title, config } = req.body;
    const row = await prisma_1.prisma.olapReport.findUnique({ where: { id } });
    if (!row)
        return res.status(404).json({ error: "گزارش یافت نشد" });
    try {
        (0, concurrency_1.assertRecordNotStale)(row.updatedAt, req.body.updatedAt, "این گزارش");
    }
    catch (e) {
        return res.status(400).json({ error: e.message });
    }
    const dup = await prisma_1.prisma.olapReport.findFirst({ where: { title, NOT: { id } } });
    if (dup)
        return res.status(400).json({ error: "عنوان تکراری است" });
    const updated = await prisma_1.prisma.olapReport.update({ where: { id }, data: { title, config } });
    res.json(updated);
});
router.delete("/:id", (0, guard_1.can)(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const row = await prisma_1.prisma.olapReport.findUnique({ where: { id } });
    if (!row)
        return res.status(404).json({ error: "گزارش یافت نشد" });
    await prisma_1.prisma.olapReport.delete({ where: { id } });
    res.status(204).send();
});
exports.default = router;
