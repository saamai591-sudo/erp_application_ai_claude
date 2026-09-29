"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
// =========================================================================
// ماژول «خزانه‌داری» > تنظیمات > دسته چک — طبق Documents/دسته چک.md.
//
// هر رکورد یک «برگه‌ی چک» مجزاست (نه کل دسته)، با شماره‌ی یکتا در سطح حساب بانکی. حساب بانکی فقط از
// نوع‌هایی قابل انتخاب است که BankAccountType.hasChequeBook فعال باشد (کنترل ۱ سند — همین‌جا اعمال
// می‌شود، نه در خود انتخابگر فرانت‌اند، تا از سمت سرور هم تضمین شود).
//
// وضعیت (کنترل ۲ و ۳ سند) هرگز مستقیماً توسط این فایل به ISSUED تغییر نمی‌کند — آن انتقال در
// routes/payments.ts (تایید سند پرداخت یا ایجاد ردیف چک تازه در ویرایش سند تاییدشده) رخ می‌دهد، جایی
// که برگه واقعاً برای صدور یک چک پرداختنی مصرف می‌شود. اینجا فقط سه چیز مجاز است: ایجاد (خام)، ویرایش
// خامِ هنوز مصرف‌نشده، و ابطال دستیِ خام.
// =========================================================================
const FORM = (0, registry_1.findFormPrefix)("cheque-book-leaves");
const INCLUDE = { bankAccount: { include: { accountType: true, bankBranch: true } } };
async function assertChequeBookAccount(bankAccountId) {
    const account = await prisma_1.prisma.bankAccount.findUnique({ where: { id: bankAccountId }, include: { accountType: true } });
    if (!account)
        throw new Error("حساب بانکی یافت نشد");
    if (!account.accountType.hasChequeBook)
        throw new Error("برای این حساب بانکی، «دارای دسته چک» فعال نیست");
    return account;
}
const router = (0, express_1.Router)();
router.get("/cheque-book-leaves", (0, guard_1.can)(`${FORM}.view`), async (_req, res) => {
    res.json(await prisma_1.prisma.chequeBookLeaf.findMany({ include: INCLUDE, orderBy: [{ bankAccountId: "asc" }, { id: "asc" }] }));
});
// برگه‌های «خام» یک حساب بانکی مشخص — برای انتخابگر ردیف «صدور چک تازه» در سند پرداخت
// (نگاه کنید به routes/payments.ts و frontend/src/pages/Payments.tsx)
router.get("/cheque-book-leaves/pickable", (0, guard_1.can)(`${FORM}.view`), async (req, res) => {
    const bankAccountId = req.query.bankAccountId ? Number(req.query.bankAccountId) : undefined;
    res.json(await prisma_1.prisma.chequeBookLeaf.findMany({
        where: { status: "RAW", ...(bankAccountId ? { bankAccountId } : {}) },
        orderBy: { number: "asc" },
    }));
});
router.post("/cheque-book-leaves", (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
    const body = req.body;
    if (!body.bankAccountId)
        return res.status(400).json({ error: "حساب بانکی الزامی است" });
    if (!body.series)
        return res.status(400).json({ error: "سری الزامی است" });
    if (!body.number)
        return res.status(400).json({ error: "شماره الزامی است" });
    try {
        await assertChequeBookAccount(body.bankAccountId);
        const dup = await prisma_1.prisma.chequeBookLeaf.findUnique({ where: { bankAccountId_number: { bankAccountId: body.bankAccountId, number: body.number } } });
        if (dup)
            return res.status(400).json({ error: "شماره چک تکراری است" });
        const created = await prisma_1.prisma.chequeBookLeaf.create({
            data: { bankAccountId: body.bankAccountId, series: body.series, number: body.number, printTemplate: body.printTemplate || null },
            include: INCLUDE,
        });
        res.status(201).json(created);
    }
    catch (e) {
        if (e.code === "P2002")
            return res.status(400).json({ error: "شماره چک تکراری است" });
        res.status(400).json({ error: e.message || "خطا در ثبت برگه چک" });
    }
});
// ایجاد دسته چک (گردش جایگزین دوم سند): تعداد مشخصی برگه به‌صورت سریالی از یک شماره‌ی شروع می‌سازد.
// عملیات تماماً‌موفق یا تماماً‌ناموفق است — اگر حتی یک شماره در بازه از قبل برای همین حساب بانکی
// موجود باشد، کل درخواست رد می‌شود (کنترل ۴ سند: «هم از طریق ذخیره تکی و هم ایجاد دسته جمعی»).
router.post("/cheque-book-leaves/bulk", (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
    const body = req.body;
    if (!body.bankAccountId)
        return res.status(400).json({ error: "حساب بانکی الزامی است" });
    if (!body.series)
        return res.status(400).json({ error: "سری الزامی است" });
    if (!body.startNumber)
        return res.status(400).json({ error: "شماره شروع الزامی است" });
    const count = Number(body.count);
    if (!(Number.isInteger(count) && count > 0))
        return res.status(400).json({ error: "تعداد باید عددی صحیح و مثبت باشد" });
    if (count > 1000)
        return res.status(400).json({ error: "تعداد نباید بیشتر از ۱۰۰۰ باشد" });
    const startDigits = body.startNumber.trim();
    if (!/^\d+$/.test(startDigits))
        return res.status(400).json({ error: "شماره شروع باید فقط شامل رقم باشد" });
    const width = startDigits.length;
    const start = BigInt(startDigits);
    const numbers = Array.from({ length: count }, (_, i) => (start + BigInt(i)).toString().padStart(width, "0"));
    try {
        const account = await assertChequeBookAccount(body.bankAccountId);
        const existing = await prisma_1.prisma.chequeBookLeaf.findMany({
            where: { bankAccountId: account.id, number: { in: numbers } },
            select: { number: true },
        });
        if (existing.length > 0) {
            return res.status(400).json({ error: `شماره‌های تکراری برای این حساب بانکی: ${existing.map((e) => e.number).join("، ")}` });
        }
        const created = await prisma_1.prisma.chequeBookLeaf.createMany({
            data: numbers.map((number) => ({ bankAccountId: account.id, series: body.series, number })),
        });
        res.status(201).json({ count: created.count });
    }
    catch (e) {
        if (e.code === "P2002")
            return res.status(400).json({ error: "شماره چک تکراری است" });
        res.status(400).json({ error: e.message || "خطا در ایجاد دسته چک" });
    }
});
router.put("/cheque-book-leaves/:id", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body;
    const existing = await prisma_1.prisma.chequeBookLeaf.findUnique({ where: { id } });
    if (!existing)
        return res.status(404).json({ error: "برگه چک یافت نشد" });
    if (existing.status !== "RAW")
        return res.status(400).json({ error: "این برگه چک صادر یا باطل شده و قابل ویرایش نیست" });
    try {
        if (body.number && body.number !== existing.number) {
            const dup = await prisma_1.prisma.chequeBookLeaf.findUnique({ where: { bankAccountId_number: { bankAccountId: existing.bankAccountId, number: body.number } } });
            if (dup)
                return res.status(400).json({ error: "شماره چک تکراری است" });
        }
        const updated = await prisma_1.prisma.chequeBookLeaf.update({
            where: { id },
            data: { series: body.series, number: body.number, printTemplate: body.printTemplate === undefined ? undefined : body.printTemplate || null },
            include: INCLUDE,
        });
        res.json(updated);
    }
    catch (e) {
        if (e.code === "P2002")
            return res.status(400).json({ error: "شماره چک تکراری است" });
        res.status(400).json({ error: e.message || "خطا در ویرایش برگه چک" });
    }
});
router.post("/cheque-book-leaves/:id/void", (0, guard_1.can)(`${FORM}.void`), async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma_1.prisma.chequeBookLeaf.findUnique({ where: { id } });
    if (!existing)
        return res.status(404).json({ error: "برگه چک یافت نشد" });
    if (existing.status !== "RAW")
        return res.status(400).json({ error: "فقط برگه چکِ «خام» قابل ابطال است" });
    const updated = await prisma_1.prisma.chequeBookLeaf.update({ where: { id }, data: { status: "VOID" }, include: INCLUDE });
    res.json(updated);
});
router.delete("/cheque-book-leaves/:id", (0, guard_1.can)(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma_1.prisma.chequeBookLeaf.findUnique({ where: { id } });
    if (!existing)
        return res.status(404).json({ error: "برگه چک یافت نشد" });
    if (existing.status !== "RAW")
        return res.status(400).json({ error: "این برگه چک صادر یا باطل شده و قابل حذف نیست" });
    try {
        await prisma_1.prisma.chequeBookLeaf.delete({ where: { id } });
        res.status(204).send();
    }
    catch (e) {
        if (e.code === "P2003")
            return res.status(400).json({ error: "این برگه چک استفاده شده و قابل حذف نیست" });
        res.status(400).json({ error: e.message || "خطا در حذف برگه چک" });
    }
});
exports.default = router;
