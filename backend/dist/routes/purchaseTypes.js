"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const coding_1 = require("../utils/coding");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
const FORM = (0, registry_1.findFormPrefix)("purchase-types");
const router = (0, express_1.Router)();
router.get("/purchase-types", async (_req, res) => {
    res.json(await prisma_1.prisma.purchaseType.findMany({ orderBy: { code: "asc" } }));
});
router.post("/purchase-types", (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
    const body = req.body;
    if (!body.title)
        return res.status(400).json({ error: "عنوان الزامی است" });
    if (!body.nature)
        return res.status(400).json({ error: "نوع الزامی است" });
    try {
        const dup = await prisma_1.prisma.purchaseType.findUnique({ where: { title: body.title } });
        if (dup)
            return res.status(400).json({ error: "عنوان تکراری است" });
        const finalCode = body.code ?? (await (0, coding_1.nextSerialNumber)(prisma_1.prisma.purchaseType, "code"));
        const created = await prisma_1.prisma.purchaseType.create({
            data: { code: finalCode, title: body.title, nature: body.nature },
        });
        res.status(201).json(created);
    }
    catch (e) {
        if (e.code === "P2002")
            return res.status(400).json({ error: "کد یا عنوان تکراری است" });
        res.status(400).json({ error: e.message || "خطا در ثبت نوع خرید" });
    }
});
router.put("/purchase-types/:id", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body;
    const existing = await prisma_1.prisma.purchaseType.findUnique({ where: { id } });
    if (!existing)
        return res.status(404).json({ error: "نوع خرید یافت نشد" });
    if (body.title) {
        const dup = await prisma_1.prisma.purchaseType.findFirst({ where: { title: body.title, NOT: { id } } });
        if (dup)
            return res.status(400).json({ error: "عنوان تکراری است" });
    }
    try {
        const updated = await prisma_1.prisma.purchaseType.update({
            where: { id },
            data: { title: body.title, nature: body.nature },
        });
        res.json(updated);
    }
    catch (e) {
        if (e.code === "P2002")
            return res.status(400).json({ error: "عنوان تکراری است" });
        res.status(400).json({ error: e.message || "خطا در ویرایش نوع خرید" });
    }
});
router.delete("/purchase-types/:id", (0, guard_1.can)(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma_1.prisma.purchaseType.findUnique({ where: { id } });
    if (!existing)
        return res.status(404).json({ error: "نوع خرید یافت نشد" });
    if (existing.hasTransactions)
        return res.status(400).json({ error: "این نوع خرید گردش دارد و قابل حذف نیست" });
    try {
        await prisma_1.prisma.purchaseType.delete({ where: { id } });
        res.status(204).send();
    }
    catch (e) {
        if (e.code === "P2003")
            return res.status(400).json({ error: "این نوع خرید در جایی استفاده شده و قابل حذف نیست" });
        res.status(400).json({ error: e.message || "خطا در حذف نوع خرید" });
    }
});
exports.default = router;
