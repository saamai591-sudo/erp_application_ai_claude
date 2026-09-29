"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const coding_1 = require("../utils/coding");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
const FORM = (0, registry_1.findFormPrefix)("units-of-measure");
const router = (0, express_1.Router)();
router.get("/", async (_req, res) => {
    res.json(await prisma_1.prisma.unitOfMeasure.findMany({ orderBy: { code: "asc" } }));
});
router.post("/", (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
    const body = req.body;
    if (!body.title)
        return res.status(400).json({ error: "عنوان الزامی است" });
    const isWeight = !!body.isWeight;
    if (isWeight && (body.kgEquivalent === undefined || body.kgEquivalent === null || body.kgEquivalent === "")) {
        return res.status(400).json({ error: "برای واحد وزنی، معادل به کیلوگرم الزامی است" });
    }
    try {
        const dup = await prisma_1.prisma.unitOfMeasure.findUnique({ where: { title: body.title } });
        if (dup)
            return res.status(400).json({ error: "عنوان تکراری است" });
        const finalCode = body.code ?? (await (0, coding_1.nextSerialNumber)(prisma_1.prisma.unitOfMeasure, "code"));
        const created = await prisma_1.prisma.unitOfMeasure.create({
            data: {
                code: finalCode,
                title: body.title,
                isWeight,
                kgEquivalent: isWeight ? Number(body.kgEquivalent) : null,
            },
        });
        res.status(201).json(created);
    }
    catch (e) {
        if (e.code === "P2002")
            return res.status(400).json({ error: "کد یا عنوان تکراری است" });
        res.status(400).json({ error: e.message || "خطا در ثبت واحد سنجش" });
    }
});
router.put("/:id", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body;
    const unit = await prisma_1.prisma.unitOfMeasure.findUnique({ where: { id } });
    if (!unit)
        return res.status(404).json({ error: "واحد سنجش یافت نشد" });
    const isWeight = body.isWeight ?? unit.isWeight;
    if (isWeight && (body.kgEquivalent === undefined || body.kgEquivalent === null || body.kgEquivalent === "")) {
        return res.status(400).json({ error: "برای واحد وزنی، معادل به کیلوگرم الزامی است" });
    }
    if (body.title) {
        const dup = await prisma_1.prisma.unitOfMeasure.findFirst({ where: { title: body.title, NOT: { id } } });
        if (dup)
            return res.status(400).json({ error: "عنوان تکراری است" });
    }
    try {
        const updated = await prisma_1.prisma.unitOfMeasure.update({
            where: { id },
            data: {
                title: body.title,
                isWeight,
                kgEquivalent: isWeight ? Number(body.kgEquivalent) : null,
            },
        });
        res.json(updated);
    }
    catch (e) {
        if (e.code === "P2002")
            return res.status(400).json({ error: "عنوان تکراری است" });
        res.status(400).json({ error: e.message || "خطا در ویرایش واحد سنجش" });
    }
});
router.delete("/:id", (0, guard_1.can)(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const unit = await prisma_1.prisma.unitOfMeasure.findUnique({ where: { id } });
    if (!unit)
        return res.status(404).json({ error: "واحد سنجش یافت نشد" });
    if (unit.hasTransactions)
        return res.status(400).json({ error: "این واحد سنجش گردش دارد و قابل حذف نیست" });
    await prisma_1.prisma.unitOfMeasure.delete({ where: { id } });
    res.status(204).send();
});
exports.default = router;
