"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const coding_1 = require("../utils/coding");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
const FORM = (0, registry_1.findFormPrefix)("payment-types");
// =========================================================================
// ماژول «خزانه‌داری» > تنظیمات > نوع پرداخت — هم‌الگوی «نوع دریافت» (Documents/ReceiptType.md) برای
// فرم پرداخت (اعلامیه پرداخت).
//
// دو فیلد کلیدی: nature («این پرداخت اساساً چه ماهیتی دارد» — به تامین‌کننده/پیش‌پرداخت/به مشتری/به
// سایر/ارزش‌افزوده خرید/ارزش‌افزوده فروش) و basisType («این پرداخت بر چه سندی مبتنی است»). مقادیر
// basisType مجاز به nature بستگی دارد — ALLOWED_BASIS_TYPES زیر تنها محل این قاعده است (فرانت‌اند در
// PaymentTypes.tsx نسخه‌ی هم‌راستای آن را دارد). مبناها هم‌الگوی «نوع دریافت»اند: پرداخت به تأمین‌کننده و
// ارزش‌افزوده خرید → فاکتور خرید؛ پیش‌پرداخت → سفارش خرید؛ پرداخت به مشتری (استرداد) و ارزش‌افزوده فروش →
// فاکتور فروش.
//
// accountId (معین حسابداری) فقط برای basisType=NONE معنا دارد: در آن حالت الزامی است؛ برای بقیه‌ی
// basisType ها سرور هرگز آن را ذخیره نمی‌کند (حتی اگر کلاینت مقداری بفرستد).
// =========================================================================
const ALLOWED_BASIS_TYPES = {
    SUPPLIER_PAYMENT: ["NONE", "PURCHASE_INVOICE"],
    ADVANCE_PAYMENT: ["NONE", "PURCHASE_ORDER"],
    CUSTOMER_PAYMENT: ["NONE", "SALES_INVOICE"],
    OTHER_PAYMENT: ["NONE"],
    PURCHASE_VAT: ["NONE", "PURCHASE_INVOICE"],
    SALES_VAT: ["NONE", "SALES_INVOICE"],
    TO_BANK: ["NONE"],
    TO_CASH_BOX: ["NONE"],
    TO_PETTY_CASH: ["NONE"],
};
// ماهیت‌هایی که معین حسابداری ندارند: در صدور سند، معین از «تعیین حسابهای معین» حساب بانکی/صندوق/تنخواهِ انتخاب‌شده در ردیف موضوعات پرداخت می‌آید
const ACCOUNTLESS_NATURES = ["TO_BANK", "TO_CASH_BOX", "TO_PETTY_CASH"];
const router = (0, express_1.Router)();
router.get("/payment-types", async (_req, res) => {
    res.json(await prisma_1.prisma.paymentType.findMany({
        include: { account: { include: { level: true } } },
        orderBy: { code: "asc" },
    }));
});
router.post("/payment-types", (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
    const body = req.body;
    if (!body.title)
        return res.status(400).json({ error: "عنوان الزامی است" });
    if (!body.nature)
        return res.status(400).json({ error: "ماهیت پرداخت الزامی است" });
    if (!body.basisType)
        return res.status(400).json({ error: "نوع مبنا الزامی است" });
    const allowed = ALLOWED_BASIS_TYPES[body.nature];
    if (!allowed)
        return res.status(400).json({ error: "ماهیت پرداخت نامعتبر است" });
    if (!allowed.includes(body.basisType)) {
        return res.status(400).json({ error: "نوع مبنای انتخاب‌شده با ماهیت پرداخت سازگار نیست" });
    }
    const isNoBasis = body.basisType === "NONE" && !ACCOUNTLESS_NATURES.includes(body.nature);
    if (isNoBasis && !body.accountId) {
        return res.status(400).json({ error: "برای «بدون مبنا»، انتخاب معین حسابداری الزامی است" });
    }
    try {
        const dup = await prisma_1.prisma.paymentType.findUnique({ where: { title: body.title } });
        if (dup)
            return res.status(400).json({ error: "عنوان تکراری است" });
        if (isNoBasis) {
            const account = await prisma_1.prisma.account.findUnique({ where: { id: body.accountId }, include: { level: true } });
            if (!account || account.level.title !== "معین") {
                return res.status(400).json({ error: "حساب انتخاب‌شده باید در سطح «معین» باشد" });
            }
        }
        const finalCode = body.code ?? (await (0, coding_1.nextSerialNumber)(prisma_1.prisma.paymentType, "code"));
        const created = await prisma_1.prisma.paymentType.create({
            data: {
                code: finalCode,
                title: body.title,
                nature: body.nature,
                basisType: body.basisType,
                accountId: isNoBasis ? body.accountId : null,
            },
            include: { account: { include: { level: true } } },
        });
        res.status(201).json(created);
    }
    catch (e) {
        if (e.code === "P2002")
            return res.status(400).json({ error: "کد یا عنوان تکراری است" });
        res.status(400).json({ error: e.message || "خطا در ثبت نوع پرداخت" });
    }
});
router.put("/payment-types/:id", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body;
    const existing = await prisma_1.prisma.paymentType.findUnique({ where: { id } });
    if (!existing)
        return res.status(404).json({ error: "نوع پرداخت یافت نشد" });
    if (existing.hasTransactions && (body.nature !== undefined || body.basisType !== undefined || body.accountId !== undefined)) {
        return res.status(400).json({ error: "این نوع پرداخت گردش دارد و ماهیت/مبنا/معین آن قابل ویرایش نیست" });
    }
    const nature = body.nature ?? existing.nature;
    const basisType = body.basisType ?? existing.basisType;
    if (body.title) {
        const dup = await prisma_1.prisma.paymentType.findFirst({ where: { title: body.title, NOT: { id } } });
        if (dup)
            return res.status(400).json({ error: "عنوان تکراری است" });
    }
    const allowed = ALLOWED_BASIS_TYPES[nature];
    if (!allowed)
        return res.status(400).json({ error: "ماهیت پرداخت نامعتبر است" });
    if (!allowed.includes(basisType)) {
        return res.status(400).json({ error: "نوع مبنای انتخاب‌شده با ماهیت پرداخت سازگار نیست" });
    }
    const isNoBasis = basisType === "NONE" && !ACCOUNTLESS_NATURES.includes(nature);
    const accountId = body.accountId !== undefined ? body.accountId : existing.accountId;
    if (isNoBasis && !accountId) {
        return res.status(400).json({ error: "برای «بدون مبنا»، انتخاب معین حسابداری الزامی است" });
    }
    try {
        if (isNoBasis && accountId) {
            const account = await prisma_1.prisma.account.findUnique({ where: { id: accountId }, include: { level: true } });
            if (!account || account.level.title !== "معین") {
                return res.status(400).json({ error: "حساب انتخاب‌شده باید در سطح «معین» باشد" });
            }
        }
        const updated = await prisma_1.prisma.paymentType.update({
            where: { id },
            data: {
                title: body.title,
                nature: body.nature,
                basisType: body.basisType,
                accountId: isNoBasis ? accountId : null,
                isActive: body.isActive,
            },
            include: { account: { include: { level: true } } },
        });
        res.json(updated);
    }
    catch (e) {
        if (e.code === "P2002")
            return res.status(400).json({ error: "عنوان تکراری است" });
        res.status(400).json({ error: e.message || "خطا در ویرایش نوع پرداخت" });
    }
});
router.delete("/payment-types/:id", (0, guard_1.can)(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma_1.prisma.paymentType.findUnique({ where: { id } });
    if (!existing)
        return res.status(404).json({ error: "نوع پرداخت یافت نشد" });
    if (existing.hasTransactions)
        return res.status(400).json({ error: "این نوع پرداخت گردش دارد و قابل حذف نیست" });
    try {
        await prisma_1.prisma.paymentType.delete({ where: { id } });
        res.status(204).send();
    }
    catch (e) {
        if (e.code === "P2003")
            return res.status(400).json({ error: "این نوع پرداخت در جایی استفاده شده و قابل حذف نیست" });
        res.status(400).json({ error: e.message || "خطا در حذف نوع پرداخت" });
    }
});
exports.default = router;
