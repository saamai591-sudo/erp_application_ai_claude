"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const coding_1 = require("../utils/coding");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
const ACCOUNTING_GROUPS = (0, registry_1.findFormPrefix)("accounting-groups");
const GOODS_SERVICE_ACCOUNTING = (0, registry_1.findFormPrefix)("goods-service-accounting");
const router = (0, express_1.Router)();
// =========================================================================
// گروه حسابداری
// =========================================================================
router.get("/accounting-groups", async (_req, res) => {
    res.json(await prisma_1.prisma.accountingGroup.findMany({ orderBy: { code: "asc" } }));
});
router.post("/accounting-groups", (0, guard_1.can)(`${ACCOUNTING_GROUPS}.create`), async (req, res) => {
    const body = req.body;
    if (!body.title || !body.goodsType)
        return res.status(400).json({ error: "عنوان و نوع کالا الزامی است" });
    try {
        const dup = await prisma_1.prisma.accountingGroup.findUnique({ where: { title: body.title } });
        if (dup)
            return res.status(400).json({ error: "عنوان تکراری است" });
        const finalCode = body.code ?? (await (0, coding_1.nextSerialNumber)(prisma_1.prisma.accountingGroup, "code"));
        const created = await prisma_1.prisma.accountingGroup.create({
            data: { code: finalCode, title: body.title, goodsType: body.goodsType, isActive: body.isActive ?? true },
        });
        res.status(201).json(created);
    }
    catch (e) {
        if (e.code === "P2002")
            return res.status(400).json({ error: "کد یا عنوان تکراری است" });
        res.status(400).json({ error: e.message || "خطا در ثبت گروه حسابداری" });
    }
});
router.put("/accounting-groups/:id", (0, guard_1.can)(`${ACCOUNTING_GROUPS}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body;
    if (body.title) {
        const dup = await prisma_1.prisma.accountingGroup.findFirst({ where: { title: body.title, NOT: { id } } });
        if (dup)
            return res.status(400).json({ error: "عنوان تکراری است" });
    }
    try {
        const updated = await prisma_1.prisma.accountingGroup.update({
            where: { id },
            data: { title: body.title, goodsType: body.goodsType, isActive: body.isActive },
        });
        res.json(updated);
    }
    catch (e) {
        if (e.code === "P2002")
            return res.status(400).json({ error: "عنوان تکراری است" });
        res.status(400).json({ error: e.message || "خطا در ویرایش گروه حسابداری" });
    }
});
router.delete("/accounting-groups/:id", (0, guard_1.can)(`${ACCOUNTING_GROUPS}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const group = await prisma_1.prisma.accountingGroup.findUnique({ where: { id } });
    if (!group)
        return res.status(404).json({ error: "گروه حسابداری یافت نشد" });
    if (group.hasTransactions)
        return res.status(400).json({ error: "این گروه حسابداری گردش دارد و قابل حذف نیست" });
    const inUse = await prisma_1.prisma.goodsServiceAccountingSetting.findFirst({ where: { accountingGroupId: id } });
    if (inUse)
        return res.status(400).json({ error: "این گروه حسابداری در تنظیمات حسابداری کالا و خدمت استفاده شده و قابل حذف نیست" });
    await prisma_1.prisma.accountingGroup.delete({ where: { id } });
    res.status(204).send();
});
// =========================================================================
// حسابداری کالا و خدمت
// =========================================================================
// انواع حسابی که «گروه انبار» را الزامی می‌کنند
const INVENTORY_TYPES = new Set(["INVENTORY"]);
// طبق تصمیم صریح کاربر: این دو نوع حساب دیگر بر اساس «گروه حسابداری» تفکیک نمی‌شوند — فقط بر اساس نوع
// فروش/نوع خرید. «گروه حسابداری» برایشان کاملاً حذف شده (نه فقط اختیاری) — همیشه null ذخیره می‌شود،
// حتی اگر کلاینت مقداری برایش بفرستد؛ در عوض نوع فروش/نوع خرید برایشان الزامی است.
const GROUPLESS_TYPES = new Set(["SALES_RECEIVABLE", "PURCHASE_PAYABLE"]);
// انواع سند انبار مجاز برای هر نوع حساب — دقیقاً هم‌راستا با warehouseMovementService.OUTBOUND_DOC_TYPES:
// «بستانکار رسید انبار» یعنی اسناد واردکننده (رسید)، «بدهکار حواله انبار» یعنی اسناد صادرکننده (حواله)
const WAREHOUSE_RECEIPT_DOC_TYPES = new Set([
    "INITIAL_INVENTORY",
    "WAREHOUSE_RECEIPT",
    "WAREHOUSE_TRANSFER_IN",
    "WAREHOUSE_ADJUSTMENT",
    "SALES_RETURN",
    "PRODUCTION_RECEIPT",
    "CENTER_CONSUMPTION_RETURN",
    "PROJECT_CONSUMPTION_RETURN",
    "PRODUCTION_CONSUMPTION_RETURN",
]);
const WAREHOUSE_ISSUE_DOC_TYPES = new Set([
    "SALES_DELIVERY",
    "CENTER_CONSUMPTION",
    "PROJECT_CONSUMPTION",
    "PRODUCTION_CONSUMPTION",
    "SUPPLIER_RETURN",
    "FIXED_ASSET_ISSUE",
    "WAREHOUSE_TRANSFER_OUT",
    "INVENTORY_COUNTING_SHORTAGE",
]);
function validWarehouseDocType(accountType, warehouseDocType) {
    if (!warehouseDocType)
        return true;
    if (accountType === "WAREHOUSE_RECEIPT_CREDIT")
        return WAREHOUSE_RECEIPT_DOC_TYPES.has(warehouseDocType);
    if (accountType === "WAREHOUSE_ISSUE_DEBIT")
        return WAREHOUSE_ISSUE_DOC_TYPES.has(warehouseDocType);
    return false;
}
// جلوگیری از رکورد تکراری: هر ترکیب (نوع حساب، گروه حسابداری، گروه انبار، نوع فروش، نوع سند انبار، نوع خرید) فقط یک معین می‌تواند داشته باشد
// (مثلاً «حساب دریافتنی فروش» + نوع فروش «فروش» دو بار تعریف نمی‌شود). مقدارهای خالی (null) با هم برابر حساب می‌شوند.
async function assertNoDuplicateSetting(key, excludeId) {
    const dup = await prisma_1.prisma.goodsServiceAccountingSetting.findFirst({
        where: {
            accountType: key.accountType,
            accountingGroupId: key.accountingGroupId,
            warehouseGroupId: key.warehouseGroupId,
            salesTypeId: key.salesTypeId,
            warehouseDocType: key.warehouseDocType,
            purchaseTypeId: key.purchaseTypeId,
            ...(excludeId ? { NOT: { id: excludeId } } : {}),
        },
    });
    if (dup)
        throw new Error("این تنظیم تکراری است: برای همین ترکیب (نوع حساب / گروه حسابداری / گروه انبار / نوع فروش / نوع خرید / نوع سند) قبلاً یک معین تعریف شده است");
}
router.get("/goods-service-accounting", async (_req, res) => {
    res.json(await prisma_1.prisma.goodsServiceAccountingSetting.findMany({
        include: {
            accountingGroup: true,
            warehouseGroup: true,
            purchaseType: true,
            salesType: true,
            account: { include: { level: true } },
        },
        orderBy: { id: "asc" },
    }));
});
router.post("/goods-service-accounting", (0, guard_1.can)(`${GOODS_SERVICE_ACCOUNTING}.create`), async (req, res) => {
    const body = req.body;
    if (!body.accountType || !body.accountId) {
        return res.status(400).json({ error: "نوع حساب و معین الزامی است" });
    }
    const groupless = GROUPLESS_TYPES.has(body.accountType);
    if (!groupless && !body.accountingGroupId) {
        return res.status(400).json({ error: "گروه حسابداری الزامی است" });
    }
    if (body.accountType === "SALES_RECEIVABLE" && !body.salesTypeId) {
        return res.status(400).json({ error: "نوع فروش الزامی است" });
    }
    if (body.accountType === "PURCHASE_PAYABLE" && !body.purchaseTypeId) {
        return res.status(400).json({ error: "نوع خرید الزامی است" });
    }
    if (INVENTORY_TYPES.has(body.accountType) && !body.warehouseGroupId) {
        return res.status(400).json({ error: "برای این نوع حساب، گروه انبار الزامی است" });
    }
    if (!validWarehouseDocType(body.accountType, body.warehouseDocType)) {
        return res.status(400).json({ error: "نوع سند انبار انتخاب‌شده با نوع حساب سازگار نیست" });
    }
    try {
        if (!groupless) {
            // طبق بررسی الزامی‌بودن بالا، اینجا body.accountingGroupId قطعاً مقداردهی شده است.
            const group = await prisma_1.prisma.accountingGroup.findUnique({ where: { id: body.accountingGroupId } });
            if (!group)
                return res.status(404).json({ error: "گروه حسابداری یافت نشد" });
        }
        const account = await prisma_1.prisma.account.findUnique({ where: { id: body.accountId }, include: { level: true } });
        if (!account || account.level.title !== "معین") {
            return res.status(400).json({ error: "حساب انتخاب‌شده باید در سطح «معین» باشد" });
        }
        await assertNoDuplicateSetting({
            accountType: body.accountType,
            accountingGroupId: groupless ? null : body.accountingGroupId ?? null,
            warehouseGroupId: body.warehouseGroupId || null,
            salesTypeId: body.salesTypeId || null,
            warehouseDocType: body.warehouseDocType || null,
            purchaseTypeId: body.purchaseTypeId || null,
        });
        const created = await prisma_1.prisma.goodsServiceAccountingSetting.create({
            data: {
                accountingGroupId: groupless ? null : body.accountingGroupId,
                accountType: body.accountType,
                warehouseGroupId: body.warehouseGroupId || null,
                accountId: body.accountId,
                salesTypeId: body.salesTypeId || null,
                warehouseDocType: (body.warehouseDocType || null),
                purchaseTypeId: body.purchaseTypeId || null,
            },
            include: { accountingGroup: true, warehouseGroup: true, purchaseType: true, salesType: true, account: { include: { level: true } } },
        });
        res.status(201).json(created);
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در ثبت حسابداری کالا و خدمت" });
    }
});
router.put("/goods-service-accounting/:id", (0, guard_1.can)(`${GOODS_SERVICE_ACCOUNTING}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body;
    const setting = await prisma_1.prisma.goodsServiceAccountingSetting.findUnique({ where: { id } });
    if (!setting)
        return res.status(404).json({ error: "رکورد یافت نشد" });
    if (setting.hasTransactions) {
        return res.status(400).json({ error: "این تنظیم برای اسناد صادرشده استفاده شده و قابل ویرایش نیست" });
    }
    const accountType = body.accountType ?? setting.accountType;
    const groupless = GROUPLESS_TYPES.has(accountType);
    if (!groupless && !(body.accountingGroupId ?? setting.accountingGroupId)) {
        return res.status(400).json({ error: "گروه حسابداری الزامی است" });
    }
    if (accountType === "SALES_RECEIVABLE" && !(body.salesTypeId ?? setting.salesTypeId)) {
        return res.status(400).json({ error: "نوع فروش الزامی است" });
    }
    if (accountType === "PURCHASE_PAYABLE" && !(body.purchaseTypeId ?? setting.purchaseTypeId)) {
        return res.status(400).json({ error: "نوع خرید الزامی است" });
    }
    if (INVENTORY_TYPES.has(accountType) && !(body.warehouseGroupId ?? setting.warehouseGroupId)) {
        return res.status(400).json({ error: "برای این نوع حساب، گروه انبار الزامی است" });
    }
    if (body.warehouseDocType !== undefined && !validWarehouseDocType(accountType, body.warehouseDocType)) {
        return res.status(400).json({ error: "نوع سند انبار انتخاب‌شده با نوع حساب سازگار نیست" });
    }
    if (body.accountId) {
        const account = await prisma_1.prisma.account.findUnique({ where: { id: body.accountId }, include: { level: true } });
        if (!account || account.level.title !== "معین") {
            return res.status(400).json({ error: "حساب انتخاب‌شده باید در سطح «معین» باشد" });
        }
    }
    try {
        // مقدار نهایی هر فیلد بعد از این ویرایش (فیلدی که در بدنه نیامده، همان مقدار فعلی رکورد است)
        await assertNoDuplicateSetting({
            accountType,
            accountingGroupId: groupless ? null : body.accountingGroupId ?? setting.accountingGroupId,
            warehouseGroupId: body.warehouseGroupId === undefined ? setting.warehouseGroupId : body.warehouseGroupId || null,
            salesTypeId: body.salesTypeId === undefined ? setting.salesTypeId : body.salesTypeId || null,
            warehouseDocType: body.warehouseDocType === undefined ? setting.warehouseDocType : body.warehouseDocType || null,
            purchaseTypeId: body.purchaseTypeId === undefined ? setting.purchaseTypeId : body.purchaseTypeId || null,
        }, id);
        const updated = await prisma_1.prisma.goodsServiceAccountingSetting.update({
            where: { id },
            data: {
                accountingGroupId: groupless ? null : body.accountingGroupId,
                accountType: body.accountType,
                warehouseGroupId: body.warehouseGroupId === undefined ? undefined : body.warehouseGroupId || null,
                accountId: body.accountId,
                salesTypeId: body.salesTypeId === undefined ? undefined : body.salesTypeId || null,
                warehouseDocType: body.warehouseDocType === undefined ? undefined : (body.warehouseDocType || null),
                purchaseTypeId: body.purchaseTypeId === undefined ? undefined : body.purchaseTypeId || null,
            },
            include: { accountingGroup: true, warehouseGroup: true, purchaseType: true, salesType: true, account: { include: { level: true } } },
        });
        res.json(updated);
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در ویرایش حسابداری کالا و خدمت" });
    }
});
router.delete("/goods-service-accounting/:id", (0, guard_1.can)(`${GOODS_SERVICE_ACCOUNTING}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const setting = await prisma_1.prisma.goodsServiceAccountingSetting.findUnique({ where: { id } });
    if (!setting)
        return res.status(404).json({ error: "رکورد یافت نشد" });
    if (setting.hasTransactions) {
        return res.status(400).json({ error: "این تنظیم برای اسناد صادرشده استفاده شده و قابل حذف نیست" });
    }
    await prisma_1.prisma.goodsServiceAccountingSetting.delete({ where: { id } });
    res.status(204).send();
});
exports.default = router;
