"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const journalEntryValidation_1 = require("../utils/journalEntryValidation");
const fiscalPeriodValidation_1 = require("../utils/fiscalPeriodValidation");
const warehouseTracking_1 = require("../utils/warehouseTracking");
const documentEffectsService_1 = require("../services/documentEffectsService");
const warehouseConfirmationService_1 = require("../services/warehouseConfirmationService");
const detailValues_1 = require("../utils/detailValues");
const concurrency_1 = require("../utils/concurrency");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
const documentItemAmountService_1 = require("../services/documentItemAmountService");
const FORM = (0, registry_1.findFormPrefix)("project-consumption-returns");
const VIEW_ACCOUNTING_PERMISSION = `${FORM}.viewAccounting`;
// =========================================================================
// ماژول «انبارداری» > عملیات > برگشت مصرف پروژه (Project Consumption Return)
// طبق بند ۴۰: ارجاع اجباری به ردیف مصرف پروژه‌ی قطعی‌شده + کنترل ReturnedQuantity <= IssuedQuantity.
// نگاه کنید به یادداشت بالای centerConsumptionReturns.ts (همان الگو).
// =========================================================================
const router = (0, express_1.Router)();
async function validateWarehouseAndPeriod(warehouseId, date) {
    const warehouse = await prisma_1.prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse)
        throw new Error("انبار یافت نشد");
    if (!warehouse.isActive)
        throw new Error("این انبار غیرفعال است و امکان ثبت برگشت مصرف پروژه برای آن وجود ندارد");
    const fiscalPeriod = await prisma_1.prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
    if (!fiscalPeriod)
        throw new Error("این تاریخ در هیچ دوره مالی تعریف نشده است");
    await (0, fiscalPeriodValidation_1.assertWithinCurrentFiscalPeriod)(fiscalPeriod.id);
    await (0, journalEntryValidation_1.assertDateNotConfirmed)(prisma_1.prisma, date, fiscalPeriod.id);
    await (0, warehouseConfirmationService_1.assertWarehouseOpenForDate)(warehouseId, date);
    return { warehouse, fiscalPeriod };
}
async function sourceLineRemaining(id, excludeId) {
    const line = await prisma_1.prisma.inventoryDocumentLine.findUnique({
        where: { id },
        include: { document: true, projectConsumptionReturnLines: { include: { document: true } } },
    });
    if (!line || line.document.documentType !== "PROJECT_CONSUMPTION")
        return null;
    const issued = Number(line.quantity);
    const returned = line.projectConsumptionReturnLines
        .filter((r) => r.document.documentType === "PROJECT_CONSUMPTION_RETURN" && (!excludeId || r.documentId !== excludeId))
        .reduce((s, r) => s + Number(r.quantity), 0);
    const remaining = issued - returned;
    return { line, remaining };
}
async function validateLines(warehouseId, lines, excludeId, existingSerialIds) {
    if (!Array.isArray(lines) || lines.length === 0)
        throw new Error("سند برگشت مصرف پروژه باید حداقل یک ردیف کالا داشته باشد");
    const cleaned = [];
    for (const [idx, l] of lines.entries()) {
        if (!l.sourceProjectConsumptionLineId)
            throw new Error(`ردیف ${idx + 1}: انتخاب ردیف مصرف پروژه‌ی مبدا الزامی است`);
        const qty = Number(l.quantity);
        if (!(qty > 0))
            throw new Error(`مقدار ردیف ${idx + 1} باید عددی مثبت باشد`);
        const info = await sourceLineRemaining(l.sourceProjectConsumptionLineId, excludeId);
        if (!info)
            throw new Error(`ردیف مصرف پروژه‌ی مبدا برای ردیف ${idx + 1} یافت نشد`);
        if (info.line.document.warehouseId !== warehouseId)
            throw new Error(`ردیف ${idx + 1}: انبار باید همان انبار سند مصرف مبدا باشد`);
        if (qty > info.remaining)
            throw new Error(`مقدار ردیف ${idx + 1} از باقیمانده‌ی قابل برگشت (${info.remaining}) بیشتر است`);
        cleaned.push({
            sourceProjectConsumptionLineId: info.line.id,
            goodsItemId: info.line.goodsItemId,
            unitId: info.line.unitId,
            quantity: qty,
            description: l.description || null,
            serialIds: l.serialIds || [],
            batchAllocations: l.batchAllocations || [],
            sourceLineId: info.line.id,
            physicalLocation: l.physicalLocation || null,
        });
    }
    await (0, warehouseTracking_1.validateTrackingFields)(cleaned, "PROJECT_CONSUMPTION_RETURN", existingSerialIds);
    return cleaned;
}
router.get("/project-consumption-returns/pickable-lines", (0, guard_1.can)(`${FORM}.view`), async (req, res) => {
    const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : null;
    const lines = await prisma_1.prisma.inventoryDocumentLine.findMany({
        where: { document: { documentType: "PROJECT_CONSUMPTION", ...(warehouseId ? { warehouseId } : {}) } },
        include: { document: true, goodsItem: true, unit: true, projectConsumptionReturnLines: { include: { document: true } } },
        orderBy: { id: "desc" },
    });
    const codeToProjectId = await (0, detailValues_1.resolveDetailEntityIds)(lines.map((l) => l.document.detailCode), "Project");
    const projects = await prisma_1.prisma.project.findMany({ where: { id: { in: Object.values(codeToProjectId) } } });
    const projectById = new Map(projects.map((p) => [p.id, p]));
    const result = lines
        .map((l) => {
        const issued = Number(l.quantity);
        const returned = l.projectConsumptionReturnLines
            .filter((r) => r.document.documentType === "PROJECT_CONSUMPTION_RETURN")
            .reduce((s, r) => s + Number(r.quantity), 0);
        const remaining = issued - returned;
        const projectId = l.document.detailCode ? codeToProjectId[l.document.detailCode] : null;
        return {
            id: l.id,
            sourceProjectConsumptionLineId: l.id,
            number: l.document.number,
            date: l.document.date,
            projectTitle: projectId ? projectById.get(projectId)?.title ?? null : null,
            goodsItemId: l.goodsItemId,
            goodsItemCode: l.goodsItem.fullCode,
            goodsItemTitle: l.goodsItem.title,
            unitId: l.unitId,
            unitTitle: l.unit.title,
            quantity: issued,
            done: returned,
            remaining,
        };
    })
        .filter((r) => r.remaining > 0);
    res.json(result);
});
router.get("/project-consumption-returns", (0, guard_1.can)(`${FORM}.view`), async (req, res) => {
    const canViewAccounting = await (0, guard_1.userHasAction)(req.user.id, VIEW_ACCOUNTING_PERMISSION);
    const items = await prisma_1.prisma.inventoryDocument.findMany({
        where: { documentType: "PROJECT_CONSUMPTION_RETURN" },
        include: { warehouse: true, fiscalPeriod: true, lines: true },
        orderBy: { id: "desc" },
    });
    const amountByLineId = await (0, documentItemAmountService_1.getLineAmounts)(items.flatMap((d) => d.lines.map((l) => l.id)));
    res.json(items.map((d) => ({
        id: d.id,
        number: d.number,
        date: d.date,
        warehouseId: d.warehouseId,
        warehouseTitle: d.warehouse.title,
        fiscalPeriodTitle: d.fiscalPeriod.title,
        description: d.description,
        status: d.status,
        lineCount: d.lines.length,
        totalQuantity: d.lines.reduce((s, l) => s + Number(l.quantity), 0),
        ...((canViewAccounting && d.status === "FINALIZED") ? { totalAmount: d.lines.reduce((s, l) => s + Number(amountByLineId.get(l.id) ?? 0), 0) } : {}),
    })));
});
router.get("/project-consumption-returns/:id", (0, guard_1.can)(`${FORM}.view`), async (req, res) => {
    const id = Number(req.params.id);
    const canViewAccounting = await (0, guard_1.userHasAction)(req.user.id, VIEW_ACCOUNTING_PERMISSION);
    const d = await prisma_1.prisma.inventoryDocument.findFirst({
        where: { id, documentType: "PROJECT_CONSUMPTION_RETURN" },
        include: {
            warehouse: true,
            fiscalPeriod: true,
            lines: {
                include: {
                    goodsItem: true,
                    unit: true,
                    batches: { include: { batch: true } },
                    physicalLocation: true,
                    serials: { include: { serial: true } },
                    sourceProjectConsumptionLine: { include: { document: true } },
                },
                orderBy: { rowOrder: "asc" },
            },
        },
    });
    if (!d)
        return res.status(404).json({ error: "سند برگشت مصرف پروژه یافت نشد" });
    const amountByLineId = await (0, documentItemAmountService_1.getLineAmounts)(d.lines.map((l) => l.id));
    res.json({
        id: d.id,
        number: d.number,
        date: d.date,
        warehouseId: d.warehouseId,
        warehouseTitle: d.warehouse.title,
        fiscalPeriodId: d.fiscalPeriodId,
        fiscalPeriodTitle: d.fiscalPeriod.title,
        description: d.description,
        status: d.status,
        finalizedAt: d.finalizedAt,
        updatedAt: d.updatedAt,
        lines: d.lines.map((l) => ({
            id: l.id,
            sourceProjectConsumptionLineId: l.sourceProjectConsumptionLineId,
            sourceNumber: l.sourceProjectConsumptionLine?.document.number ?? null,
            goodsItemId: l.goodsItemId,
            goodsItemCode: l.goodsItem.fullCode,
            goodsItemTitle: l.goodsItem.title,
            unitId: l.unitId,
            unitTitle: l.unit.title,
            quantity: Number(l.quantity),
            ...((canViewAccounting && d.status === "FINALIZED") ? { unitCost: (0, documentItemAmountService_1.computeUnitCost)(amountByLineId.get(l.id) ?? 0, l.quantity), amount: Number(amountByLineId.get(l.id) ?? 0) } : {}),
            description: l.description,
            ...(0, warehouseTracking_1.trackingResponseFields)(l),
            physicalLocation: l.physicalLocation?.title ?? null,
        })),
    });
});
router.post("/project-consumption-returns", (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
    const body = req.body;
    if (!body.warehouseId || !body.date)
        return res.status(400).json({ error: "انبار و تاریخ سند الزامی است" });
    try {
        const cleanedLines = await validateLines(body.warehouseId, body.lines);
        const date = new Date(body.date);
        const { warehouse, fiscalPeriod } = await validateWarehouseAndPeriod(body.warehouseId, date);
        const refs = await (0, warehouseTracking_1.resolveTrackingRefs)(cleanedLines, warehouse.id);
        const serialSteps = await (0, warehouseTracking_1.fetchCurrentSerialSteps)(refs.flatMap((r) => r.serialIds));
        const effectLines = cleanedLines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: l.quantity }));
        await (0, documentEffectsService_1.assertSafeToApplyEffects)(prisma_1.prisma, { documentType: "PROJECT_CONSUMPTION_RETURN", warehouseId: warehouse.id, date }, effectLines, warehouse.stockControl);
        const lastNumber = await prisma_1.prisma.inventoryDocument.findFirst({
            where: { documentType: "PROJECT_CONSUMPTION_RETURN", fiscalPeriodId: fiscalPeriod.id },
            orderBy: { number: "desc" },
        });
        const number = lastNumber ? lastNumber.number + 1 : 1;
        // طبق تصمیم کاربر: دیگر مرحله‌ی جداگانه‌ی «قطعی‌کردن» وجود ندارد — همان لحظه‌ی ذخیره، سند اثر واقعی
        // می‌گذارد (status مستقیم FINALIZED، نه DRAFT).
        const created = await prisma_1.prisma.$transaction(async (tx) => {
            const doc = await tx.inventoryDocument.create({
                data: {
                    documentType: "PROJECT_CONSUMPTION_RETURN",
                    warehouseId: warehouse.id,
                    fiscalPeriodId: fiscalPeriod.id,
                    number,
                    date,
                    description: body.description || null,
                    status: "REGISTERED",
                    lines: {
                        create: cleanedLines.map((l, idx) => ({
                            sourceProjectConsumptionLineId: l.sourceProjectConsumptionLineId,
                            goodsItemId: l.goodsItemId,
                            unitId: l.unitId,
                            quantity: l.quantity,
                            description: l.description,
                            rowOrder: idx,
                            ...(0, warehouseTracking_1.trackingCreateData)(refs[idx], serialSteps),
                        })),
                    },
                },
            });
            await (0, documentEffectsService_1.applyDocumentEffects)(tx, { id: doc.id, documentType: "PROJECT_CONSUMPTION_RETURN", warehouseId: warehouse.id, date }, effectLines);
            return doc;
        });
        res.status(201).json(created);
    }
    catch (e) {
        if (e.code === "P2002")
            return res.status(400).json({ error: "شماره سند تکراری است" });
        res.status(400).json({ error: e.message || "خطا در ذخیره" });
    }
});
router.put("/project-consumption-returns/:id", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body;
    const existing = await prisma_1.prisma.inventoryDocument.findFirst({
        where: { id, documentType: "PROJECT_CONSUMPTION_RETURN" },
        include: { lines: { include: { serials: true } }, warehouse: true },
    });
    if (!existing)
        return res.status(404).json({ error: "سند برگشت مصرف پروژه یافت نشد" });
    if (existing.status === "FINALIZED")
        return res.status(400).json({ error: "این سند با تایید انبار نهایی شده است و دیگر قابل ویرایش نیست" });
    const existingSerialIds = new Set(existing.lines.flatMap((l) => l.serials.map((s) => s.serialId)));
    if (!body.warehouseId || !body.date)
        return res.status(400).json({ error: "انبار و تاریخ سند الزامی است" });
    try {
        (0, concurrency_1.assertRecordNotStale)(existing.updatedAt, req.body.updatedAt, "این سند");
        await (0, warehouseConfirmationService_1.assertWarehouseOpenForDate)(existing.warehouseId, existing.date);
        // این سند از قبل هم «قطعی» است (دیگر مرحله‌ی جداگانه‌ای برای آن وجود ندارد) — پس ویرایش، به‌جای
        // «برگشت از قطعی دستی، سپس ویرایش، سپس دوباره قطعی‌کردن»، همین سه‌کار را در یک درخواست و با همان
        // کنترل‌های ایمنی انجام می‌دهد.
        const oldEffectLines = existing.lines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: Number(l.quantity) }));
        const oldDoc = { id: existing.id, documentType: existing.documentType, warehouseId: existing.warehouseId, date: existing.date };
        await (0, documentEffectsService_1.assertSafeToReverseEffects)(prisma_1.prisma, oldDoc, oldEffectLines, existing.warehouse.stockControl);
        const cleanedLines = await validateLines(body.warehouseId, body.lines, id, existingSerialIds);
        const date = new Date(body.date);
        const { warehouse, fiscalPeriod } = await validateWarehouseAndPeriod(body.warehouseId, date);
        const refs = await (0, warehouseTracking_1.resolveTrackingRefs)(cleanedLines, warehouse.id);
        const serialSteps = await (0, warehouseTracking_1.fetchCurrentSerialSteps)(refs.flatMap((r) => r.serialIds));
        const newEffectLines = cleanedLines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: l.quantity }));
        await (0, documentEffectsService_1.assertSafeToApplyEffects)(prisma_1.prisma, { documentType: "PROJECT_CONSUMPTION_RETURN", warehouseId: warehouse.id, date }, newEffectLines, warehouse.stockControl, id);
        await prisma_1.prisma.$transaction(async (tx) => {
            await (0, documentEffectsService_1.reverseDocumentEffects)(tx, oldDoc);
            await tx.inventoryDocumentLine.deleteMany({ where: { documentId: id } });
            await tx.inventoryDocument.update({
                where: { id },
                data: {
                    warehouseId: warehouse.id,
                    fiscalPeriodId: fiscalPeriod.id,
                    date,
                    description: body.description || null,
                    lines: {
                        create: cleanedLines.map((l, idx) => ({
                            sourceProjectConsumptionLineId: l.sourceProjectConsumptionLineId,
                            goodsItemId: l.goodsItemId,
                            unitId: l.unitId,
                            quantity: l.quantity,
                            description: l.description,
                            rowOrder: idx,
                            ...(0, warehouseTracking_1.trackingCreateData)(refs[idx], serialSteps),
                        })),
                    },
                },
            });
            await (0, documentEffectsService_1.applyDocumentEffects)(tx, { id, documentType: "PROJECT_CONSUMPTION_RETURN", warehouseId: warehouse.id, date }, newEffectLines);
            const goodsItemIds = [...oldEffectLines.map((l) => l.goodsItemId), ...newEffectLines.map((l) => l.goodsItemId)];
            await (0, warehouseTracking_1.recomputeGoodsItemHasTransactions)(goodsItemIds, tx);
            await (0, warehouseTracking_1.recomputeWarehouseHasTransactions)([existing.warehouseId, warehouse.id], tx);
        });
        res.json({ id });
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در ذخیره" });
    }
});
router.delete("/project-consumption-returns/:id", (0, guard_1.can)(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.inventoryDocument.findFirst({ where: { id, documentType: "PROJECT_CONSUMPTION_RETURN" }, include: { lines: true, warehouse: true } });
    if (!d)
        return res.status(404).json({ error: "یافت نشد" });
    if (d.status === "FINALIZED")
        return res.status(400).json({ error: "این سند با تایید انبار نهایی شده است و دیگر قابل حذف نیست" });
    try {
        await (0, warehouseConfirmationService_1.assertWarehouseOpenForDate)(d.warehouseId, d.date);
        const effectLines = d.lines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: Number(l.quantity) }));
        const doc = { id: d.id, documentType: d.documentType, warehouseId: d.warehouseId, date: d.date };
        await (0, documentEffectsService_1.assertSafeToReverseEffects)(prisma_1.prisma, doc, effectLines, d.warehouse.stockControl);
        await prisma_1.prisma.$transaction(async (tx) => {
            await (0, documentEffectsService_1.reverseDocumentEffects)(tx, doc);
            await tx.inventoryDocument.delete({ where: { id } });
            // این recompute باید بعد از حذف سند اجرا شود، نه قبلش — وگرنه هنوز خودِ همین سند را می‌بیند و
            // پاسخ اشتباه («هنوز گردش دارد») می‌دهد.
            await (0, warehouseTracking_1.recomputeGoodsItemHasTransactions)(effectLines.map((l) => l.goodsItemId), tx);
            await (0, warehouseTracking_1.recomputeWarehouseHasTransactions)([d.warehouseId], tx);
        });
        res.status(204).send();
    }
    catch (e) {
        res.status(400).json({ error: e.message || "خطا در حذف" });
    }
});
exports.default = router;
