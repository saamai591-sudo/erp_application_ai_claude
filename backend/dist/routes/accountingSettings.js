"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
const accountingSettingsService_1 = require("../services/accountingSettingsService");
const FORM = (0, registry_1.findFormPrefix)("accounting-settings");
// =========================================================================
// ماژول «حسابداری» > تنظیمات > رویه‌ها و تنظیمات حسابداری — طبق Documents/رویه ها و تنظیمات حسابداری.md
// دو زبانه‌ی فعلی: «تنظیمات ارز» (روش شناسایی پیش‌دریافت ارزی) و «ارزش افزوده» (نرخ درصدی) — هر دو تاریخ‌محور:
// هر رکورد «تاریخ شروع اعتبار» دارد، تاریخ شروع یکتاست، و مقدار معتبر برای یک تاریخ آخرین رکوردِ با تاریخ شروع ≤ آن تاریخ است
// (خواندن: services/accountingSettingsService.ts). زبانه‌های بعدی هم باید همین الگو را دنبال کنند.
// =========================================================================
const router = (0, express_1.Router)();
const ADVANCE_METHODS = ["HISTORICAL_RATE", "TRANSACTION_DATE_RATE"];
function parseStartDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(value))
        throw new Error("تاریخ شروع اعتبار الزامی است");
    const d = new Date(value.slice(0, 10));
    if (isNaN(d.getTime()))
        throw new Error("تاریخ شروع اعتبار نامعتبر است");
    return d;
}
function parseRatePercent(value) {
    const n = Number(value);
    if (!(n > 0) || n > 100)
        throw new Error("نرخ ارزش افزوده باید بیشتر از صفر و حداکثر ۱۰۰٪ باشد");
    return n;
}
// -------------------------------------------------------------------------
// نرخ ارزش افزوده — خواندن برای همه‌ی کاربران وارد‌شده (فرم‌های فاکتور/پیش‌فاکتور برای نمایش زنده‌ی مالیات به آن نیاز دارند)
// -------------------------------------------------------------------------
router.get("/accounting-settings/vat-rates", async (_req, res) => {
    const rows = await prisma_1.prisma.accountingVatRate.findMany({ orderBy: { startDate: "asc" } });
    res.json(rows.map((r) => ({ id: r.id, startDate: r.startDate, ratePercent: Number(r.ratePercent) })));
});
router.post("/accounting-settings/vat-rates", (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
    try {
        const startDate = parseStartDate(req.body.startDate);
        const ratePercent = parseRatePercent(req.body.ratePercent);
        if (await prisma_1.prisma.accountingVatRate.findUnique({ where: { startDate } }))
            throw new Error("برای این تاریخ شروع اعتبار قبلاً نرخ ارزش افزوده ثبت شده است");
        const created = await prisma_1.prisma.accountingVatRate.create({ data: { startDate, ratePercent } });
        (0, accountingSettingsService_1.invalidateAccountingSettingsCache)();
        res.status(201).json({ id: created.id, startDate: created.startDate, ratePercent: Number(created.ratePercent) });
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در ثبت نرخ ارزش افزوده" });
    }
});
router.put("/accounting-settings/vat-rates/:id", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    try {
        if (!(await prisma_1.prisma.accountingVatRate.findUnique({ where: { id } })))
            return res.status(404).json({ error: "رکورد یافت نشد" });
        const startDate = parseStartDate(req.body.startDate);
        const ratePercent = parseRatePercent(req.body.ratePercent);
        const dup = await prisma_1.prisma.accountingVatRate.findFirst({ where: { startDate, NOT: { id } } });
        if (dup)
            throw new Error("برای این تاریخ شروع اعتبار قبلاً نرخ ارزش افزوده ثبت شده است");
        const updated = await prisma_1.prisma.accountingVatRate.update({ where: { id }, data: { startDate, ratePercent } });
        (0, accountingSettingsService_1.invalidateAccountingSettingsCache)();
        res.json({ id: updated.id, startDate: updated.startDate, ratePercent: Number(updated.ratePercent) });
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در ویرایش نرخ ارزش افزوده" });
    }
});
router.delete("/accounting-settings/vat-rates/:id", (0, guard_1.can)(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    if (!(await prisma_1.prisma.accountingVatRate.findUnique({ where: { id } })))
        return res.status(404).json({ error: "رکورد یافت نشد" });
    if ((await prisma_1.prisma.accountingVatRate.count()) <= 1)
        return res.status(400).json({ error: "حداقل یک رکورد نرخ ارزش افزوده باید وجود داشته باشد" });
    await prisma_1.prisma.accountingVatRate.delete({ where: { id } });
    (0, accountingSettingsService_1.invalidateAccountingSettingsCache)();
    res.status(204).send();
});
// -------------------------------------------------------------------------
// روش شناسایی پیش‌دریافت ارزی
// -------------------------------------------------------------------------
router.get("/accounting-settings/advance-receipt-methods", (0, guard_1.can)(`${FORM}.view`), async (_req, res) => {
    const rows = await prisma_1.prisma.accountingAdvanceReceiptSetting.findMany({ orderBy: { startDate: "asc" } });
    res.json(rows.map((r) => ({ id: r.id, startDate: r.startDate, method: r.method })));
});
function parseMethod(value) {
    if (typeof value !== "string" || !ADVANCE_METHODS.includes(value))
        throw new Error("روش شناسایی پیش‌دریافت ارزی الزامی است");
    return value;
}
router.post("/accounting-settings/advance-receipt-methods", (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
    try {
        const startDate = parseStartDate(req.body.startDate);
        const method = parseMethod(req.body.method);
        if (await prisma_1.prisma.accountingAdvanceReceiptSetting.findUnique({ where: { startDate } }))
            throw new Error("برای این تاریخ شروع اعتبار قبلاً روش شناسایی ثبت شده است");
        const created = await prisma_1.prisma.accountingAdvanceReceiptSetting.create({ data: { startDate, method: method } });
        (0, accountingSettingsService_1.invalidateAccountingSettingsCache)();
        res.status(201).json({ id: created.id, startDate: created.startDate, method: created.method });
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در ثبت روش شناسایی پیش‌دریافت ارزی" });
    }
});
router.put("/accounting-settings/advance-receipt-methods/:id", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    try {
        if (!(await prisma_1.prisma.accountingAdvanceReceiptSetting.findUnique({ where: { id } })))
            return res.status(404).json({ error: "رکورد یافت نشد" });
        const startDate = parseStartDate(req.body.startDate);
        const method = parseMethod(req.body.method);
        const dup = await prisma_1.prisma.accountingAdvanceReceiptSetting.findFirst({ where: { startDate, NOT: { id } } });
        if (dup)
            throw new Error("برای این تاریخ شروع اعتبار قبلاً روش شناسایی ثبت شده است");
        const updated = await prisma_1.prisma.accountingAdvanceReceiptSetting.update({ where: { id }, data: { startDate, method: method } });
        (0, accountingSettingsService_1.invalidateAccountingSettingsCache)();
        res.json({ id: updated.id, startDate: updated.startDate, method: updated.method });
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در ویرایش روش شناسایی پیش‌دریافت ارزی" });
    }
});
router.delete("/accounting-settings/advance-receipt-methods/:id", (0, guard_1.can)(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    if (!(await prisma_1.prisma.accountingAdvanceReceiptSetting.findUnique({ where: { id } })))
        return res.status(404).json({ error: "رکورد یافت نشد" });
    await prisma_1.prisma.accountingAdvanceReceiptSetting.delete({ where: { id } });
    (0, accountingSettingsService_1.invalidateAccountingSettingsCache)();
    res.status(204).send();
});
exports.default = router;
