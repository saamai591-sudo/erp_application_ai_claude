"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
const CURRENCIES = (0, registry_1.findFormPrefix)("currencies");
const RATES = (0, registry_1.findFormPrefix)("rates");
const router = (0, express_1.Router)();
router.get("/", async (_req, res) => {
    const currencies = await prisma_1.prisma.currency.findMany({ orderBy: { code: "asc" } });
    res.json(currencies);
});
router.post("/", (0, guard_1.can)(`${CURRENCIES}.create`), async (req, res) => {
    const { code, title, decimalPlaces, isBase, rateDirection, baseVolume } = req.body;
    if (!code || !title)
        return res.status(400).json({ error: "کد و عنوان الزامی است" });
    if (!isBase && !rateDirection) {
        return res.status(400).json({ error: "جهت تسعیر برای ارزهای غیر پایه الزامی است" });
    }
    try {
        if (isBase) {
            const existingBase = await prisma_1.prisma.currency.findFirst({ where: { isBase: true } });
            if (existingBase) {
                return res.status(400).json({ error: "یک ارز پایه در سیستم موجود است. فقط یک ارز پایه مجاز است" });
            }
        }
        const currency = await prisma_1.prisma.currency.create({
            data: {
                code,
                title,
                decimalPlaces: decimalPlaces ?? 2,
                isBase: !!isBase,
                rateDirection: isBase ? null : rateDirection,
                baseVolume: isBase ? 1 : baseVolume ?? 1,
            },
        });
        res.status(201).json(currency);
    }
    catch (e) {
        if (e.code === "P2002")
            return res.status(400).json({ error: "کد یا عنوان تکراری است" });
        res.status(400).json({ error: e.message || "خطا در ثبت ارز" });
    }
});
router.put("/:id", (0, guard_1.can)(`${CURRENCIES}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const currency = await prisma_1.prisma.currency.findUnique({ where: { id } });
    if (!currency)
        return res.status(404).json({ error: "ارز یافت نشد" });
    const { title, decimalPlaces, rateDirection, baseVolume } = req.body;
    if (currency.isBase && currency.hasTransactions) {
        return res.status(400).json({ error: "ارز پایه با گردش قابل ویرایش نیست" });
    }
    const updated = await prisma_1.prisma.currency.update({
        where: { id },
        data: {
            title,
            decimalPlaces,
            rateDirection: currency.isBase ? null : rateDirection,
            baseVolume: currency.isBase ? 1 : baseVolume,
        },
    });
    res.json(updated);
});
router.delete("/:id", (0, guard_1.can)(`${CURRENCIES}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const currency = await prisma_1.prisma.currency.findUnique({ where: { id } });
    if (!currency)
        return res.status(404).json({ error: "ارز یافت نشد" });
    if (currency.hasTransactions) {
        return res.status(400).json({ error: "این ارز گردش دارد و قابل حذف نیست" });
    }
    await prisma_1.prisma.currency.delete({ where: { id } });
    res.status(204).send();
});
// نرخ ارز
router.get("/rates", async (_req, res) => {
    const rates = await prisma_1.prisma.exchangeRate.findMany({
        include: { currency: true },
        orderBy: { date: "desc" },
    });
    res.json(rates);
});
router.post("/rates", (0, guard_1.can)(`${RATES}.create`), async (req, res) => {
    const { date, currencyId, rate } = req.body;
    if (!date || !currencyId || rate === undefined) {
        return res.status(400).json({ error: "تاریخ، ارز و نرخ الزامی است" });
    }
    if (rate <= 0)
        return res.status(400).json({ error: "نرخ ارز باید بزرگتر از صفر باشد" });
    const currency = await prisma_1.prisma.currency.findUnique({ where: { id: currencyId } });
    if (!currency)
        return res.status(404).json({ error: "ارز یافت نشد" });
    if (currency.isBase)
        return res.status(400).json({ error: "برای ارز پایه امکان ثبت نرخ نیست" });
    const created = await prisma_1.prisma.exchangeRate.upsert({
        where: { date_currencyId: { date: new Date(date), currencyId } },
        update: { rate },
        create: { date: new Date(date), currencyId, rate },
        include: { currency: true },
    });
    // پیام راهنمای معادل، طبق مستند نرخ ارز
    const base = await prisma_1.prisma.currency.findFirst({ where: { isBase: true } });
    let hint = "";
    if (base) {
        if (currency.rateDirection === "TO_BASE") {
            hint = `${currency.baseVolume} ${currency.title} معادل ${Number(rate).toLocaleString("fa-IR")} ${base.title}`;
        }
        else {
            hint = `هر ${Number(rate).toLocaleString("fa-IR")} ${base.title} معادل ${currency.baseVolume} ${currency.title}`;
        }
    }
    res.status(201).json({ ...created, hint });
});
router.delete("/rates/:id", (0, guard_1.can)(`${RATES}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const rate = await prisma_1.prisma.exchangeRate.findUnique({ where: { id } });
    if (!rate)
        return res.status(404).json({ error: "نرخ ارز یافت نشد" });
    await prisma_1.prisma.exchangeRate.delete({ where: { id } });
    res.status(204).send();
});
exports.default = router;
