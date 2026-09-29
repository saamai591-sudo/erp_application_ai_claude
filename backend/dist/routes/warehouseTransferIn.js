"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const journalEntryValidation_1 = require("../utils/journalEntryValidation");
const fiscalPeriodValidation_1 = require("../utils/fiscalPeriodValidation");
const warehouseTracking_1 = require("../utils/warehouseTracking");
const documentEffectsService_1 = require("../services/documentEffectsService");
const warehouseConfirmationService_1 = require("../services/warehouseConfirmationService");
const concurrency_1 = require("../utils/concurrency");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
const documentItemAmountService_1 = require("../services/documentItemAmountService");
const FORM = (0, registry_1.findFormPrefix)("warehousing-warehouse-transfer-in");
const VIEW_ACCOUNTING_PERMISSION = `${FORM}.viewAccounting`;
// =========================================================================
// ماژول «انبارداری» > رسید انبار > رسید انتقال (دریافت انتقالی بین انبارها)
//
// طرف دوم «انتقال بین انبارها»؛ نگاه کنید به یادداشت بالای warehouseTransferOut.ts. هر ردیف این سند
// باید به یک ردیف سند «حواله انتقالی» قطعی‌شده ارجاع بدهد — دقیقاً همان الگوی «برگشت به
// تامین‌کننده در برابر رسید انبار خرید» (نگاه کنید به supplierReturns.ts): مقدار دریافتی نمی‌تواند از
// باقیمانده‌ی قابل دریافت آن ردیف بیشتر باشد، و امکان دریافت جزئی/چندمرحله‌ای (چند سند دریافت برای یک
// سند ارسال) وجود دارد. انبار این سند باید همان انبار مقصدِ اعلام‌شده در سند ارسال باشد.
//
// روی جدول یکپارچه‌ی InventoryDocument/InventoryDocumentLine (documentType=WAREHOUSE_TRANSFER_IN)
// ذخیره می‌شود — نگاه کنید به یادداشت بالای warehouseReceipts.ts.
// =========================================================================
const router = (0, express_1.Router)();
async function validateWarehouseAndPeriod(warehouseId, date) {
    const warehouse = await prisma_1.prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse)
        throw new Error("انبار یافت نشد");
    if (!warehouse.isActive)
        throw new Error("این انبار غیرفعال است و امکان ثبت رسید انتقال برای آن وجود ندارد");
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
        include: { document: true, transferInLines: { include: { document: true } } },
    });
    if (!line || line.document.documentType !== "WAREHOUSE_TRANSFER_OUT")
        return null;
    const sent = Number(line.quantity);
    const received = line.transferInLines
        .filter((r) => r.document.documentType === "WAREHOUSE_TRANSFER_IN" && (!excludeId || r.documentId !== excludeId))
        .reduce((s, r) => s + Number(r.quantity), 0);
    const remaining = sent - received;
    return { line, remaining };
}
async function validateLines(warehouseId, date, lines, excludeId, existingSerialIds) {
    if (!Array.isArray(lines) || lines.length === 0)
        throw new Error("سند رسید انتقال باید حداقل یک ردیف کالا داشته باشد");
    const cleaned = [];
    for (const [idx, l] of lines.entries()) {
        if (!l.sourceWarehouseTransferOutLineId)
            throw new Error(`ردیف ${idx + 1}: انتخاب ردیف سند ارسال مبدا الزامی است`);
        const qty = Number(l.quantity);
        if (!(qty > 0))
            throw new Error(`مقدار ردیف ${idx + 1} باید عددی مثبت باشد`);
        const info = await sourceLineRemaining(l.sourceWarehouseTransferOutLineId, excludeId);
        if (!info)
            throw new Error(`ردیف سند ارسال مبدا برای ردیف ${idx + 1} یافت نشد`);
        if (info.line.document.destWarehouseId !== warehouseId)
            throw new Error(`ردیف ${idx + 1}: انبار باید همان انبار مقصدِ سند ارسال مبدا باشد`);
        if (info.line.document.date.getTime() > date.getTime())
            throw new Error(`ردیف ${idx + 1}: تاریخ سند نمی‌تواند قبل از تاریخ سند ارسال مبدا باشد`);
        if (qty > info.remaining)
            throw new Error(`مقدار ردیف ${idx + 1} از باقیمانده‌ی قابل دریافت (${info.remaining}) بیشتر است`);
        cleaned.push({
            sourceWarehouseTransferOutLineId: info.line.id,
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
    await (0, warehouseTracking_1.validateTrackingFields)(cleaned, "WAREHOUSE_TRANSFER_IN", existingSerialIds);
    return cleaned;
}
router.get("/warehouse-transfer-in/pickable-lines", (0, guard_1.can)(`${FORM}.view`), async (req, res) => {
    const destWarehouseId = req.query.destWarehouseId ? Number(req.query.destWarehouseId) : null;
    const date = req.query.date ? new Date(req.query.date) : null;
    const lines = await prisma_1.prisma.inventoryDocumentLine.findMany({
        where: {
            document: {
                documentType: "WAREHOUSE_TRANSFER_OUT",
                ...(destWarehouseId ? { destWarehouseId } : {}),
                ...(date ? { date: { lte: date } } : {}),
            },
        },
        include: { document: true, goodsItem: true, unit: true, transferInLines: { include: { document: true } } },
        orderBy: { id: "desc" },
    });
    const result = lines
        .map((l) => {
        const sent = Number(l.quantity);
        const received = l.transferInLines
            .filter((r) => r.document.documentType === "WAREHOUSE_TRANSFER_IN")
            .reduce((s, r) => s + Number(r.quantity), 0);
        const remaining = sent - received;
        return {
            id: l.id,
            sourceWarehouseTransferOutLineId: l.id,
            number: l.document.number,
            date: l.document.date,
            sourceWarehouseId: l.document.warehouseId,
            goodsItemId: l.goodsItemId,
            goodsItemCode: l.goodsItem.fullCode,
            goodsItemTitle: l.goodsItem.title,
            unitId: l.unitId,
            unitTitle: l.unit.title,
            quantity: sent,
            done: received,
            remaining,
        };
    })
        .filter((r) => r.remaining > 0);
    res.json(result);
});
router.get("/warehouse-transfer-in", (0, guard_1.can)(`${FORM}.view`), async (req, res) => {
    const canViewAccounting = await (0, guard_1.userHasAction)(req.user.id, VIEW_ACCOUNTING_PERMISSION);
    const items = await prisma_1.prisma.inventoryDocument.findMany({
        where: { documentType: "WAREHOUSE_TRANSFER_IN" },
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
router.get("/warehouse-transfer-in/:id", (0, guard_1.can)(`${FORM}.view`), async (req, res) => {
    const id = Number(req.params.id);
    const canViewAccounting = await (0, guard_1.userHasAction)(req.user.id, VIEW_ACCOUNTING_PERMISSION);
    const d = await prisma_1.prisma.inventoryDocument.findFirst({
        where: { id, documentType: "WAREHOUSE_TRANSFER_IN" },
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
                    sourceWarehouseTransferOutLine: { include: { document: true } },
                },
                orderBy: { rowOrder: "asc" },
            },
        },
    });
    if (!d)
        return res.status(404).json({ error: "سند رسید انتقال یافت نشد" });
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
            sourceWarehouseTransferOutLineId: l.sourceWarehouseTransferOutLineId,
            sourceNumber: l.sourceWarehouseTransferOutLine?.document.number ?? null,
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
router.post("/warehouse-transfer-in", (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
    const body = req.body;
    if (!body.warehouseId || !body.date)
        return res.status(400).json({ error: "انبار و تاریخ سند الزامی است" });
    try {
        const date = new Date(body.date);
        const cleanedLines = await validateLines(body.warehouseId, date, body.lines);
        const { warehouse, fiscalPeriod } = await validateWarehouseAndPeriod(body.warehouseId, date);
        const refs = await (0, warehouseTracking_1.resolveTrackingRefs)(cleanedLines, warehouse.id);
        const serialSteps = await (0, warehouseTracking_1.fetchCurrentSerialSteps)(refs.flatMap((r) => r.serialIds));
        const effectLines = cleanedLines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: l.quantity }));
        await (0, documentEffectsService_1.assertSafeToApplyEffects)(prisma_1.prisma, { documentType: "WAREHOUSE_TRANSFER_IN", warehouseId: warehouse.id, date }, effectLines, warehouse.stockControl);
        const lastNumber = await prisma_1.prisma.inventoryDocument.findFirst({
            where: { documentType: "WAREHOUSE_TRANSFER_IN", fiscalPeriodId: fiscalPeriod.id },
            orderBy: { number: "desc" },
        });
        const number = lastNumber ? lastNumber.number + 1 : 1;
        const created = await prisma_1.prisma.$transaction(async (tx) => {
            const doc = await tx.inventoryDocument.create({
                data: {
                    documentType: "WAREHOUSE_TRANSFER_IN",
                    warehouseId: warehouse.id,
                    fiscalPeriodId: fiscalPeriod.id,
                    basis: "WAREHOUSE_TRANSFER_OUT",
                    number,
                    date,
                    description: body.description || null,
                    status: "REGISTERED",
                    lines: {
                        create: cleanedLines.map((l, idx) => ({
                            sourceWarehouseTransferOutLineId: l.sourceWarehouseTransferOutLineId,
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
            await (0, documentEffectsService_1.applyDocumentEffects)(tx, { id: doc.id, documentType: "WAREHOUSE_TRANSFER_IN", warehouseId: warehouse.id, date }, effectLines);
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
router.put("/warehouse-transfer-in/:id", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body;
    const existing = await prisma_1.prisma.inventoryDocument.findFirst({
        where: { id, documentType: "WAREHOUSE_TRANSFER_IN" },
        include: { lines: { include: { serials: true } }, warehouse: true },
    });
    if (!existing)
        return res.status(404).json({ error: "سند رسید انتقال یافت نشد" });
    if (existing.status === "FINALIZED")
        return res.status(400).json({ error: "این سند با تایید انبار نهایی شده است و دیگر قابل ویرایش نیست" });
    const existingSerialIds = new Set(existing.lines.flatMap((l) => l.serials.map((s) => s.serialId)));
    if (!body.warehouseId || !body.date)
        return res.status(400).json({ error: "انبار و تاریخ سند الزامی است" });
    try {
        (0, concurrency_1.assertRecordNotStale)(existing.updatedAt, req.body.updatedAt, "این سند");
        await (0, warehouseConfirmationService_1.assertWarehouseOpenForDate)(existing.warehouseId, existing.date);
        const oldEffectLines = existing.lines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: Number(l.quantity) }));
        const oldDoc = { id: existing.id, documentType: existing.documentType, warehouseId: existing.warehouseId, date: existing.date };
        await (0, documentEffectsService_1.assertSafeToReverseEffects)(prisma_1.prisma, oldDoc, oldEffectLines, existing.warehouse.stockControl);
        const date = new Date(body.date);
        const cleanedLines = await validateLines(body.warehouseId, date, body.lines, id, existingSerialIds);
        const { warehouse, fiscalPeriod } = await validateWarehouseAndPeriod(body.warehouseId, date);
        const refs = await (0, warehouseTracking_1.resolveTrackingRefs)(cleanedLines, warehouse.id);
        const serialSteps = await (0, warehouseTracking_1.fetchCurrentSerialSteps)(refs.flatMap((r) => r.serialIds));
        const newEffectLines = cleanedLines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: l.quantity }));
        await (0, documentEffectsService_1.assertSafeToApplyEffects)(prisma_1.prisma, { documentType: "WAREHOUSE_TRANSFER_IN", warehouseId: warehouse.id, date }, newEffectLines, warehouse.stockControl, id);
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
                            sourceWarehouseTransferOutLineId: l.sourceWarehouseTransferOutLineId,
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
            await (0, documentEffectsService_1.applyDocumentEffects)(tx, { id, documentType: "WAREHOUSE_TRANSFER_IN", warehouseId: warehouse.id, date }, newEffectLines);
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
router.delete("/warehouse-transfer-in/:id", (0, guard_1.can)(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.inventoryDocument.findFirst({
        where: { id, documentType: "WAREHOUSE_TRANSFER_IN" },
        include: { lines: true, warehouse: true },
    });
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
