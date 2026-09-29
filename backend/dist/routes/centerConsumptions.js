"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCenterConsumption = createCenterConsumption;
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const journalEntryValidation_1 = require("../utils/journalEntryValidation");
const fiscalPeriodValidation_1 = require("../utils/fiscalPeriodValidation");
const warehouseDocGoodsFilterService_1 = require("../services/warehouseDocGoodsFilterService");
const warehouseTracking_1 = require("../utils/warehouseTracking");
const documentEffectsService_1 = require("../services/documentEffectsService");
const warehouseConfirmationService_1 = require("../services/warehouseConfirmationService");
const detailValues_1 = require("../utils/detailValues");
const concurrency_1 = require("../utils/concurrency");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
const documentItemAmountService_1 = require("../services/documentItemAmountService");
const FORM = (0, registry_1.findFormPrefix)("center-consumptions");
const VIEW_ACCOUNTING_PERMISSION = `${FORM}.viewAccounting`;
// =========================================================================
// ماژول «انبارداری» > عملیات > مصرف مرکز هزینه (Center Consumption)
//
// طبق stockAnalysis.md بند ۳۴/۳۹: یکی از سه نوع «Consumption» (در کنار Project/Production Consumption)؛
// جایگزین حواله انبار عمومی قدیم (WAREHOUSE_ISSUE، فاز ۲) که بند ۳۴ چنین نوع عمومی‌ای را نمی‌شناخت.
// طرف مقابل همیشه یک «مرکز هزینه» است (نه پروژه/تولید — آن‌ها نوع سند جدا دارند).
// مبنا: بدون مبنا / درخواست کالا — طبق بند ۳۹، اگر مبنا وجود داشته باشد BaseType=Request؛ فقط
// درخواست‌کالاهایی با GoodsRequestType.nature=CENTER_REQUEST قابل انتخاب‌اند (بقیه‌ی natureها به
// نوع Consumption متناظر خودشان تعلق دارند).
// =========================================================================
const router = (0, express_1.Router)();
async function validateWarehouseAndPeriod(warehouseId, date) {
    const warehouse = await prisma_1.prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse)
        throw new Error("انبار یافت نشد");
    if (!warehouse.isActive)
        throw new Error("این انبار غیرفعال است و امکان ثبت مصرف مرکز هزینه برای آن وجود ندارد");
    const fiscalPeriod = await prisma_1.prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
    if (!fiscalPeriod)
        throw new Error("این تاریخ در هیچ دوره مالی تعریف نشده است");
    await (0, fiscalPeriodValidation_1.assertWithinCurrentFiscalPeriod)(fiscalPeriod.id);
    await (0, journalEntryValidation_1.assertDateNotConfirmed)(prisma_1.prisma, date, fiscalPeriod.id);
    await (0, warehouseConfirmationService_1.assertWarehouseOpenForDate)(warehouseId, date);
    return { warehouse, fiscalPeriod };
}
async function goodsRequestLineRemaining(id, excludeId) {
    const line = await prisma_1.prisma.goodsRequestLine.findUnique({
        where: { id },
        include: { goodsRequest: { include: { requestType: true } }, inventoryLines: { include: { document: true } } },
    });
    if (!line)
        return null;
    if (line.goodsRequest.requestType.nature !== "CENTER_REQUEST")
        return null;
    const approved = line.approvedQuantity != null ? Number(line.approvedQuantity) : Number(line.quantity);
    const done = line.inventoryLines
        .filter((w) => w.document.documentType === "CENTER_CONSUMPTION" && (!excludeId || w.documentId !== excludeId))
        .reduce((s, w) => s + Number(w.quantity), 0);
    const remaining = approved - done;
    return { line, remaining };
}
async function validateLines(lines, basis, excludeId, existingSerialIds) {
    if (!Array.isArray(lines) || lines.length === 0)
        throw new Error("سند مصرف مرکز هزینه باید حداقل یک ردیف کالا داشته باشد");
    const cleaned = [];
    for (const [idx, l] of lines.entries()) {
        const qty = Number(l.quantity);
        if (!(qty > 0))
            throw new Error(`مقدار ردیف ${idx + 1} باید عددی مثبت باشد`);
        let goodsItemId = l.goodsItemId || 0;
        let unitId = l.unitId || 0;
        let sourceGoodsRequestLineId = null;
        if (basis === "GOODS_REQUEST") {
            if (!l.sourceGoodsRequestLineId)
                throw new Error(`ردیف ${idx + 1}: انتخاب ردیف درخواست کالا الزامی است`);
            const info = await goodsRequestLineRemaining(l.sourceGoodsRequestLineId, excludeId);
            if (!info)
                throw new Error(`ردیف درخواست کالا برای ردیف ${idx + 1} یافت نشد یا از نوع مرکز هزینه نیست`);
            if (info.line.goodsRequest.status !== "APPROVED")
                throw new Error(`درخواست کالای ردیف ${idx + 1} در وضعیت تایید نیست`);
            if (qty > info.remaining)
                throw new Error(`مقدار ردیف ${idx + 1} از باقیمانده‌ی قابل تحویل (${info.remaining}) بیشتر است`);
            sourceGoodsRequestLineId = info.line.id;
            goodsItemId = info.line.goodsItemId;
            unitId = info.line.unitId;
        }
        else {
            if (!goodsItemId)
                throw new Error(`کالا برای ردیف ${idx + 1} الزامی است`);
            const allowed = await (0, warehouseDocGoodsFilterService_1.isGoodsItemAllowedForDocNature)(goodsItemId, "OUTBOUND", "مصرف");
            if (!allowed)
                throw new Error(`کالای ردیف ${idx + 1} برای مصرف مرکز هزینه مجاز نیست`);
        }
        const item = await prisma_1.prisma.goodsItem.findUnique({ where: { id: goodsItemId } });
        if (!item)
            throw new Error(`کالای ردیف ${idx + 1} یافت نشد`);
        if (item.kind !== "GOODS")
            throw new Error(`ردیف ${idx + 1}: فقط کالا قابل انتخاب است`);
        if (!item.isActive)
            throw new Error(`کالای ردیف ${idx + 1} غیرفعال است`);
        if (!unitId)
            unitId = item.mainUnitId;
        cleaned.push({
            sourceGoodsRequestLineId,
            goodsItemId,
            unitId,
            quantity: qty,
            description: l.description || null,
            serialIds: l.serialIds || [],
            batchAllocations: l.batchAllocations || [],
            physicalLocation: l.physicalLocation || null,
        });
    }
    await (0, warehouseTracking_1.validateTrackingFields)(cleaned, "CENTER_CONSUMPTION", existingSerialIds);
    return cleaned;
}
// =========================================================================
// پیکر «باقیمانده» درخواست کالا (فقط نوع مرکز هزینه)
// =========================================================================
router.get("/center-consumptions/pickable-goods-request-lines", (0, guard_1.can)(`${FORM}.view`), async (req, res) => {
    const destDate = req.query.destDate ? new Date(req.query.destDate) : null;
    const lines = await prisma_1.prisma.goodsRequestLine.findMany({
        where: {
            goodsRequest: { status: "APPROVED", requestType: { nature: "CENTER_REQUEST" }, ...(destDate ? { date: { lte: destDate } } : {}) },
        },
        include: {
            goodsRequest: { include: { orgUnit: true } },
            goodsItem: true,
            unit: true,
            inventoryLines: { include: { document: true } },
        },
        orderBy: { id: "desc" },
    });
    const result = lines
        .map((l) => {
        const approved = l.approvedQuantity != null ? Number(l.approvedQuantity) : Number(l.quantity);
        const done = l.inventoryLines
            .filter((w) => w.document.documentType === "CENTER_CONSUMPTION")
            .reduce((s, w) => s + Number(w.quantity), 0);
        const remaining = approved - done;
        return {
            id: l.id,
            sourceGoodsRequestLineId: l.id,
            goodsRequestId: l.goodsRequest.id,
            number: l.goodsRequest.number,
            date: l.goodsRequest.date,
            orgUnitTitle: l.goodsRequest.orgUnit.title,
            goodsItemId: l.goodsItemId,
            goodsItemCode: l.goodsItem.fullCode,
            goodsItemTitle: l.goodsItem.title,
            unitId: l.unitId,
            unitTitle: l.unit.title,
            quantity: approved,
            done,
            remaining,
        };
    })
        .filter((r) => r.remaining > 0);
    res.json(result);
});
// =========================================================================
// CRUD + قطعی‌کردن/برگشت
// =========================================================================
router.get("/center-consumptions", (0, guard_1.can)(`${FORM}.view`), async (req, res) => {
    const canViewAccounting = await (0, guard_1.userHasAction)(req.user.id, VIEW_ACCOUNTING_PERMISSION);
    const items = await prisma_1.prisma.inventoryDocument.findMany({
        where: { documentType: "CENTER_CONSUMPTION" },
        include: { warehouse: true, fiscalPeriod: true, lines: true },
        orderBy: { id: "desc" },
    });
    const codeToCostCenterId = await (0, detailValues_1.resolveDetailEntityIds)(items.map((d) => d.detailCode), "CostCenter");
    const costCenters = await prisma_1.prisma.costCenter.findMany({ where: { id: { in: Object.values(codeToCostCenterId) } } });
    const costCenterById = new Map(costCenters.map((c) => [c.id, c]));
    const amountByLineId = await (0, documentItemAmountService_1.getLineAmounts)(items.flatMap((d) => d.lines.map((l) => l.id)));
    res.json(items.map((d) => {
        const costCenterId = d.detailCode ? codeToCostCenterId[d.detailCode] ?? null : null;
        return {
            id: d.id,
            number: d.number,
            date: d.date,
            warehouseId: d.warehouseId,
            warehouseTitle: d.warehouse.title,
            fiscalPeriodTitle: d.fiscalPeriod.title,
            basis: d.basis,
            costCenterId,
            costCenterTitle: costCenterId ? costCenterById.get(costCenterId)?.title ?? null : null,
            description: d.description,
            status: d.status,
            lineCount: d.lines.length,
            totalQuantity: d.lines.reduce((s, l) => s + Number(l.quantity), 0),
            ...((canViewAccounting && d.status === "FINALIZED") ? { totalAmount: d.lines.reduce((s, l) => s + Number(amountByLineId.get(l.id) ?? 0), 0) } : {}),
        };
    }));
});
router.get("/center-consumptions/:id", (0, guard_1.can)(`${FORM}.view`), async (req, res) => {
    const id = Number(req.params.id);
    const canViewAccounting = await (0, guard_1.userHasAction)(req.user.id, VIEW_ACCOUNTING_PERMISSION);
    const d = await prisma_1.prisma.inventoryDocument.findFirst({
        where: { id, documentType: "CENTER_CONSUMPTION" },
        include: {
            warehouse: true,
            fiscalPeriod: true,
            lines: {
                include: { goodsItem: true, unit: true, batches: { include: { batch: true } }, physicalLocation: true, serials: { include: { serial: true } } },
                orderBy: { rowOrder: "asc" },
            },
        },
    });
    if (!d)
        return res.status(404).json({ error: "سند مصرف مرکز هزینه یافت نشد" });
    const codeToCostCenterId = await (0, detailValues_1.resolveDetailEntityIds)([d.detailCode], "CostCenter");
    const costCenterId = d.detailCode ? codeToCostCenterId[d.detailCode] ?? null : null;
    const costCenter = costCenterId ? await prisma_1.prisma.costCenter.findUnique({ where: { id: costCenterId } }) : null;
    const amountByLineId = await (0, documentItemAmountService_1.getLineAmounts)(d.lines.map((l) => l.id));
    res.json({
        id: d.id,
        number: d.number,
        date: d.date,
        warehouseId: d.warehouseId,
        warehouseTitle: d.warehouse.title,
        fiscalPeriodId: d.fiscalPeriodId,
        fiscalPeriodTitle: d.fiscalPeriod.title,
        basis: d.basis,
        costCenterId,
        costCenterTitle: costCenter?.title ?? null,
        description: d.description,
        status: d.status,
        finalizedAt: d.finalizedAt,
        updatedAt: d.updatedAt,
        lines: d.lines.map((l) => ({
            id: l.id,
            sourceGoodsRequestLineId: l.sourceGoodsRequestLineId,
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
// استخراج‌شده از خودِ POST تا هم مسیر دستی و هم Import اکسل (importProcessors/index.ts، ورودی
// center-consumption) دقیقاً یک منطق ثبت مشترک را اجرا کنند، نه دو پیاده‌سازی موازی — هم‌الگوی
// createWarehouseReceipt/createProductionConsumption.
async function createCenterConsumption(body) {
    if (!body.warehouseId || !body.date)
        throw new Error("انبار و تاریخ سند الزامی است");
    if (!body.basis)
        throw new Error("مبنا الزامی است");
    if (!body.costCenterId)
        throw new Error("مرکز هزینه الزامی است");
    const cc = await prisma_1.prisma.costCenter.findUnique({ where: { id: body.costCenterId } });
    if (!cc)
        throw new Error("مرکز هزینه یافت نشد");
    const cleanedLines = await validateLines(body.lines, body.basis);
    const date = new Date(body.date);
    const { warehouse, fiscalPeriod } = await validateWarehouseAndPeriod(body.warehouseId, date);
    const refs = await (0, warehouseTracking_1.resolveTrackingRefs)(cleanedLines, warehouse.id);
    const serialSteps = await (0, warehouseTracking_1.fetchCurrentSerialSteps)(refs.flatMap((r) => r.serialIds));
    const effectLines = cleanedLines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: l.quantity }));
    await (0, documentEffectsService_1.assertSafeToApplyEffects)(prisma_1.prisma, { documentType: "CENTER_CONSUMPTION", warehouseId: warehouse.id, date }, effectLines, warehouse.stockControl);
    // فقط از مسیر Import پر می‌شود (طبق تصمیم صریح کاربر — دقیقاً هم‌الگوی warehouseReceipts.ts): هنگام
    // مهاجرت از سیستم قبلی، شماره سند نباید خودکار بازتولید شود. فرم دستی هرگز این فیلد را نمی‌فرستد.
    let number;
    if (body.number) {
        const dup = await prisma_1.prisma.inventoryDocument.findFirst({
            where: { documentType: "CENTER_CONSUMPTION", fiscalPeriodId: fiscalPeriod.id, number: body.number },
        });
        if (dup)
            throw new Error(`شماره سند «${body.number}» در این دوره مالی قبلاً برای مصرف مرکز هزینه دیگری استفاده شده است`);
        number = body.number;
    }
    else {
        const lastNumber = await prisma_1.prisma.inventoryDocument.findFirst({
            where: { documentType: "CENTER_CONSUMPTION", fiscalPeriodId: fiscalPeriod.id },
            orderBy: { number: "desc" },
        });
        number = lastNumber ? lastNumber.number + 1 : 1;
    }
    return prisma_1.prisma.$transaction(async (tx) => {
        const doc = await tx.inventoryDocument.create({
            data: {
                documentType: "CENTER_CONSUMPTION",
                warehouseId: warehouse.id,
                fiscalPeriodId: fiscalPeriod.id,
                number,
                date,
                basis: body.basis,
                detailCode: cc.detailCode,
                description: body.description || null,
                status: "REGISTERED",
                lines: {
                    create: cleanedLines.map((l, idx) => ({
                        sourceGoodsRequestLineId: l.sourceGoodsRequestLineId,
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
        await (0, documentEffectsService_1.applyDocumentEffects)(tx, { id: doc.id, documentType: "CENTER_CONSUMPTION", warehouseId: warehouse.id, date }, effectLines);
        return doc;
    });
}
router.post("/center-consumptions", (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
    try {
        const created = await createCenterConsumption(req.body);
        res.status(201).json(created);
    }
    catch (e) {
        if (e.code === "P2002")
            return res.status(400).json({ error: "شماره سند تکراری است" });
        res.status(400).json({ error: e.message || "خطا در ذخیره" });
    }
});
router.put("/center-consumptions/:id", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body;
    const existing = await prisma_1.prisma.inventoryDocument.findFirst({
        where: { id, documentType: "CENTER_CONSUMPTION" },
        include: { lines: { include: { serials: true } }, warehouse: true },
    });
    if (!existing)
        return res.status(404).json({ error: "سند مصرف مرکز هزینه یافت نشد" });
    if (existing.status === "FINALIZED")
        return res.status(400).json({ error: "این سند با تایید انبار نهایی شده است و دیگر قابل ویرایش نیست" });
    const existingSerialIds = new Set(existing.lines.flatMap((l) => l.serials.map((s) => s.serialId)));
    if (!body.warehouseId || !body.date)
        return res.status(400).json({ error: "انبار و تاریخ سند الزامی است" });
    if (!body.basis)
        return res.status(400).json({ error: "مبنا الزامی است" });
    if (!body.costCenterId)
        return res.status(400).json({ error: "مرکز هزینه الزامی است" });
    try {
        (0, concurrency_1.assertRecordNotStale)(existing.updatedAt, req.body.updatedAt, "این سند");
        await (0, warehouseConfirmationService_1.assertWarehouseOpenForDate)(existing.warehouseId, existing.date);
        const oldEffectLines = existing.lines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: Number(l.quantity) }));
        const oldDoc = { id: existing.id, documentType: existing.documentType, warehouseId: existing.warehouseId, date: existing.date };
        await (0, documentEffectsService_1.assertSafeToReverseEffects)(prisma_1.prisma, oldDoc, oldEffectLines, existing.warehouse.stockControl);
        const cc = await prisma_1.prisma.costCenter.findUnique({ where: { id: body.costCenterId } });
        if (!cc)
            throw new Error("مرکز هزینه یافت نشد");
        const cleanedLines = await validateLines(body.lines, body.basis, id, existingSerialIds);
        const date = new Date(body.date);
        const { warehouse, fiscalPeriod } = await validateWarehouseAndPeriod(body.warehouseId, date);
        const refs = await (0, warehouseTracking_1.resolveTrackingRefs)(cleanedLines, warehouse.id);
        const serialSteps = await (0, warehouseTracking_1.fetchCurrentSerialSteps)(refs.flatMap((r) => r.serialIds));
        const newEffectLines = cleanedLines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: l.quantity }));
        await (0, documentEffectsService_1.assertSafeToApplyEffects)(prisma_1.prisma, { documentType: "CENTER_CONSUMPTION", warehouseId: warehouse.id, date }, newEffectLines, warehouse.stockControl, id);
        await prisma_1.prisma.$transaction(async (tx) => {
            await (0, documentEffectsService_1.reverseDocumentEffects)(tx, oldDoc);
            await tx.inventoryDocumentLine.deleteMany({ where: { documentId: id } });
            await tx.inventoryDocument.update({
                where: { id },
                data: {
                    warehouseId: warehouse.id,
                    fiscalPeriodId: fiscalPeriod.id,
                    date,
                    basis: body.basis,
                    detailCode: cc.detailCode,
                    description: body.description || null,
                    lines: {
                        create: cleanedLines.map((l, idx) => ({
                            sourceGoodsRequestLineId: l.sourceGoodsRequestLineId,
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
            await (0, documentEffectsService_1.applyDocumentEffects)(tx, { id, documentType: "CENTER_CONSUMPTION", warehouseId: warehouse.id, date }, newEffectLines);
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
router.delete("/center-consumptions/:id", (0, guard_1.can)(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.inventoryDocument.findFirst({ where: { id, documentType: "CENTER_CONSUMPTION" }, include: { lines: true, warehouse: true } });
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
