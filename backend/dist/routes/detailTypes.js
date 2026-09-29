"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const detailValues_1 = require("../utils/detailValues");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
const FORM = (0, registry_1.findFormPrefix)("detail-types");
const router = (0, express_1.Router)();
router.get("/", async (_req, res) => {
    const types = await prisma_1.prisma.detailType.findMany({ orderBy: { code: "asc" } });
    res.json(types);
});
router.get("/:id/options", async (req, res) => {
    const options = await (0, detailValues_1.getDetailOptions)(Number(req.params.id));
    res.json(options);
});
// پاکسازی یک‌باره‌ی رکوردهای یتیم DetailCodeUsage (باقی‌مانده از موجودیت‌هایی که قبل از افزودن پاکسازی خودکار حذف شده بودند)
async function cleanupOrphans(_req, res) {
    const usages = await prisma_1.prisma.detailCodeUsage.findMany();
    let removed = 0;
    for (const u of usages) {
        let exists = false;
        switch (u.entityTable) {
            case "Party":
                exists = !!(await prisma_1.prisma.party.findUnique({ where: { id: u.entityId } }));
                break;
            case "CashBox":
                exists = !!(await prisma_1.prisma.cashBox.findUnique({ where: { id: u.entityId } }));
                break;
            case "BankAccount":
                exists = !!(await prisma_1.prisma.bankAccount.findUnique({ where: { id: u.entityId } }));
                break;
            case "CostCenter":
                exists = !!(await prisma_1.prisma.costCenter.findUnique({ where: { id: u.entityId } }));
                break;
            case "Project":
                exists = !!(await prisma_1.prisma.project.findUnique({ where: { id: u.entityId } }));
                break;
            case "FiscalPeriod":
                exists = !!(await prisma_1.prisma.fiscalPeriod.findUnique({ where: { id: u.entityId } }));
                break;
            default:
                exists = true; // نوع ناشناخته را دست‌نخورده باقی می‌گذاریم
        }
        if (!exists) {
            await prisma_1.prisma.detailCodeUsage.delete({ where: { id: u.id } });
            removed++;
        }
    }
    res.json({ removed, total: usages.length });
}
// هم GET (برای اجرا با باز کردن لینک در مرورگر) و هم POST پشتیبانی می‌شود
router.get("/cleanup-orphans", (0, guard_1.can)(`${FORM}.cleanupOrphans`), cleanupOrphans);
router.post("/cleanup-orphans", (0, guard_1.can)(`${FORM}.cleanupOrphans`), cleanupOrphans);
// طول کد، شماره شروع، شماره پایان قابل ویرایش‌اند؛ کد و عنوان قابل ویرایش نیستند.
// اگر از این نوع تفصیل رکوردی صادر شده باشد، شماره شروع و طول کد دیگر قابل تغییر نیست.
router.put("/:id", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const { codeLength, startNumber, endNumber } = req.body;
    const type = await prisma_1.prisma.detailType.findUnique({ where: { id } });
    if (!type)
        return res.status(404).json({ error: "نوع تفصیل یافت نشد" });
    const usageCount = await prisma_1.prisma.detailCodeUsage.count({ where: { detailTypeId: id } });
    if (usageCount > 0 && (codeLength !== undefined || startNumber !== undefined)) {
        return res.status(400).json({
            error: "با ثبت اولین تفصیل از این نوع، طول کد و شماره شروع دیگر قابل تغییر نیستند",
        });
    }
    if (codeLength !== undefined && codeLength > 15) {
        return res.status(400).json({ error: "طول کد حداکثر می‌تواند ۱۵ باشد" });
    }
    const maxAllowed = codeLength ? Math.pow(10, codeLength) - 1 : Math.pow(10, type.codeLength) - 1;
    if (startNumber !== undefined && startNumber > maxAllowed) {
        return res.status(400).json({ error: `شماره شروع نمی‌تواند بیشتر از ${maxAllowed} باشد` });
    }
    if (endNumber !== undefined && endNumber > maxAllowed) {
        return res.status(400).json({ error: `شماره پایان نمی‌تواند بیشتر از ${maxAllowed} باشد` });
    }
    const updated = await prisma_1.prisma.detailType.update({
        where: { id },
        data: { codeLength, startNumber, endNumber },
    });
    res.json(updated);
});
exports.default = router;
