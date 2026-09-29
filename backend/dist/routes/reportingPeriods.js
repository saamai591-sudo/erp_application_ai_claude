"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const digits_1 = require("../utils/digits");
const requestContext_1 = require("../lib/requestContext");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
const FORM = (0, registry_1.findFormPrefix)("reporting-periods");
const router = (0, express_1.Router)();
// «دوره مالی جاری» در این اپلیکیشن یک تنظیم سراسری قابل انتخاب توسط کاربر است (ذخیره در
// localStorage فرانت‌اند، دقیقاً همان الگوی استفاده‌شده در JournalEntries.tsx) — نه صرفاً آخرین دوره
// مالی تعریف‌شده. فرانت‌اند این شناسه را در پارامتر/بدنه‌ی fiscalPeriodId ارسال می‌کند؛ اینجا فقط در
// نبود آن (مثلاً کاربری که هنوز هیچ دوره‌ای انتخاب نکرده) به آخرین دوره مالی برمی‌گردیم.
async function resolveFiscalPeriod(fiscalPeriodId) {
    if (fiscalPeriodId) {
        return prisma_1.prisma.fiscalPeriod.findUnique({ where: { id: Number(fiscalPeriodId) } });
    }
    return prisma_1.prisma.fiscalPeriod.findFirst({ orderBy: { toDate: "desc" } });
}
router.get("/", async (req, res) => {
    // ?all=1 برای مصرف‌کننده‌هایی مثل «قیمت‌گذاری اسناد انبار» که نیاز به انتخاب از میان دوره‌های
    // گزارشگری همه‌ی دوره‌های مالی دارند (نه فقط دوره مالی جاری کاربر) — چون قیمت‌گذاری کالا اساساً یک
    // زنجیره‌ی زمانی سرتاسری (فارغ از سال مالی) است، نه محدود به یک دوره مالی
    if (req.query.all) {
        const periods = await (0, requestContext_1.withoutFiscalPeriodScope)(() => prisma_1.prisma.reportingPeriod.findMany({
            orderBy: { fromDate: "asc" },
            include: { fiscalPeriod: { select: { title: true } } },
        }));
        return res.json(periods);
    }
    const fp = await resolveFiscalPeriod(req.query.fiscalPeriodId);
    if (!fp)
        return res.json([]);
    const periods = await prisma_1.prisma.reportingPeriod.findMany({
        where: { fiscalPeriodId: fp.id },
        orderBy: { fromDate: "asc" },
    });
    res.json(periods);
});
// جست‌وجوی مستقیم با id — برخلاف GET / به «دوره مالی جاری» محدود نیست، چون فرم ویرایش باید بتواند
// دوره‌ای متعلق به هر دوره مالی (نه فقط دوره مالی انتخاب‌شده‌ی کاربر) را باز کند
router.get("/:id", async (req, res) => {
    const id = Number(req.params.id);
    const period = await prisma_1.prisma.reportingPeriod.findUnique({ where: { id } });
    if (!period)
        return res.status(404).json({ error: "دوره گزارشگری یافت نشد" });
    res.json(period);
});
router.post("/", (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
    const { code: rawCode, title, toDate: rawToDate, fiscalPeriodId } = req.body;
    const code = rawCode ? (0, digits_1.toEnglishDigits)(rawCode).trim() : "";
    if (!code)
        return res.status(400).json({ error: "کد دوره الزامی است" });
    if (!title || !title.trim())
        return res.status(400).json({ error: "عنوان دوره الزامی است" });
    if (!rawToDate)
        return res.status(400).json({ error: "تاریخ پایان الزامی است" });
    const fp = await resolveFiscalPeriod(fiscalPeriodId);
    if (!fp)
        return res.status(400).json({ error: "دوره مالی تعریف نشده است" });
    const dupCode = await prisma_1.prisma.reportingPeriod.findUnique({ where: { fiscalPeriodId_code: { fiscalPeriodId: fp.id, code } } });
    if (dupCode)
        return res.status(400).json({ error: "کد دوره قبلاً استفاده شده است" });
    const lastPeriod = await prisma_1.prisma.reportingPeriod.findFirst({
        where: { fiscalPeriodId: fp.id },
        orderBy: { toDate: "desc" },
    });
    const fromDate = lastPeriod ? new Date(lastPeriod.toDate.getTime() + 24 * 60 * 60 * 1000) : fp.fromDate;
    const toDate = new Date(rawToDate);
    if (toDate < fromDate) {
        return res.status(400).json({ error: "تاریخ پایان نمی‌تواند قبل از تاریخ شروع دوره باشد" });
    }
    if (toDate > fp.toDate) {
        return res.status(400).json({ error: "تاریخ پایان باید در محدوده دوره مالی جاری قرار داشته باشد" });
    }
    const period = await prisma_1.prisma.reportingPeriod.create({
        data: { fiscalPeriodId: fp.id, code, title: title.trim(), fromDate, toDate },
    });
    res.status(201).json(period);
});
router.put("/:id", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const { code: rawCode, title, toDate: rawToDate } = req.body;
    const period = await prisma_1.prisma.reportingPeriod.findUnique({ where: { id } });
    if (!period)
        return res.status(404).json({ error: "دوره گزارشگری یافت نشد" });
    if (period.status === "CLOSED")
        return res.status(400).json({ error: "دوره بسته قابل ویرایش نیست" });
    const fp = await prisma_1.prisma.fiscalPeriod.findUnique({ where: { id: period.fiscalPeriodId } });
    if (!fp)
        return res.status(400).json({ error: "دوره مالی یافت نشد" });
    const code = rawCode !== undefined ? (0, digits_1.toEnglishDigits)(rawCode).trim() : period.code;
    if (!code)
        return res.status(400).json({ error: "کد دوره الزامی است" });
    if (title !== undefined && !title.trim())
        return res.status(400).json({ error: "عنوان دوره الزامی است" });
    if (!rawToDate)
        return res.status(400).json({ error: "تاریخ پایان الزامی است" });
    if (code !== period.code) {
        const dupCode = await prisma_1.prisma.reportingPeriod.findUnique({
            where: { fiscalPeriodId_code: { fiscalPeriodId: period.fiscalPeriodId, code } },
        });
        if (dupCode)
            return res.status(400).json({ error: "کد دوره قبلاً استفاده شده است" });
    }
    const toDate = new Date(rawToDate);
    if (toDate < period.fromDate) {
        return res.status(400).json({ error: "تاریخ پایان نمی‌تواند قبل از تاریخ شروع دوره باشد" });
    }
    if (toDate > fp.toDate) {
        return res.status(400).json({ error: "تاریخ پایان باید در محدوده دوره مالی جاری قرار داشته باشد" });
    }
    const nextPeriod = await prisma_1.prisma.reportingPeriod.findFirst({
        where: { fiscalPeriodId: period.fiscalPeriodId, fromDate: { gt: period.fromDate } },
        orderBy: { fromDate: "asc" },
    });
    if (nextPeriod && toDate >= nextPeriod.fromDate) {
        return res.status(400).json({ error: "دوره‌ها نباید با یکدیگر هم‌پوشانی داشته باشند" });
    }
    const updated = await prisma_1.prisma.reportingPeriod.update({
        where: { id },
        data: { code, title: title !== undefined ? title.trim() : period.title, toDate },
    });
    res.json(updated);
});
router.delete("/:id", (0, guard_1.can)(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const period = await prisma_1.prisma.reportingPeriod.findUnique({ where: { id } });
    if (!period)
        return res.status(404).json({ error: "دوره گزارشگری یافت نشد" });
    if (period.status === "CLOSED")
        return res.status(400).json({ error: "دوره بسته قابل حذف نیست" });
    if (period.hasBeenClosed)
        return res.status(400).json({ error: "این دوره قابل حذف نیست" });
    await prisma_1.prisma.reportingPeriod.delete({ where: { id } });
    res.status(204).send();
});
router.put("/:id/close", (0, guard_1.can)(`${FORM}.closePeriod`), async (req, res) => {
    const id = Number(req.params.id);
    const period = await prisma_1.prisma.reportingPeriod.findUnique({ where: { id } });
    if (!period)
        return res.status(404).json({ error: "دوره گزارشگری یافت نشد" });
    if (period.status === "CLOSED")
        return res.status(400).json({ error: "این دوره قبلاً بسته شده است" });
    const updated = await prisma_1.prisma.reportingPeriod.update({
        where: { id },
        data: { status: "CLOSED", hasBeenClosed: true },
    });
    res.json(updated);
});
router.put("/:id/reopen", (0, guard_1.can)(`${FORM}.reopenPeriod`), async (req, res) => {
    const id = Number(req.params.id);
    const period = await prisma_1.prisma.reportingPeriod.findUnique({ where: { id } });
    if (!period)
        return res.status(404).json({ error: "دوره گزارشگری یافت نشد" });
    if (period.status !== "CLOSED")
        return res.status(400).json({ error: "این دوره بسته نیست" });
    // بازکردن دوره‌ها فقط به ترتیب معکوس (آخرین دوره‌ی بسته‌شده) مجاز است تا در هر لحظه
    // یک دنباله‌ی پیوسته از دوره‌های بسته از ابتدای دوره مالی وجود داشته باشد
    const lastClosed = await prisma_1.prisma.reportingPeriod.findFirst({
        where: { fiscalPeriodId: period.fiscalPeriodId, status: "CLOSED" },
        orderBy: { fromDate: "desc" },
    });
    if (!lastClosed || lastClosed.id !== period.id) {
        return res.status(400).json({ error: "بازکردن این دوره امکان‌پذیر نیست" });
    }
    const updated = await prisma_1.prisma.reportingPeriod.update({ where: { id }, data: { status: "OPEN" } });
    res.json(updated);
});
exports.default = router;
