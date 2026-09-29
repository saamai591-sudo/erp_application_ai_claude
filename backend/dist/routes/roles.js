"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const coding_1 = require("../utils/coding");
const concurrency_1 = require("../utils/concurrency");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
const FORM = (0, registry_1.findFormPrefix)("roles");
const router = (0, express_1.Router)();
// درخت کامل Module → SubModule → Form → Action برای این نقش خاص اکنون از GET /api/authz/tree
// (که مستقیماً از Registry تولید می‌شود) خوانده می‌شود — نگاه کنید به routes/authz.ts.
router.get("/", (0, guard_1.can)(`${FORM}.view`), async (_req, res) => {
    const roles = await prisma_1.prisma.role.findMany({
        include: { actions: { include: { action: true } } },
        orderBy: { code: "asc" },
    });
    res.json(roles);
});
router.get("/:id", (0, guard_1.can)(`${FORM}.view`), async (req, res) => {
    const role = await prisma_1.prisma.role.findUnique({
        where: { id: Number(req.params.id) },
        include: { actions: { include: { action: true } } },
    });
    if (!role)
        return res.status(404).json({ error: "نقش یافت نشد" });
    res.json(role);
});
router.post("/", (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
    const { code, title, actionIds } = req.body;
    if (!title)
        return res.status(400).json({ error: "عنوان الزامی است" });
    const dupTitle = await prisma_1.prisma.role.findUnique({ where: { title } });
    if (dupTitle)
        return res.status(400).json({ error: "عنوان تکراری است" });
    const finalCode = code ?? (await (0, coding_1.nextSerialNumber)(prisma_1.prisma.role, "code"));
    const dupCode = await prisma_1.prisma.role.findUnique({ where: { code: finalCode } });
    if (dupCode)
        return res.status(400).json({ error: "کد تکراری است" });
    const role = await prisma_1.prisma.role.create({
        data: {
            code: finalCode,
            title,
            actions: actionIds ? { create: actionIds.map((actionId) => ({ actionId })) } : undefined,
        },
        include: { actions: true },
    });
    res.status(201).json(role);
});
router.put("/:id", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const { title, actionIds } = req.body;
    const existing = await prisma_1.prisma.role.findUnique({ where: { id } });
    if (!existing)
        return res.status(404).json({ error: "نقش یافت نشد" });
    try {
        (0, concurrency_1.assertRecordNotStale)(existing.updatedAt, req.body.updatedAt, "این نقش");
    }
    catch (e) {
        return res.status(400).json({ error: e.message });
    }
    if (title) {
        const dup = await prisma_1.prisma.role.findFirst({ where: { title, NOT: { id } } });
        if (dup)
            return res.status(400).json({ error: "عنوان تکراری است" });
    }
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.role.update({ where: { id }, data: { title } }),
        prisma_1.prisma.roleAction.deleteMany({ where: { roleId: id } }),
        ...(actionIds && actionIds.length
            ? [prisma_1.prisma.roleAction.createMany({ data: actionIds.map((actionId) => ({ roleId: id, actionId })) })]
            : []),
    ]);
    const role = await prisma_1.prisma.role.findUnique({
        where: { id },
        include: { actions: { include: { action: true } } },
    });
    res.json(role);
});
router.delete("/:id", (0, guard_1.can)(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const inUse = await prisma_1.prisma.userRole.findFirst({ where: { roleId: id } });
    if (inUse) {
        return res.status(400).json({ error: "این نقش به کاربری تخصیص داده شده و قابل حذف نیست" });
    }
    try {
        await prisma_1.prisma.role.delete({ where: { id } });
        res.status(204).send();
    }
    catch (e) {
        if (e?.code === "P2003") {
            return res.status(400).json({ error: "این نقش در جایی استفاده شده و قابل حذف نیست" });
        }
        res.status(400).json({ error: e?.message || "خطا در حذف نقش کاربری" });
    }
});
exports.default = router;
