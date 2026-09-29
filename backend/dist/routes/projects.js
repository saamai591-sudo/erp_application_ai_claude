"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const coding_1 = require("../utils/coding");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
const FORM = (0, registry_1.findFormPrefix)("projects");
// =========================================================================
// «پروژه» — مدل ساده و حداقلی (کد تفصیل/عنوان/فعال)، طبق تصمیم پروژه، فقط برای اینکه فیلد «محل مصرف»ِ
// درخواست کالا با ماهیت «درخواست پروژه» قابل انتخاب باشد. عمداً بدون منو/فرم مدیریتی مجزا در این فاز
// (رجوع به مستند claude/سرویس-درخواست-کالا-و-تامین.md). این route فقط برای اینکه از طریق API قابل
// مدیریت باشد نگه داشته شده؛ هیچ صفحه‌ای در فرانت‌اند/منو به این مسیر لینک نمی‌دهد.
// مثل طرف حساب/مرکز هزینه، پروژه هم عضو رجیستری «تفصیل» است تا اسناد انبار بتوانند با یک فیلد واحد
// (InventoryDocument.detailCode) به آن ارجاع دهند.
// =========================================================================
const DETAIL_TYPE_PROJECT = 8;
const router = (0, express_1.Router)();
router.get("/", async (_req, res) => {
    res.json(await prisma_1.prisma.project.findMany({ orderBy: { detailCode: "asc" } }));
});
router.post("/", (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
    const body = req.body;
    if (!body.title)
        return res.status(400).json({ error: "عنوان الزامی است" });
    try {
        const dup = await prisma_1.prisma.project.findUnique({ where: { title: body.title } });
        if (dup)
            return res.status(400).json({ error: "عنوان تکراری است" });
        const { code, detailTypeId } = await (0, coding_1.generateDetailCode)(DETAIL_TYPE_PROJECT);
        const created = await prisma_1.prisma.project.create({
            data: { detailCode: code, title: body.title, isActive: body.isActive ?? true },
        });
        await (0, coding_1.registerDetailCode)(code, detailTypeId, "Project", created.id);
        res.status(201).json(created);
    }
    catch (e) {
        if (e.code === "P2002")
            return res.status(400).json({ error: "کد یا عنوان تکراری است" });
        res.status(400).json({ error: e.message || "خطا در ثبت پروژه" });
    }
});
router.put("/:id", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body;
    if (body.title) {
        const dup = await prisma_1.prisma.project.findFirst({ where: { title: body.title, NOT: { id } } });
        if (dup)
            return res.status(400).json({ error: "عنوان تکراری است" });
    }
    try {
        const updated = await prisma_1.prisma.project.update({ where: { id }, data: { title: body.title, isActive: body.isActive } });
        res.json(updated);
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در ویرایش پروژه" });
    }
});
router.delete("/:id", (0, guard_1.can)(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const inUse = await prisma_1.prisma.goodsRequestLine.findFirst({ where: { projectId: id } });
    if (inUse)
        return res.status(400).json({ error: "این پروژه در ردیف‌های درخواست کالا استفاده شده و قابل حذف نیست" });
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.detailCodeUsage.deleteMany({ where: { entityTable: "Project", entityId: id } }),
        prisma_1.prisma.project.delete({ where: { id } }),
    ]);
    res.status(204).send();
});
exports.default = router;
