"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const coding_1 = require("../utils/coding");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
const DETAIL_TYPE_COST_CENTER = 2;
const ORG_UNITS = (0, registry_1.findFormPrefix)("org-units");
const COST_CENTERS = (0, registry_1.findFormPrefix)("cost-centers");
const router = (0, express_1.Router)();
// ---------- واحد سازمانی ----------
router.get("/org-units", async (_req, res) => {
    res.json(await prisma_1.prisma.orgUnit.findMany({ include: { orgStructure: true }, orderBy: { code: "asc" } }));
});
router.post("/org-units", (0, guard_1.can)(`${ORG_UNITS}.create`), async (req, res) => {
    const { code, title, orgStructureId } = req.body;
    if (!title || !orgStructureId)
        return res.status(400).json({ error: "عنوان و ساختار سازمانی الزامی است" });
    try {
        const node = await prisma_1.prisma.orgStructure.findUnique({ where: { id: orgStructureId } });
        if (!node)
            return res.status(404).json({ error: "شاخه ساختار سازمانی یافت نشد" });
        const hasChildren = await prisma_1.prisma.orgStructure.findFirst({ where: { parentId: orgStructureId } });
        if (hasChildren) {
            return res.status(400).json({ error: "صرفا آخرین شاخه (برگ) ساختار سازمانی قابل انتخاب است" });
        }
        const dupTitle = await prisma_1.prisma.orgUnit.findUnique({ where: { title } });
        if (dupTitle)
            return res.status(400).json({ error: "عنوان تکراری است" });
        const finalCode = code ?? (await (0, coding_1.nextSerialNumber)(prisma_1.prisma.orgUnit, "code"));
        const created = await prisma_1.prisma.orgUnit.create({ data: { code: finalCode, title, orgStructureId } });
        res.status(201).json(created);
    }
    catch (e) {
        if (e.code === "P2002")
            return res.status(400).json({ error: "کد یا عنوان تکراری است" });
        res.status(400).json({ error: e.message || "خطا در ثبت واحد سازمانی" });
    }
});
router.put("/org-units/:id", (0, guard_1.can)(`${ORG_UNITS}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const { title, orgStructureId } = req.body;
    if (title) {
        const dup = await prisma_1.prisma.orgUnit.findFirst({ where: { title, NOT: { id } } });
        if (dup)
            return res.status(400).json({ error: "عنوان تکراری است" });
    }
    const updated = await prisma_1.prisma.orgUnit.update({ where: { id }, data: { title, orgStructureId } });
    res.json(updated);
});
router.delete("/org-units/:id", (0, guard_1.can)(`${ORG_UNITS}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const unit = await prisma_1.prisma.orgUnit.findUnique({ where: { id } });
    if (!unit)
        return res.status(404).json({ error: "واحد سازمانی یافت نشد" });
    if (unit.hasTransactions)
        return res.status(400).json({ error: "این واحد سازمانی گردش دارد و قابل حذف نیست" });
    const inUse = await prisma_1.prisma.costCenter.findFirst({ where: { orgUnitId: id } });
    if (inUse)
        return res.status(400).json({ error: "این واحد سازمانی دارای مرکز هزینه ثبت‌شده است و قابل حذف نیست" });
    await prisma_1.prisma.orgUnit.delete({ where: { id } });
    res.status(204).send();
});
// ---------- مرکز هزینه ----------
router.get("/cost-centers", async (_req, res) => {
    res.json(await prisma_1.prisma.costCenter.findMany({ include: { orgUnit: true }, orderBy: { detailCode: "asc" } }));
});
router.post("/cost-centers", (0, guard_1.can)(`${COST_CENTERS}.create`), async (req, res) => {
    const { title, type, orgUnitId, detailCode } = req.body;
    if (!title || !orgUnitId)
        return res.status(400).json({ error: "عنوان و واحد سازمانی الزامی است" });
    const dupTitle = await prisma_1.prisma.costCenter.findUnique({ where: { title } });
    if (dupTitle)
        return res.status(400).json({ error: "عنوان تکراری است" });
    try {
        const { code, detailTypeId } = await (0, coding_1.resolveDetailCode)(DETAIL_TYPE_COST_CENTER, detailCode);
        const created = await prisma_1.prisma.costCenter.create({
            data: { detailCode: code, title, type: type ?? "ADMIN", orgUnitId },
        });
        await (0, coding_1.registerDetailCode)(code, detailTypeId, "CostCenter", created.id);
        res.status(201).json(created);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
router.put("/cost-centers/:id", (0, guard_1.can)(`${COST_CENTERS}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const { title, type, orgUnitId } = req.body;
    if (title) {
        const dup = await prisma_1.prisma.costCenter.findFirst({ where: { title, NOT: { id } } });
        if (dup)
            return res.status(400).json({ error: "عنوان تکراری است" });
    }
    const updated = await prisma_1.prisma.costCenter.update({
        where: { id },
        data: { title, type: type, orgUnitId },
    });
    res.json(updated);
});
router.delete("/cost-centers/:id", (0, guard_1.can)(`${COST_CENTERS}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const cc = await prisma_1.prisma.costCenter.findUnique({ where: { id } });
    if (!cc)
        return res.status(404).json({ error: "مرکز هزینه یافت نشد" });
    if (cc.hasTransactions)
        return res.status(400).json({ error: "این مرکز هزینه گردش دارد و قابل حذف نیست" });
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.detailCodeUsage.deleteMany({ where: { entityTable: "CostCenter", entityId: id } }),
        prisma_1.prisma.costCenter.delete({ where: { id } }),
    ]);
    res.status(204).send();
});
exports.default = router;
