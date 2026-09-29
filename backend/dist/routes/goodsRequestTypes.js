"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const coding_1 = require("../utils/coding");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
const FORM = (0, registry_1.findFormPrefix)("goods-request-types");
const router = (0, express_1.Router)();
router.get("/", async (_req, res) => {
    res.json(await prisma_1.prisma.goodsRequestType.findMany({ orderBy: { code: "asc" } }));
});
router.post("/", (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
    const body = req.body;
    if (!body.title)
        return res.status(400).json({ error: "عنوان الزامی است" });
    try {
        const dup = await prisma_1.prisma.goodsRequestType.findUnique({ where: { title: body.title } });
        if (dup)
            return res.status(400).json({ error: "عنوان تکراری است" });
        // کد این فرم کاملا سیستمی است و امکان ورود دستی ندارد
        const code = await (0, coding_1.nextSerialNumber)(prisma_1.prisma.goodsRequestType, "code");
        const created = await prisma_1.prisma.goodsRequestType.create({
            data: { code, title: body.title, nature: body.nature ?? "CENTER_REQUEST" },
        });
        res.status(201).json(created);
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در ثبت نوع درخواست کالا" });
    }
});
router.put("/:id", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body;
    const type = await prisma_1.prisma.goodsRequestType.findUnique({ where: { id } });
    if (!type)
        return res.status(404).json({ error: "نوع درخواست کالا یافت نشد" });
    if (type.hasTransactions && body.nature && body.nature !== type.nature) {
        return res.status(400).json({ error: "این نوع درخواست گردش دارد و ماهیت آن قابل تغییر نیست" });
    }
    if (body.title) {
        const dup = await prisma_1.prisma.goodsRequestType.findFirst({ where: { title: body.title, NOT: { id } } });
        if (dup)
            return res.status(400).json({ error: "عنوان تکراری است" });
    }
    const updated = await prisma_1.prisma.goodsRequestType.update({
        where: { id },
        data: { title: body.title, nature: body.nature },
    });
    res.json(updated);
});
router.delete("/:id", (0, guard_1.can)(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const type = await prisma_1.prisma.goodsRequestType.findUnique({ where: { id } });
    if (!type)
        return res.status(404).json({ error: "نوع درخواست کالا یافت نشد" });
    if (type.hasTransactions)
        return res.status(400).json({ error: "این نوع درخواست گردش دارد و قابل حذف نیست" });
    await prisma_1.prisma.goodsRequestType.delete({ where: { id } });
    res.status(204).send();
});
exports.default = router;
