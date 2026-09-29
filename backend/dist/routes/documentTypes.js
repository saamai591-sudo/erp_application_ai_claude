"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const coding_1 = require("../utils/coding");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
const FORM = (0, registry_1.findFormPrefix)("document-types");
const router = (0, express_1.Router)();
router.get("/", async (_req, res) => {
    res.json(await prisma_1.prisma.documentType.findMany({ orderBy: { code: "asc" } }));
});
router.post("/", (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
    const { title } = req.body;
    if (!title)
        return res.status(400).json({ error: "عنوان الزامی است" });
    const dup = await prisma_1.prisma.documentType.findUnique({ where: { title } });
    if (dup)
        return res.status(400).json({ error: "عنوان تکراری است" });
    const code = await (0, coding_1.nextSerialNumber)(prisma_1.prisma.documentType, "code");
    const created = await prisma_1.prisma.documentType.create({ data: { code, title, isSystem: false } });
    res.status(201).json(created);
});
router.put("/:id", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const { title } = req.body;
    const type = await prisma_1.prisma.documentType.findUnique({ where: { id } });
    if (!type)
        return res.status(404).json({ error: "نوع سند یافت نشد" });
    const dup = await prisma_1.prisma.documentType.findFirst({ where: { title, NOT: { id } } });
    if (dup)
        return res.status(400).json({ error: "عنوان تکراری است" });
    const updated = await prisma_1.prisma.documentType.update({ where: { id }, data: { title } });
    res.json(updated);
});
router.delete("/:id", (0, guard_1.can)(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const type = await prisma_1.prisma.documentType.findUnique({ where: { id } });
    if (!type)
        return res.status(404).json({ error: "نوع سند یافت نشد" });
    if (type.isSystem)
        return res.status(400).json({ error: "انواع سند سیستمی قابل حذف نیستند" });
    const inUse = await prisma_1.prisma.journalEntry.findFirst({ where: { documentTypeId: id } });
    if (inUse)
        return res.status(400).json({ error: "این نوع سند در اسناد حسابداری استفاده شده و قابل حذف نیست" });
    try {
        await prisma_1.prisma.documentType.delete({ where: { id } });
        res.status(204).send();
    }
    catch (e) {
        if (e?.code === "P2003") {
            return res.status(400).json({ error: "این نوع سند در جایی استفاده شده و قابل حذف نیست" });
        }
        res.status(400).json({ error: e?.message || "خطا در حذف نوع سند" });
    }
});
exports.default = router;
