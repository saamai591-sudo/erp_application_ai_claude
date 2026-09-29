"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const coding_1 = require("../utils/coding");
const concurrency_1 = require("../utils/concurrency");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
const FORM = (0, registry_1.findFormPrefix)("goods-attributes");
const router = (0, express_1.Router)();
function validateItems(items, itemCodeLength) {
    if (!Array.isArray(items) || items.length === 0) {
        throw new Error("حداقل یک آیتم برای ویژگی الزامی است");
    }
    const seen = new Set();
    for (const [idx, item] of items.entries()) {
        if (!item.code || !item.code.trim())
            throw new Error(`کد آیتم ${idx + 1} الزامی است`);
        if (!item.title || !item.title.trim())
            throw new Error(`عنوان آیتم ${idx + 1} الزامی است`);
        if (item.code.length !== itemCodeLength) {
            throw new Error(`طول کد آیتم ${idx + 1} باید ${itemCodeLength} کاراکتر باشد`);
        }
        if (seen.has(item.code))
            throw new Error(`کد آیتم «${item.code}» تکراری است`);
        seen.add(item.code);
    }
    return items.map((i) => ({ code: i.code.trim(), title: i.title.trim() }));
}
router.get("/", async (_req, res) => {
    res.json(await prisma_1.prisma.goodsAttribute.findMany({
        include: { items: true },
        orderBy: { code: "asc" },
    }));
});
router.get("/:id", async (req, res) => {
    const id = Number(req.params.id);
    const attribute = await prisma_1.prisma.goodsAttribute.findUnique({ where: { id }, include: { items: true } });
    if (!attribute)
        return res.status(404).json({ error: "ویژگی کالا یافت نشد" });
    res.json(attribute);
});
router.post("/", (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
    const body = req.body;
    if (!body.title)
        return res.status(400).json({ error: "عنوان الزامی است" });
    if (!body.itemCodeLength || body.itemCodeLength < 1 || body.itemCodeLength > 8) {
        return res.status(400).json({ error: "طول کد آیتم باید بین ۱ تا ۸ باشد" });
    }
    try {
        const items = validateItems(body.items, body.itemCodeLength);
        const dup = await prisma_1.prisma.goodsAttribute.findUnique({ where: { title: body.title } });
        if (dup)
            return res.status(400).json({ error: "عنوان تکراری است" });
        const finalCode = body.code ?? (await (0, coding_1.nextSerialNumber)(prisma_1.prisma.goodsAttribute, "code"));
        const created = await prisma_1.prisma.goodsAttribute.create({
            data: {
                code: finalCode,
                title: body.title,
                itemCodeLength: body.itemCodeLength,
                items: { create: items },
            },
            include: { items: true },
        });
        res.status(201).json(created);
    }
    catch (e) {
        if (e.code === "P2002")
            return res.status(400).json({ error: "کد یا عنوان تکراری است" });
        res.status(400).json({ error: e.message || "خطا در ثبت ویژگی کالا" });
    }
});
router.put("/:id", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body;
    const attribute = await prisma_1.prisma.goodsAttribute.findUnique({ where: { id } });
    if (!attribute)
        return res.status(404).json({ error: "ویژگی کالا یافت نشد" });
    try {
        (0, concurrency_1.assertRecordNotStale)(attribute.updatedAt, req.body.updatedAt, "این ویژگی کالا");
    }
    catch (e) {
        return res.status(400).json({ error: e.message });
    }
    const itemCodeLength = body.itemCodeLength ?? attribute.itemCodeLength;
    if (itemCodeLength < 1 || itemCodeLength > 8) {
        return res.status(400).json({ error: "طول کد آیتم باید بین ۱ تا ۸ باشد" });
    }
    if (body.title) {
        const dup = await prisma_1.prisma.goodsAttribute.findFirst({ where: { title: body.title, NOT: { id } } });
        if (dup)
            return res.status(400).json({ error: "عنوان تکراری است" });
    }
    try {
        const items = body.items !== undefined ? validateItems(body.items, itemCodeLength) : undefined;
        const data = { title: body.title, itemCodeLength };
        if (items) {
            await prisma_1.prisma.goodsAttributeItem.deleteMany({ where: { attributeId: id } });
            data.items = { create: items };
        }
        const updated = await prisma_1.prisma.goodsAttribute.update({ where: { id }, data, include: { items: true } });
        res.json(updated);
    }
    catch (e) {
        if (e.code === "P2002")
            return res.status(400).json({ error: "کد یا عنوان تکراری است" });
        res.status(400).json({ error: e.message || "خطا در ویرایش ویژگی کالا" });
    }
});
router.delete("/:id", (0, guard_1.can)(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const attribute = await prisma_1.prisma.goodsAttribute.findUnique({ where: { id } });
    if (!attribute)
        return res.status(404).json({ error: "ویژگی کالا یافت نشد" });
    if (attribute.hasTransactions)
        return res.status(400).json({ error: "این ویژگی گردش دارد و قابل حذف نیست" });
    const inUse = await prisma_1.prisma.goodsGroupAttribute.findFirst({ where: { attributeId: id } });
    if (inUse)
        return res.status(400).json({ error: "این ویژگی در یک یا چند گروه کالا استفاده شده و قابل حذف نیست" });
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.goodsAttributeItem.deleteMany({ where: { attributeId: id } }),
        prisma_1.prisma.goodsAttribute.delete({ where: { id } }),
    ]);
    res.status(204).send();
});
exports.default = router;
