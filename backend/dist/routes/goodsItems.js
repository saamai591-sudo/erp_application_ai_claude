"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KIND_FA = void 0;
exports.loadGroupChain = loadGroupChain;
exports.computePrefixes = computePrefixes;
exports.resolveSerial = resolveSerial;
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const warehouseDocNatureMatrix_1 = require("../data/warehouseDocNatureMatrix");
const concurrency_1 = require("../utils/concurrency");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
const FORM = (0, registry_1.findFormPrefix)("goods-items");
const router = (0, express_1.Router)();
exports.KIND_FA = { GOODS: "کالا", SERVICE: "خدمت" };
// =========================================================================
// موتور محاسبه‌ی پیشوند کد/عنوان — طبق مستندات «کالا» و «خدمت»:
// پیشوند کد = کد گروه‌های زنجیره (ریشه تا برگ) که «تاثیر در کد کالا» دارند + کد آیتم ویژگی‌هایی
//             که «تاثیر در کد کالا» دارند (به ترتیب اولویت سطح گروه، سپس اولویت ویژگی)
// پیشوند عنوان = عنوان گروه‌های زنجیره که «در عنوان کالا موثر هست» دارند + عنوان/مقدار ویژگی‌هایی
//               که «تاثیر در عنوان کالا» غیر از NONE دارند
// =========================================================================
async function loadGroupChain(goodsGroupId) {
    let current = await prisma_1.prisma.goodsGroup.findUnique({ where: { id: goodsGroupId }, include: { level: true } });
    if (!current)
        throw new Error("گروه یافت نشد");
    const leaf = current;
    if (!leaf.isLastBranch)
        throw new Error("فقط شاخه‌های آخر (برگ) گروه کالا قابل انتخاب است");
    if (!leaf.childCodeLength)
        throw new Error("طول کد کالاهای زیرمجموعه برای این گروه تعریف نشده است");
    const chain = [];
    while (current) {
        chain.unshift(current);
        if (!current.parentId)
            break;
        current = await prisma_1.prisma.goodsGroup.findUnique({ where: { id: current.parentId }, include: { level: true } });
    }
    return { chain, leaf };
}
async function computePrefixes(goodsGroupId, attrSelections) {
    const { chain, leaf } = await loadGroupChain(goodsGroupId);
    const codeParts = [];
    const titleParts = [];
    for (const g of chain) {
        if (g.level.affectsGoodsCode)
            codeParts.push(g.code);
        if (g.affectsGoodsTitle)
            titleParts.push(g.title);
    }
    const groupAttrs = await prisma_1.prisma.goodsGroupAttribute.findMany({
        where: { goodsGroupId: leaf.id },
        orderBy: { order: "asc" },
        include: { attribute: true },
    });
    const resolvedAttrs = [];
    for (const ga of groupAttrs) {
        const sel = attrSelections.find((s) => s.attributeId === ga.attributeId);
        if (!sel)
            throw new Error(`مقدار ویژگی «${ga.attribute.title}» الزامی است`);
        const item = await prisma_1.prisma.goodsAttributeItem.findUnique({ where: { id: sel.itemId } });
        if (!item || item.attributeId !== ga.attributeId)
            throw new Error(`مقدار ویژگی «${ga.attribute.title}» نامعتبر است`);
        resolvedAttrs.push({ attributeId: ga.attributeId, itemId: item.id });
        if (ga.affectsCode)
            codeParts.push(item.code);
        if (ga.titleEffect === "VALUE")
            titleParts.push(item.title);
        else if (ga.titleEffect === "VALUE_AND_TITLE")
            titleParts.push(`${ga.attribute.title}: ${item.title}`);
    }
    return { leaf, codePrefix: codeParts.join(""), titlePrefix: titleParts.join("، "), resolvedAttrs, groupAttrCount: groupAttrs.length };
}
async function resolveSerial(goodsGroupId, explicitCode, childCodeLength, excludeItemId) {
    if (explicitCode && explicitCode.trim()) {
        const trimmed = explicitCode.trim();
        if (trimmed.length > childCodeLength) {
            throw new Error("طول کد بیشتر از مقدار تعیین شده در گروه کالای مرتبط هست");
        }
        return trimmed.padStart(childCodeLength, "0");
    }
    const last = await prisma_1.prisma.goodsItem.findFirst({
        where: { goodsGroupId, ...(excludeItemId ? { NOT: { id: excludeItemId } } : {}) },
        orderBy: { code: "desc" },
    });
    const next = last ? parseInt(last.code, 10) + 1 : 1;
    return String(next).padStart(childCodeLength, "0");
}
// =========================================================================
// کالا / خدمت — هر دو از یک جدول (GoodsItem) با تفکیک kind
// =========================================================================
router.get("/goods-items", async (req, res) => {
    const kind = req.query.kind;
    const trackingMethod = req.query.trackingMethod;
    // فیلتر اختیاری بر اساس ماهیت/نوع سند انبار (طبق مستند «نوع کالا-ماهیت سند انبار»):
    // وقتی ماژول‌های آینده‌ی سند انبار (رسید انبار، حواله انبار، ...) بخواهند فقط کالاهای
    // مجاز برای بارگذاری در سندی با ماهیت/نوع مشخص را نشان دهند، از این دو کوئری‌پارامتر استفاده می‌کنند.
    const docDirection = req.query.docDirection; // "INBOUND" | "OUTBOUND"
    const docType = req.query.docType; // مثلاً "خرید"
    let allowedGoodsTypesFilter = undefined;
    if (docDirection && docType) {
        const allowed = (0, warehouseDocNatureMatrix_1.getAllowedGoodsTypes)(docDirection, docType);
        if (!allowed || allowed.length === 0)
            return res.json([]);
        allowedGoodsTypesFilter = { accountingGroup: { goodsType: { in: allowed } } };
    }
    const items = await prisma_1.prisma.goodsItem.findMany({
        where: {
            ...(kind ? { kind: kind } : {}),
            ...(trackingMethod ? { trackingMethod: trackingMethod } : {}),
            ...(allowedGoodsTypesFilter || {}),
        },
        include: {
            goodsGroup: true,
            mainUnit: true,
            weightUnit: true,
            accountingGroup: true,
            attributeValues: { include: { attribute: true, item: true } },
        },
        orderBy: { id: "desc" },
    });
    res.json(items);
});
router.get("/goods-items/:id", async (req, res) => {
    const id = Number(req.params.id);
    const item = await prisma_1.prisma.goodsItem.findUnique({
        where: { id },
        include: {
            goodsGroup: true,
            mainUnit: true,
            weightUnit: true,
            accountingGroup: true,
            attributeValues: { include: { attribute: true, item: true } },
        },
    });
    if (!item)
        return res.status(404).json({ error: "یافت نشد" });
    res.json(item);
});
router.post("/goods-items", (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
    const body = req.body;
    if (!body.kind || !["GOODS", "SERVICE"].includes(body.kind))
        return res.status(400).json({ error: "نوع نامعتبر است" });
    const label = exports.KIND_FA[body.kind];
    if (!body.goodsGroupId)
        return res.status(400).json({ error: `گروه ${label} الزامی است` });
    if (!body.title || !body.title.trim())
        return res.status(400).json({ error: "عنوان الزامی است" });
    if (!body.mainUnitId)
        return res.status(400).json({ error: "واحد اصلی الزامی است" });
    if (!body.accountingGroupId)
        return res.status(400).json({ error: "گروه حساب الزامی است" });
    try {
        const mainUnit = await prisma_1.prisma.unitOfMeasure.findUnique({ where: { id: body.mainUnitId } });
        if (!mainUnit)
            return res.status(400).json({ error: "واحد اصلی نامعتبر است" });
        let weightUnitId = null;
        let weightRatio = null;
        if (body.kind === "GOODS" && !mainUnit.isWeight && body.weightUnitId) {
            weightUnitId = body.weightUnitId;
            if (body.weightRatio === undefined || body.weightRatio === null) {
                return res.status(400).json({ error: "نسبت وزنی الزامی است" });
            }
            weightRatio = Number(body.weightRatio);
        }
        const isSpecial = !!body.isSpecial;
        let taxRate = null;
        if (isSpecial) {
            if (body.taxRate === undefined || body.taxRate === null)
                return res.status(400).json({ error: "نرخ مالیات الزامی است" });
            taxRate = Number(body.taxRate);
        }
        const reorderControl = body.kind === "GOODS" ? !!body.reorderControl : false;
        let reorderPoint = null;
        if (reorderControl) {
            if (body.reorderPoint === undefined || body.reorderPoint === null)
                return res.status(400).json({ error: "مقدار نقطه سفارش الزامی است" });
            reorderPoint = Number(body.reorderPoint);
        }
        const { leaf, codePrefix, titlePrefix, resolvedAttrs } = await computePrefixes(body.goodsGroupId, body.attributes ?? []);
        const serial = await resolveSerial(body.goodsGroupId, body.code, leaf.childCodeLength);
        const fullCode = codePrefix + serial;
        const rawTitle = body.title.trim();
        const fullTitle = titlePrefix ? `${titlePrefix}، ${rawTitle}` : rawTitle;
        const created = await prisma_1.prisma.goodsItem.create({
            data: {
                kind: body.kind,
                goodsGroupId: body.goodsGroupId,
                code: serial,
                fullCode,
                rawTitle,
                title: fullTitle,
                mainUnitId: body.mainUnitId,
                weightUnitId,
                weightRatio,
                technicalSpec: body.technicalSpec?.trim() || null,
                barcode: body.barcode?.trim() || null,
                reorderControl,
                reorderPoint,
                trackingMethod: body.kind === "GOODS" ? body.trackingMethod ?? "NONE" : "NONE",
                isLocationTracked: body.kind === "GOODS" ? !!body.isLocationTracked : false,
                accountingGroupId: body.accountingGroupId,
                isSpecial,
                taxRate,
                isActive: body.isActive ?? true,
                attributeValues: { create: resolvedAttrs.map((a) => ({ attributeId: a.attributeId, itemId: a.itemId })) },
            },
            include: {
                goodsGroup: true,
                mainUnit: true,
                weightUnit: true,
                accountingGroup: true,
                attributeValues: { include: { attribute: true, item: true } },
            },
        });
        res.status(201).json(created);
    }
    catch (e) {
        if (e.code === "P2002")
            return res.status(400).json({ error: "این کد قبلا در همین گروه استفاده شده است" });
        res.status(400).json({ error: e.message || `خطا در ثبت ${label}` });
    }
});
router.put("/goods-items/:id", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body;
    const existing = await prisma_1.prisma.goodsItem.findUnique({ where: { id } });
    if (!existing)
        return res.status(404).json({ error: "یافت نشد" });
    const label = exports.KIND_FA[existing.kind];
    if (body.accountingGroupId && body.accountingGroupId !== existing.accountingGroupId && existing.hasTransactions) {
        return res.status(400).json({ error: "این رکورد گردش دارد و امکان تغییر گروه حساب وجود ندارد" });
    }
    try {
        (0, concurrency_1.assertRecordNotStale)(existing.updatedAt, req.body.updatedAt, `این ${label}`);
        const mainUnitId = body.mainUnitId ?? existing.mainUnitId;
        const mainUnit = await prisma_1.prisma.unitOfMeasure.findUnique({ where: { id: mainUnitId } });
        if (!mainUnit)
            return res.status(400).json({ error: "واحد اصلی نامعتبر است" });
        let weightUnitId = existing.weightUnitId;
        let weightRatio = existing.weightRatio ? existing.weightRatio.toNumber() : null;
        if (body.weightUnitId !== undefined || body.mainUnitId !== undefined) {
            if (existing.kind === "GOODS" && !mainUnit.isWeight && (body.weightUnitId ?? existing.weightUnitId)) {
                weightUnitId = body.weightUnitId ?? existing.weightUnitId;
                const nextRatio = body.weightRatio !== undefined ? body.weightRatio : weightRatio;
                if (nextRatio === undefined || nextRatio === null)
                    return res.status(400).json({ error: "نسبت وزنی الزامی است" });
                weightRatio = Number(nextRatio);
            }
            else {
                weightUnitId = null;
                weightRatio = null;
            }
        }
        const isSpecial = body.isSpecial ?? existing.isSpecial;
        let taxRate = existing.taxRate ? existing.taxRate.toNumber() : null;
        if (isSpecial) {
            const nextTax = body.taxRate !== undefined ? body.taxRate : taxRate;
            if (nextTax === undefined || nextTax === null)
                return res.status(400).json({ error: "نرخ مالیات الزامی است" });
            taxRate = Number(nextTax);
        }
        else {
            taxRate = null;
        }
        const reorderControl = existing.kind === "GOODS" ? body.reorderControl ?? existing.reorderControl : false;
        let reorderPoint = existing.reorderPoint ? existing.reorderPoint.toNumber() : null;
        if (reorderControl) {
            const nextPoint = body.reorderPoint !== undefined ? body.reorderPoint : reorderPoint;
            if (nextPoint === undefined || nextPoint === null)
                return res.status(400).json({ error: "مقدار نقطه سفارش الزامی است" });
            reorderPoint = Number(nextPoint);
        }
        else {
            reorderPoint = null;
        }
        // گروه و کد سریالی پس از ثبت قابل تغییر نیستند (مبنای محاسبه‌ی کد/عنوان کامل هستند)؛
        // اما اگر مقدار ویژگی‌ها (که در تعیین بخش ویژگی‌ایِ کد/عنوان موثرند) عوض شده باشد، باید بازمحاسبه شود.
        const attrSelections = body.attributes ?? (await prisma_1.prisma.goodsItemAttributeValue.findMany({ where: { goodsItemId: id } })).map((a) => ({ attributeId: a.attributeId, itemId: a.itemId }));
        const { codePrefix, titlePrefix, resolvedAttrs } = await computePrefixes(existing.goodsGroupId, attrSelections);
        const fullCode = codePrefix + existing.code;
        const rawTitle = body.title !== undefined ? body.title.trim() : existing.rawTitle;
        const fullTitle = titlePrefix ? `${titlePrefix}، ${rawTitle}` : rawTitle;
        if (body.attributes !== undefined) {
            await prisma_1.prisma.goodsItemAttributeValue.deleteMany({ where: { goodsItemId: id } });
        }
        const updated = await prisma_1.prisma.goodsItem.update({
            where: { id },
            data: {
                fullCode,
                rawTitle,
                title: fullTitle,
                mainUnitId,
                weightUnitId,
                weightRatio,
                technicalSpec: body.technicalSpec !== undefined ? body.technicalSpec.trim() || null : undefined,
                barcode: body.barcode !== undefined ? body.barcode.trim() || null : undefined,
                reorderControl,
                reorderPoint,
                trackingMethod: existing.kind === "GOODS" ? body.trackingMethod ?? existing.trackingMethod : "NONE",
                isLocationTracked: existing.kind === "GOODS" ? body.isLocationTracked ?? existing.isLocationTracked : false,
                accountingGroupId: body.accountingGroupId ?? existing.accountingGroupId,
                isSpecial,
                taxRate,
                isActive: body.isActive ?? existing.isActive,
                ...(body.attributes !== undefined
                    ? { attributeValues: { create: resolvedAttrs.map((a) => ({ attributeId: a.attributeId, itemId: a.itemId })) } }
                    : {}),
            },
            include: {
                goodsGroup: true,
                mainUnit: true,
                weightUnit: true,
                accountingGroup: true,
                attributeValues: { include: { attribute: true, item: true } },
            },
        });
        res.json(updated);
    }
    catch (e) {
        res.status(400).json({ error: e.message || `خطا در ویرایش ${label}` });
    }
});
router.delete("/goods-items/:id", (0, guard_1.can)(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const item = await prisma_1.prisma.goodsItem.findUnique({ where: { id } });
    if (!item)
        return res.status(404).json({ error: "یافت نشد" });
    if (item.hasTransactions)
        return res.status(400).json({ error: `این ${exports.KIND_FA[item.kind]} گردش دارد و قابل حذف نیست` });
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.goodsItemAttributeValue.deleteMany({ where: { goodsItemId: id } }),
        prisma_1.prisma.goodsItem.delete({ where: { id } }),
    ]);
    res.status(204).send();
});
exports.default = router;
