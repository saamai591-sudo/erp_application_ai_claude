"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const coding_1 = require("../utils/coding");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
const jalaliDate_1 = require("../utils/jalaliDate");
const DETAIL_TYPE_FISCAL_PERIOD = 7;
const FORM = (0, registry_1.findFormPrefix)("periods");
const router = (0, express_1.Router)();
// قفل مشورتی (advisory) پایگاه‌داده برای سریال‌سازی هر تغییری که «زنجیره‌ی دوره‌های مالی» را عوض می‌کند (ایجاد دوره‌ی جدید / تغییر تا تاریخ آخرین دوره):
// دو درخواست هم‌زمان نمی‌توانند هم‌زمان آخرین دوره را بخوانند و دو دوره‌ی هم‌پوشان یا با فاصله بسازند؛ کنترل توالی داخل همان تراکنش و پس از گرفتن قفل انجام می‌شود.
const FISCAL_CHAIN_LOCK_KEY = 7100001;
const DAY_MS = 86400000;
const iso = (d) => d.toISOString().slice(0, 10);
class ChainError extends Error {
}
router.get("/", async (_req, res) => {
    const periods = await prisma_1.prisma.fiscalPeriod.findMany({ orderBy: { fromDate: "asc" } });
    res.json(periods);
});
router.post("/", (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
    const { title, fromDate, toDate } = req.body;
    if (!title || !/^\d{4}$/.test(title)) {
        return res.status(400).json({ error: "عنوان باید یک عدد ۴ رقمی باشد" });
    }
    if (!fromDate || !toDate)
        return res.status(400).json({ error: "از تاریخ و تا تاریخ الزامی است" });
    const from = new Date(fromDate);
    const to = new Date(toDate);
    if (to <= from)
        return res.status(400).json({ error: "تا تاریخ نمی‌تواند کوچکتر یا مساوی از تاریخ باشد" });
    const dupTitle = await prisma_1.prisma.fiscalPeriod.findUnique({ where: { title } });
    if (dupTitle)
        return res.status(400).json({ error: "عنوان تکراری است" });
    const { code, detailTypeId } = await (0, coding_1.generateDetailCode)(DETAIL_TYPE_FISCAL_PERIOD);
    try {
        // توالی دوره‌ها سمت سرور کنترل می‌شود (نه فقط فرانت‌اند): «از تاریخ» دوره‌ی جدید باید دقیقاً یک روز بعد از پایان آخرین دوره باشد؛ نه فاصله، نه هم‌پوشانی.
        // خواندن آخرین دوره، بررسی و ایجاد داخل یک تراکنش با قفل مشورتی انجام می‌شود تا ایجاد هم‌زمان چند دوره نتواند این قاعده را دور بزند.
        const period = await prisma_1.prisma.$transaction(async (tx) => {
            await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${FISCAL_CHAIN_LOCK_KEY})`);
            const dupTitle = await tx.fiscalPeriod.findUnique({ where: { title } });
            if (dupTitle)
                throw new ChainError("عنوان تکراری است");
            const lastPeriod = await tx.fiscalPeriod.findFirst({ orderBy: { toDate: "desc" } });
            if (lastPeriod) {
                const expected = new Date(lastPeriod.toDate.getTime() + DAY_MS);
                if (iso(from) !== iso(expected)) {
                    throw new ChainError(`از تاریخ دوره‌ی مالی جدید باید دقیقاً یک روز بعد از پایان آخرین دوره مالی (${(0, jalaliDate_1.formatJalaliDateForMessage)(lastPeriod.toDate)}) یعنی ${(0, jalaliDate_1.formatJalaliDateForMessage)(expected)} باشد؛ بین دوره‌های مالی نباید فاصله یا هم‌پوشانی وجود داشته باشد`);
                }
            }
            return tx.fiscalPeriod.create({ data: { code, title, fromDate: from, toDate: to } });
        });
        await (0, coding_1.registerDetailCode)(code, detailTypeId, "FiscalPeriod", period.id);
        res.status(201).json(period);
    }
    catch (e) {
        if (e instanceof ChainError)
            return res.status(400).json({ error: e.message });
        res.status(400).json({ error: e?.message || "خطا در ایجاد دوره مالی" });
    }
});
// فقط تا تاریخ آخرین دوره مالی تعریف شده قابل ویرایش است
router.put("/:id", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const { toDate } = req.body;
    const period = await prisma_1.prisma.fiscalPeriod.findUnique({ where: { id } });
    if (!period)
        return res.status(404).json({ error: "دوره مالی یافت نشد" });
    const to = new Date(toDate);
    if (!toDate || Number.isNaN(to.getTime()))
        return res.status(400).json({ error: "تا تاریخ الزامی است" });
    if (to <= period.fromDate) {
        return res.status(400).json({ error: "تا تاریخ نمی‌تواند کوچکتر یا مساوی از تاریخ باشد" });
    }
    try {
        // با همان قفل ایجاد دوره: در همان لحظه دوره‌ی بعدی ساخته نشود تا با تغییر پایان دوره‌ی قبلی فاصله/هم‌پوشانی ایجاد نکند
        const updated = await prisma_1.prisma.$transaction(async (tx) => {
            await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${FISCAL_CHAIN_LOCK_KEY})`);
            const lastPeriod = await tx.fiscalPeriod.findFirst({ orderBy: { toDate: "desc" } });
            if (!lastPeriod || lastPeriod.id !== id)
                throw new ChainError("فقط تا تاریخ آخرین دوره مالی تعریف شده قابل ویرایش است");
            return tx.fiscalPeriod.update({ where: { id }, data: { toDate: to } });
        });
        res.json(updated);
    }
    catch (e) {
        if (e instanceof ChainError)
            return res.status(400).json({ error: e.message });
        res.status(400).json({ error: e?.message || "خطا در ویرایش دوره مالی" });
    }
});
router.delete("/:id", (0, guard_1.can)(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const period = await prisma_1.prisma.fiscalPeriod.findUnique({ where: { id } });
    if (!period)
        return res.status(404).json({ error: "دوره مالی یافت نشد" });
    if (period.hasTransactions) {
        return res.status(400).json({ error: "این دوره مالی گردش دارد و قابل حذف نیست" });
    }
    try {
        await prisma_1.prisma.$transaction([
            prisma_1.prisma.detailCodeUsage.deleteMany({ where: { entityTable: "FiscalPeriod", entityId: id } }),
            prisma_1.prisma.fiscalPeriod.delete({ where: { id } }),
        ]);
        res.status(204).send();
    }
    catch (e) {
        if (e?.code === "P2003") {
            return res.status(400).json({ error: "این دوره مالی گردش دارد و قابل حذف نیست" });
        }
        res.status(400).json({ error: e?.message || "خطا در حذف دوره مالی" });
    }
});
exports.default = router;
