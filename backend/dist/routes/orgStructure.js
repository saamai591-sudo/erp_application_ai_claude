"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
const FORM = (0, registry_1.findFormPrefix)("org-structure");
const router = (0, express_1.Router)();
router.get("/", async (_req, res) => {
    const nodes = await prisma_1.prisma.orgStructure.findMany({ orderBy: { code: "asc" } });
    res.json(nodes);
});
router.post("/", (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
    const { parentId, code, title } = req.body;
    if (!title)
        return res.status(400).json({ error: "عنوان الزامی است" });
    let finalCode = code;
    if (!finalCode) {
        const siblings = await prisma_1.prisma.orgStructure.findMany({
            where: { parentId: parentId ?? null },
            orderBy: { code: "desc" },
            take: 1,
        });
        const lastNum = siblings.length ? parseInt(siblings[0].code, 10) || 0 : 0;
        finalCode = String(lastNum + 1);
    }
    const dup = await prisma_1.prisma.orgStructure.findFirst({ where: { parentId: parentId ?? null, code: finalCode } });
    if (dup)
        return res.status(400).json({ error: "کد در این سطح تکراری است" });
    const dupTitle = await prisma_1.prisma.orgStructure.findFirst({ where: { parentId: parentId ?? null, title } });
    if (dupTitle)
        return res.status(400).json({ error: "عنوان در این سطح تکراری است" });
    const node = await prisma_1.prisma.orgStructure.create({
        data: { parentId: parentId ?? null, code: finalCode, title },
    });
    res.status(201).json(node);
});
router.put("/:id", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const { title, code } = req.body;
    const node = await prisma_1.prisma.orgStructure.findUnique({ where: { id } });
    if (!node)
        return res.status(404).json({ error: "شاخه یافت نشد" });
    if (code && code !== node.code) {
        const dup = await prisma_1.prisma.orgStructure.findFirst({ where: { parentId: node.parentId, code, NOT: { id } } });
        if (dup)
            return res.status(400).json({ error: "کد در این سطح تکراری است" });
    }
    if (title && title !== node.title) {
        const dupTitle = await prisma_1.prisma.orgStructure.findFirst({ where: { parentId: node.parentId, title, NOT: { id } } });
        if (dupTitle)
            return res.status(400).json({ error: "عنوان در این سطح تکراری است" });
    }
    const updated = await prisma_1.prisma.orgStructure.update({ where: { id }, data: { title, code } });
    res.json(updated);
});
router.delete("/:id", (0, guard_1.can)(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const children = await prisma_1.prisma.orgStructure.findFirst({ where: { parentId: id } });
    const usedByOrgUnit = await prisma_1.prisma.orgUnit.findFirst({ where: { orgStructureId: id } });
    if (children || usedByOrgUnit) {
        return res.status(400).json({ error: "این شاخه دارای زیرشاخه یا گردش است و قابل حذف نیست" });
    }
    try {
        await prisma_1.prisma.orgStructure.delete({ where: { id } });
        res.status(204).send();
    }
    catch (e) {
        if (e?.code === "P2003") {
            return res.status(400).json({ error: "این شاخه دارای زیرشاخه یا گردش است و قابل حذف نیست" });
        }
        res.status(400).json({ error: e?.message || "خطا در حذف شاخه سازمانی" });
    }
});
exports.default = router;
