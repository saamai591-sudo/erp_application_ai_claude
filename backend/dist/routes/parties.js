"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const coding_1 = require("../utils/coding");
const concurrency_1 = require("../utils/concurrency");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
const DETAIL_TYPE_PARTY = 1;
const FORM = (0, registry_1.findFormPrefix)("parties");
const router = (0, express_1.Router)();
router.get("/", async (req, res) => {
    const { category, customersOnly, suppliersOnly } = req.query;
    const parties = await prisma_1.prisma.party.findMany({
        where: {
            ...(category ? { category } : {}),
            // برای پیکرهایی مثل «طرف مقابل» حواله فروش که فقط طرف‌حساب‌های ثبت‌شده به‌عنوان «مشتری» باید
            // قابل انتخاب باشند — دقیقاً هم‌الگوی رابطه‌ی یک‌به‌یک Party↔Customer
            ...(customersOnly === "true" ? { customer: { isNot: null } } : {}),
            // همان الگو برای «طرف مقابل» فاکتور خرید — فقط طرف‌حساب‌های ثبت‌شده به‌عنوان «تامین‌کننده»
            ...(suppliersOnly === "true" ? { supplier: { isNot: null } } : {}),
        },
        include: { addresses: true, phones: true, bankAccounts: true },
        orderBy: { detailCode: "asc" },
    });
    res.json(parties);
});
router.get("/:id", async (req, res) => {
    const party = await prisma_1.prisma.party.findUnique({
        where: { id: Number(req.params.id) },
        include: { addresses: { include: { city: true } }, phones: true, bankAccounts: true },
    });
    if (!party)
        return res.status(404).json({ error: "طرف‌حساب یافت نشد" });
    res.json(party);
});
router.post("/", (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
    const body = req.body;
    if (body.category === "INDIVIDUAL") {
        if (!body.firstName || !body.lastName) {
            return res.status(400).json({ error: "نام و نام خانوادگی الزامی است" });
        }
    }
    else if (body.category === "LEGAL") {
        if (!body.name)
            return res.status(400).json({ error: "نام شخص حقوقی الزامی است" });
    }
    else {
        return res.status(400).json({ error: "نوع طرف‌حساب نامعتبر است" });
    }
    // کنترل نام تکراری (هشدار غیر بازدارنده)
    if (!body.confirmDuplicate) {
        const dup = body.category === "INDIVIDUAL"
            ? await prisma_1.prisma.party.findFirst({ where: { firstName: body.firstName, lastName: body.lastName } })
            : await prisma_1.prisma.party.findFirst({ where: { name: body.name } });
        if (dup) {
            return res.status(409).json({
                warning: true,
                error: "قبلا طرف‌حساب دیگری با همین عنوان تعریف شده است. آیا ادامه می‌دهید؟",
            });
        }
    }
    // کنترل تکراری بودن کد ملی / شناسه ملی / کد اقتصادی / شناسه فراگیر (هشدار غیر بازدارنده)
    if (!body.confirmDuplicate) {
        const orConds = [];
        if (body.nationalId)
            orConds.push({ nationalId: body.nationalId });
        if (body.foreignId)
            orConds.push({ foreignId: body.foreignId });
        if (body.economicCode)
            orConds.push({ economicCode: body.economicCode });
        if (orConds.length) {
            const dup = await prisma_1.prisma.party.findFirst({ where: { OR: orConds } });
            if (dup) {
                return res.status(409).json({
                    warning: true,
                    error: "قبلا طرف‌حساب دیگری با همین کد ملی/شناسه ملی/کد اقتصادی تعریف شده است. آیا ادامه می‌دهید؟",
                });
            }
        }
    }
    let code, detailTypeId;
    try {
        ({ code, detailTypeId } = await (0, coding_1.resolveDetailCode)(DETAIL_TYPE_PARTY, body.detailCode));
        const party = await prisma_1.prisma.party.create({
            data: {
                detailCode: code,
                category: body.category,
                nationality: body.nationality ?? "LOCAL",
                nationalId: body.nationality === "FOREIGN" ? null : body.nationalId,
                foreignId: body.nationality === "FOREIGN" ? body.foreignId : null,
                economicCode: body.economicCode || null,
                firstName: body.category === "INDIVIDUAL" ? body.firstName : null,
                lastName: body.category === "INDIVIDUAL" ? body.lastName : null,
                legalType: body.category === "LEGAL" ? body.legalType : null,
                name: body.category === "LEGAL" ? body.name : null,
                isActive: body.isActive ?? true,
            },
        });
        await (0, coding_1.registerDetailCode)(code, detailTypeId, "Party", party.id);
        res.status(201).json(party);
    }
    catch (e) {
        if (e.code === "P2002") {
            return res.status(400).json({ error: "یکی از فیلدهای یکتا (کد ملی/شناسه ملی/کد اقتصادی/کد تفصیل) تکراری است" });
        }
        res.status(400).json({ error: e.message || "خطا در ثبت طرف‌حساب" });
    }
});
router.delete("/:id", (0, guard_1.can)(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const party = await prisma_1.prisma.party.findUnique({ where: { id } });
    if (!party)
        return res.status(404).json({ error: "طرف‌حساب یافت نشد" });
    if (party.hasTransactions) {
        return res.status(400).json({ error: "این طرف‌حساب گردش دارد و قابل حذف نیست" });
    }
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.detailCodeUsage.deleteMany({ where: { entityTable: "Party", entityId: id } }),
        prisma_1.prisma.party.delete({ where: { id } }),
    ]);
    res.status(204).send();
});
router.put("/:id", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body;
    const party = await prisma_1.prisma.party.findUnique({ where: { id } });
    if (!party)
        return res.status(404).json({ error: "طرف‌حساب یافت نشد" });
    try {
        (0, concurrency_1.assertRecordNotStale)(party.updatedAt, req.body.updatedAt, "این طرف‌حساب");
    }
    catch (e) {
        return res.status(400).json({ error: e.message });
    }
    const updated = await prisma_1.prisma.party.update({
        where: { id },
        data: {
            nationality: body.nationality,
            nationalId: body.nationality === "FOREIGN" ? null : body.nationalId,
            foreignId: body.nationality === "FOREIGN" ? body.foreignId : null,
            economicCode: body.economicCode,
            firstName: party.category === "INDIVIDUAL" ? body.firstName : undefined,
            lastName: party.category === "INDIVIDUAL" ? body.lastName : undefined,
            legalType: party.category === "LEGAL" ? body.legalType : undefined,
            name: party.category === "LEGAL" ? body.name : undefined,
            isActive: body.isActive,
        },
    });
    res.json(updated);
});
// --- تب نشانی ---
router.post("/:id/addresses", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const partyId = Number(req.params.id);
    const { type, cityId, address, postalCode, isPrimary } = req.body;
    if (isPrimary) {
        await prisma_1.prisma.partyAddress.updateMany({ where: { partyId }, data: { isPrimary: false } });
    }
    const created = await prisma_1.prisma.partyAddress.create({
        data: { partyId, type: type, cityId, address, postalCode, isPrimary: !!isPrimary },
    });
    res.status(201).json(created);
});
router.put("/:id/addresses/:addressId", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const partyId = Number(req.params.id);
    const addressId = Number(req.params.addressId);
    const { type, cityId, address, postalCode, isPrimary } = req.body;
    if (isPrimary) {
        await prisma_1.prisma.partyAddress.updateMany({ where: { partyId, NOT: { id: addressId } }, data: { isPrimary: false } });
    }
    const updated = await prisma_1.prisma.partyAddress.update({
        where: { id: addressId },
        data: { type: type, cityId, address, postalCode, isPrimary },
    });
    res.json(updated);
});
router.delete("/:id/addresses/:addressId", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    await prisma_1.prisma.partyAddress.delete({ where: { id: Number(req.params.addressId) } });
    res.status(204).send();
});
// --- تب تلفن ---
router.post("/:id/phones", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const partyId = Number(req.params.id);
    const { type, number, isPrimary } = req.body;
    if (isPrimary) {
        await prisma_1.prisma.partyPhone.updateMany({ where: { partyId }, data: { isPrimary: false } });
    }
    const created = await prisma_1.prisma.partyPhone.create({
        data: { partyId, type: type, number, isPrimary: !!isPrimary },
    });
    res.status(201).json(created);
});
router.put("/:id/phones/:phoneId", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const partyId = Number(req.params.id);
    const phoneId = Number(req.params.phoneId);
    const { type, number, isPrimary } = req.body;
    if (isPrimary) {
        await prisma_1.prisma.partyPhone.updateMany({ where: { partyId, NOT: { id: phoneId } }, data: { isPrimary: false } });
    }
    const updated = await prisma_1.prisma.partyPhone.update({
        where: { id: phoneId },
        data: { type: type, number, isPrimary },
    });
    res.json(updated);
});
router.delete("/:id/phones/:phoneId", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    await prisma_1.prisma.partyPhone.delete({ where: { id: Number(req.params.phoneId) } });
    res.status(204).send();
});
// --- تب حساب بانکی (اطلاعات بانکی طرف‌حساب، نه حساب بانکی داخلی شرکت) ---
router.post("/:id/bank-accounts", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const partyId = Number(req.params.id);
    const { bankPartyId, accountNumber, iban, cardNumber } = req.body;
    const created = await prisma_1.prisma.partyBankAccount.create({
        data: { partyId, bankPartyId, accountNumber, iban, cardNumber },
    });
    res.status(201).json(created);
});
router.put("/:id/bank-accounts/:bankAccountId", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const bankAccountId = Number(req.params.bankAccountId);
    const { bankPartyId, accountNumber, iban, cardNumber } = req.body;
    const updated = await prisma_1.prisma.partyBankAccount.update({
        where: { id: bankAccountId },
        data: { bankPartyId, accountNumber, iban, cardNumber },
    });
    res.json(updated);
});
router.delete("/:id/bank-accounts/:bankAccountId", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    await prisma_1.prisma.partyBankAccount.delete({ where: { id: Number(req.params.bankAccountId) } });
    res.status(204).send();
});
exports.default = router;
