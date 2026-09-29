"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const importJobService_1 = require("../services/importJobService");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
// ورود اکسل مستقیماً تابع ایجاد/به‌روزرسانی همان موجودیت را صدا می‌زند (نه route محافظت‌شده‌ی خودش)،
// پس can() روی router.post آن route اصلاً از این مسیر رد نمی‌شود — یعنی بدون این نگاشت، ورود اکسل
// یک دور زدن (bypass) کامل احراز دسترسی برای همه‌ی انواع سند/موجودیت بود. هر entityType این‌جا به
// همان Form ثبت‌شده در Registry و همان عملیات پایه‌ای که معادلش را نمایندگی می‌کند نگاشت می‌شود.
const ENTITY_TYPE_TO_ACTION = {
    party: `${(0, registry_1.findFormPrefix)("parties")}.create`,
    "cash-box": `${(0, registry_1.findFormPrefix)("cash-boxes")}.create`,
    "bank-branch": `${(0, registry_1.findFormPrefix)("bank-branches")}.create`,
    "bank-account": `${(0, registry_1.findFormPrefix)("bank-accounts")}.create`,
    "org-unit": `${(0, registry_1.findFormPrefix)("org-units")}.create`,
    "cost-center": `${(0, registry_1.findFormPrefix)("cost-centers")}.create`,
    "accounting-group": `${(0, registry_1.findFormPrefix)("accounting-groups")}.create`,
    "unit-of-measure": `${(0, registry_1.findFormPrefix)("units-of-measure")}.create`,
    warehouse: `${(0, registry_1.findFormPrefix)("warehouses")}.create`,
    currency: `${(0, registry_1.findFormPrefix)("currencies")}.create`,
    account: `${(0, registry_1.findFormPrefix)("accounts")}.create`,
    "goods-item": `${(0, registry_1.findFormPrefix)("goods-items")}.create`,
    "journal-entry": `${(0, registry_1.findFormPrefix)("journal-entries")}.create`,
    "initial-inventory": `${(0, registry_1.findFormPrefix)("warehousing-initial-inventory")}.create`,
    // فقط فی/مبلغ اسناد از‌قبل ایجادشده را وارد می‌کند — از نظر Registry یک «ویرایش» است، نه ایجاد سند تازه.
    "initial-inventory-cost": `${(0, registry_1.findFormPrefix)("warehousing-initial-inventory")}.edit`,
    "production-receipt": `${(0, registry_1.findFormPrefix)("production-receipts")}.create`,
    "warehouse-receipt": `${(0, registry_1.findFormPrefix)("warehousing-warehouse-receipts")}.create`,
    "production-consumption": `${(0, registry_1.findFormPrefix)("production-consumptions")}.create`,
    "sales-delivery": `${(0, registry_1.findFormPrefix)("sales-deliveries")}.create`,
    "center-consumption": `${(0, registry_1.findFormPrefix)("center-consumptions")}.create`,
    "warehouse-adjustment": `${(0, registry_1.findFormPrefix)("warehousing-warehouse-adjustments")}.create`,
    "inventory-counting-shortage": `${(0, registry_1.findFormPrefix)("inventory-counting-shortages")}.create`,
};
const router = (0, express_1.Router)();
router.post("/", async (req, res) => {
    const { entityType, rows, allowDuplicates } = req.body;
    if (!entityType || !(0, importJobService_1.isImportEntityRegistered)(entityType)) {
        return res.status(400).json({ error: `نوع ورودی «${entityType}» پشتیبانی نمی‌شود` });
    }
    const requiredAction = ENTITY_TYPE_TO_ACTION[entityType];
    if (!requiredAction) {
        throw new Error(`خطای معماری: نوع ورودی «${entityType}» در ENTITY_TYPE_TO_ACTION (importJobs.ts) نگاشت نشده است`);
    }
    if (!(await (0, guard_1.userHasAction)(req.user.id, requiredAction))) {
        return res.status(403).json({ error: "دسترسی لازم برای این عملیات را ندارید" });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: "هیچ ردیفی برای ورود اطلاعات ارسال نشده است" });
    }
    try {
        const jobId = await (0, importJobService_1.startImportJob)(entityType, rows, !!allowDuplicates);
        res.status(201).json({ jobId });
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در شروع پردازش" });
    }
});
router.get("/:id", async (req, res) => {
    const id = Number(req.params.id);
    const job = await prisma_1.prisma.importJob.findUnique({ where: { id } });
    if (!job)
        return res.status(404).json({ error: "یافت نشد" });
    res.json({
        id: job.id,
        status: job.status,
        totalRows: job.totalRows,
        processedRows: job.processedRows,
        successCount: job.successCount,
        errorCount: job.errorCount,
        resultData: job.status === "DONE" ? job.resultData : undefined,
    });
});
exports.default = router;
