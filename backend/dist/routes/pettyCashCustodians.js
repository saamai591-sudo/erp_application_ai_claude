"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const coding_1 = require("../utils/coding");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
// «تنخواه‌دار» (مدیریت خزانه › تنظیمات). کد تفصیلی فقط از سرویس عمومی «ایجاد کد تفصیلی» (utils/coding.ts: generateDetailCode +
// registerDetailCode، نوع تفصیل ۶ «تنخواه دار») صادر می‌شود و از ورودی کاربر پذیرفته نمی‌شود.
const DETAIL_TYPE_PETTY_CASH_CUSTODIAN = 6;
const FORM = (0, registry_1.findFormPrefix)("petty-cash-custodians");
const router = (0, express_1.Router)();
const INCLUDE = {
    pettyCash: { select: { id: true, detailCode: true, title: true, isActive: true, currency: { select: { id: true, title: true, isBase: true } } } },
    party: { select: { id: true, detailCode: true, category: true, firstName: true, lastName: true, name: true, isActive: true } },
};
router.get("/", async (req, res) => {
    res.json(await prisma_1.prisma.pettyCashCustodian.findMany({
        where: req.query.activeOnly === "true" ? { isActive: true } : undefined,
        include: INCLUDE,
        orderBy: { detailCode: "asc" },
    }));
});
/** تنخواه و طرف‌حساب باید موجود و فعال باشند؛ فقط در ویرایش، مقدار بدون تغییرِ غیرفعال (که قبلاً ثبت شده) مجاز می‌ماند */
async function validateRefs(pettyCashId, partyId, existing) {
    const pettyCash = await prisma_1.prisma.pettyCash.findUnique({ where: { id: pettyCashId } });
    if (!pettyCash)
        throw new Error("تنخواه نامعتبر است");
    if (!pettyCash.isActive && existing?.pettyCashId !== pettyCashId)
        throw new Error("تنخواه انتخاب‌شده غیرفعال است");
    const party = await prisma_1.prisma.party.findUnique({ where: { id: partyId } });
    if (!party)
        throw new Error("طرف‌حساب نامعتبر است");
    if (!party.isActive && existing?.partyId !== partyId)
        throw new Error("طرف‌حساب انتخاب‌شده غیرفعال است");
}
router.post("/", (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
    const body = req.body;
    if (!body.pettyCashId)
        return res.status(400).json({ error: "تنخواه الزامی است" });
    if (!body.partyId)
        return res.status(400).json({ error: "طرف‌حساب الزامی است" });
    try {
        await validateRefs(Number(body.pettyCashId), Number(body.partyId));
        const dup = await prisma_1.prisma.pettyCashCustodian.findFirst({ where: { pettyCashId: Number(body.pettyCashId), partyId: Number(body.partyId) } });
        if (dup)
            return res.status(400).json({ error: "این طرف‌حساب قبلاً برای همین تنخواه به‌عنوان تنخواه‌دار تعریف شده است" });
        const { code, detailTypeId } = await (0, coding_1.generateDetailCode)(DETAIL_TYPE_PETTY_CASH_CUSTODIAN);
        const created = await prisma_1.prisma.pettyCashCustodian.create({
            data: {
                detailCode: code,
                pettyCashId: Number(body.pettyCashId),
                partyId: Number(body.partyId),
                isActive: body.isActive ?? true,
                controlNegativeBalance: body.controlNegativeBalance ?? true,
            },
            include: INCLUDE,
        });
        try {
            await (0, coding_1.registerDetailCode)(code, detailTypeId, "PettyCashCustodian", created.id);
        }
        catch (e) {
            // ثبت در جدول مرکزی کدها شکست خورد (مثلاً هم‌زمانی): رکورد نیمه‌کاره نماند
            await prisma_1.prisma.pettyCashCustodian.delete({ where: { id: created.id } });
            throw e;
        }
        res.status(201).json(created);
    }
    catch (e) {
        if (e.code === "P2002")
            return res.status(400).json({ error: "کد یا ترکیب تنخواه و طرف‌حساب تکراری است" });
        res.status(400).json({ error: e.message || "خطا در ثبت تنخواه‌دار" });
    }
});
router.put("/:id", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body;
    const existing = await prisma_1.prisma.pettyCashCustodian.findUnique({ where: { id } });
    if (!existing)
        return res.status(404).json({ error: "تنخواه‌دار یافت نشد" });
    if (!body.pettyCashId)
        return res.status(400).json({ error: "تنخواه الزامی است" });
    if (!body.partyId)
        return res.status(400).json({ error: "طرف‌حساب الزامی است" });
    try {
        const pettyCashId = Number(body.pettyCashId);
        const partyId = Number(body.partyId);
        if (existing.hasTransactions && (existing.pettyCashId !== pettyCashId || existing.partyId !== partyId)) {
            return res.status(400).json({ error: "این تنخواه‌دار گردش دارد و تنخواه/طرف‌حساب آن قابل تغییر نیست" });
        }
        await validateRefs(pettyCashId, partyId, existing);
        const dup = await prisma_1.prisma.pettyCashCustodian.findFirst({ where: { pettyCashId, partyId, NOT: { id } } });
        if (dup)
            return res.status(400).json({ error: "این طرف‌حساب قبلاً برای همین تنخواه به‌عنوان تنخواه‌دار تعریف شده است" });
        // کد تفصیلی هرگز تغییر نمی‌کند (حتی اگر در بدنه‌ی درخواست باشد نادیده گرفته می‌شود)
        const updated = await prisma_1.prisma.pettyCashCustodian.update({
            where: { id },
            data: {
                pettyCashId,
                partyId,
                isActive: body.isActive ?? existing.isActive,
                controlNegativeBalance: body.controlNegativeBalance ?? existing.controlNegativeBalance,
            },
            include: INCLUDE,
        });
        res.json(updated);
    }
    catch (e) {
        if (e.code === "P2002")
            return res.status(400).json({ error: "ترکیب تنخواه و طرف‌حساب تکراری است" });
        res.status(400).json({ error: e.message || "خطا در ویرایش تنخواه‌دار" });
    }
});
router.delete("/:id", (0, guard_1.can)(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma_1.prisma.pettyCashCustodian.findUnique({ where: { id } });
    if (!existing)
        return res.status(404).json({ error: "تنخواه‌دار یافت نشد" });
    if (existing.hasTransactions)
        return res.status(400).json({ error: "این تنخواه‌دار گردش دارد و قابل حذف نیست" });
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.detailCodeUsage.deleteMany({ where: { entityTable: "PettyCashCustodian", entityId: id } }),
        prisma_1.prisma.pettyCashCustodian.delete({ where: { id } }),
    ]);
    res.status(204).send();
});
exports.default = router;
