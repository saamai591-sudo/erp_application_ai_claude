"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
const FORM = (0, registry_1.findFormPrefix)("reporting-levels");
const router = (0, express_1.Router)();
// طول کد باید عدد صحیح مثبت باشد (تعداد رقم کد این سطح در کدینگ حسابها)؛ مقادیر اعشاری/منفی/صفر
// نباید پذیرفته شوند — فرانت‌اند فقط با Number() مقدار را تبدیل می‌کند و همین باعث می‌شد مقادیری مثل
// «۱٫۵» بدون خطا ذخیره شوند، پس این کنترل باید در بک‌اند (منبع معتبر) هم تکرار شود.
function isValidCodeLength(v) {
    return typeof v === "number" && Number.isInteger(v) && v > 0;
}
router.get("/", async (_req, res) => {
    const levels = await prisma_1.prisma.reportingLevel.findMany({ orderBy: { order: "asc" } });
    const counts = await prisma_1.prisma.account.groupBy({ by: ["levelId"], _count: { _all: true } });
    const countByLevel = new Map(counts.map((c) => [c.levelId, c._count._all]));
    res.json(levels.map((l) => ({ ...l, hasAccounts: (countByLevel.get(l.id) || 0) > 0 })));
});
router.post("/", (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
    const { title, codeLength } = req.body;
    if (!title || !codeLength)
        return res.status(400).json({ error: "عنوان و طول کد الزامی است" });
    if (!isValidCodeLength(codeLength))
        return res.status(400).json({ error: "طول کد باید عدد صحیح مثبت باشد" });
    const last = await prisma_1.prisma.reportingLevel.findFirst({ orderBy: { order: "desc" } });
    const order = last ? last.order + 1 : 1;
    const dup = await prisma_1.prisma.reportingLevel.findUnique({ where: { title } });
    if (dup)
        return res.status(400).json({ error: "عنوان تکراری است" });
    const created = await prisma_1.prisma.reportingLevel.create({ data: { order, title, codeLength } });
    res.status(201).json(created);
});
router.put("/:id", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const { title, codeLength } = req.body;
    if (codeLength !== undefined && !isValidCodeLength(codeLength)) {
        return res.status(400).json({ error: "طول کد باید عدد صحیح مثبت باشد" });
    }
    const existing = await prisma_1.prisma.reportingLevel.findUnique({ where: { id } });
    if (!existing)
        return res.status(404).json({ error: "سطح گزارشگری یافت نشد" });
    // به‌محض تعریف اولین حساب روی این سطح، طول کد دیگر قابل تغییر نیست — چون کدهای همان حساب‌ها بر
    // اساس همین طول ساخته شده‌اند و تغییر آن، کدهای موجود را نامعتبر/ناهماهنگ می‌کند.
    if (codeLength !== undefined && codeLength !== existing.codeLength) {
        const inUse = await prisma_1.prisma.account.findFirst({ where: { levelId: id } });
        if (inUse)
            return res.status(400).json({ error: "این سطح دارای حساب تعریف‌شده است و طول کد آن قابل تغییر نیست" });
    }
    if (title) {
        const dup = await prisma_1.prisma.reportingLevel.findFirst({ where: { title, NOT: { id } } });
        if (dup)
            return res.status(400).json({ error: "عنوان تکراری است" });
    }
    const updated = await prisma_1.prisma.reportingLevel.update({ where: { id }, data: { title, codeLength } });
    res.json(updated);
});
router.delete("/:id", (0, guard_1.can)(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const level = await prisma_1.prisma.reportingLevel.findUnique({ where: { id } });
    if (!level)
        return res.status(404).json({ error: "سطح گزارشگری یافت نشد" });
    // فقط آخرین سطح (بیشترین ترتیب) و در صورت نداشتن هیچ حسابی قابل حذف است
    const last = await prisma_1.prisma.reportingLevel.findFirst({ orderBy: { order: "desc" } });
    if (!last || last.id !== id) {
        return res.status(400).json({ error: "فقط آخرین سطح گزارشگری قابل حذف است" });
    }
    const inUse = await prisma_1.prisma.account.findFirst({ where: { levelId: id } });
    if (inUse)
        return res.status(400).json({ error: "این سطح دارای حساب تعریف‌شده است و قابل حذف نیست" });
    try {
        await prisma_1.prisma.reportingLevel.delete({ where: { id } });
        res.status(204).send();
    }
    catch (e) {
        if (e?.code === "P2003") {
            return res.status(400).json({ error: "این سطح دارای حساب تعریف‌شده است و قابل حذف نیست" });
        }
        res.status(400).json({ error: e?.message || "خطا در حذف سطح گزارشگری" });
    }
});
exports.default = router;
