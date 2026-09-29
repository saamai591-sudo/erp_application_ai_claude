"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInventoryCountingShortage = createInventoryCountingShortage;
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const journalEntryValidation_1 = require("../utils/journalEntryValidation");
const fiscalPeriodValidation_1 = require("../utils/fiscalPeriodValidation");
const warehouseDocGoodsFilterService_1 = require("../services/warehouseDocGoodsFilterService");
const warehouseTracking_1 = require("../utils/warehouseTracking");
const documentEffectsService_1 = require("../services/documentEffectsService");
const warehouseConfirmationService_1 = require("../services/warehouseConfirmationService");
const concurrency_1 = require("../utils/concurrency");
const guard_1 = require("../authz/guard");
const registry_1 = require("../authz/registry");
const documentItemAmountService_1 = require("../services/documentItemAmountService");
const FORM = (0, registry_1.findFormPrefix)("inventory-counting-shortages");
const VIEW_ACCOUNTING_PERMISSION = `${FORM}.viewAccounting`;
// =========================================================================
// ماژول «انبارداری» > حواله انبار > کسری انبارگردانی (Inventory Counting Shortage)
//
// طبق تصمیم صریح کاربر: سند مستقلی برای کسریِ شمارش انبار — کاملاً مجزا از «اضافات انبارگردانی»
// (که از این پس فقط مازاد را می‌پذیرد). یک سند خروج مستقیمِ ساده است: بدون مبنا، بدون هیچ
// مقایسه‌ای با موجودی سیستمی (کاربر مستقیماً مقدار کسری را وارد می‌کند)، و بدون «تایید حسابداری» فردی —
// دقیقاً هم‌الگوی بقیه‌ی اسناد «حواله انبار» (حواله دارایی ثابت، مصرف مرکز هزینه، ...): فی/مبلغ همیشه
// صفر ثبت می‌شود و فقط با «تایید انبار» دسته‌ای (warehouseConfirmationService.ts) Finalized/قیمت‌گذاری
// می‌شود.
// =========================================================================
const router = (0, express_1.Router)();
async function validateWarehouseAndPeriod(warehouseId, date) {
    const warehouse = await prisma_1.prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse)
        throw new Error("انبار یافت نشد");
    if (!warehouse.isActive)
        throw new Error("این انبار غیرفعال است و امکان ثبت کسری انبارگردانی برای آن وجود ندارد");
    const fiscalPeriod = await prisma_1.prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
    if (!fiscalPeriod)
        throw new Error("این تاریخ در هیچ دوره مالی تعریف نشده است");
    await (0, fiscalPeriodValidation_1.assertWithinCurrentFiscalPeriod)(fiscalPeriod.id);
    await (0, journalEntryValidation_1.assertDateNotConfirmed)(prisma_1.prisma, date, fiscalPeriod.id);
    await (0, warehouseConfirmationService_1.assertWarehouseOpenForDate)(warehouseId, date);
    return { warehouse, fiscalPeriod };
}
async function validateLines(lines, existingSerialIds) {
    if (!Array.isArray(lines) || lines.length === 0)
        throw new Error("سند کسری انبارگردانی باید حداقل یک ردیف کالا داشته باشد");
    const cleaned = [];
    for (const [idx, l] of lines.entries()) {
        const qty = Number(l.quantity);
        if (!(qty > 0))
            throw new Error(`مقدار ردیف ${idx + 1} باید عددی مثبت باشد`);
        if (!l.goodsItemId)
            throw new Error(`کالا برای ردیف ${idx + 1} الزامی است`);
        const item = await prisma_1.prisma.goodsItem.findUnique({ where: { id: l.goodsItemId } });
        if (!item)
            throw new Error(`کالای ردیف ${idx + 1} یافت نشد`);
        if (item.kind !== "GOODS")
            throw new Error(`ردیف ${idx + 1}: فقط کالا قابل انتخاب است`);
        if (!item.isActive)
            throw new Error(`کالای ردیف ${idx + 1} غیرفعال است`);
        const allowed = await (0, warehouseDocGoodsFilterService_1.isGoodsItemAllowedForDocNature)(l.goodsItemId, "OUTBOUND", "انبارگردانی");
        if (!allowed)
            throw new Error(`کالای ردیف ${idx + 1} برای کسری انبارگردانی مجاز نیست`);
        const unitId = l.unitId || item.mainUnitId;
        cleaned.push({
            goodsItemId: l.goodsItemId,
            unitId,
            quantity: qty,
            description: l.description || null,
            serialIds: l.serialIds || [],
            batchAllocations: l.batchAllocations || [],
            physicalLocation: l.physicalLocation || null,
        });
    }
    await (0, warehouseTracking_1.validateTrackingFields)(cleaned, "INVENTORY_COUNTING_SHORTAGE", existingSerialIds);
    return cleaned;
}
router.get("/inventory-counting-shortages", (0, guard_1.can)(`${FORM}.view`), async (req, res) => {
    const canViewAccounting = await (0, guard_1.userHasAction)(req.user.id, VIEW_ACCOUNTING_PERMISSION);
    const items = await prisma_1.prisma.inventoryDocument.findMany({
        where: { documentType: "INVENTORY_COUNTING_SHORTAGE" },
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
router.get("/inventory-counting-shortages/:id", (0, guard_1.can)(`${FORM}.view`), async (req, res) => {
    const id = Number(req.params.id);
    const canViewAccounting = await (0, guard_1.userHasAction)(req.user.id, VIEW_ACCOUNTING_PERMISSION);
    const d = await prisma_1.prisma.inventoryDocument.findFirst({
        where: { id, documentType: "INVENTORY_COUNTING_SHORTAGE" },
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
        return res.status(404).json({ error: "سند کسری انبارگردانی یافت نشد" });
    const showAmount = canViewAccounting && d.status === "FINALIZED";
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
            goodsItemId: l.goodsItemId,
            goodsItemCode: l.goodsItem.fullCode,
            goodsItemTitle: l.goodsItem.title,
            unitId: l.unitId,
            unitTitle: l.unit.title,
            quantity: Number(l.quantity),
            ...(showAmount ? { unitCost: (0, documentItemAmountService_1.computeUnitCost)(amountByLineId.get(l.id) ?? 0, l.quantity), amount: Number(amountByLineId.get(l.id) ?? 0) } : {}),
            description: l.description,
            ...(0, warehouseTracking_1.trackingResponseFields)(l),
            physicalLocation: l.physicalLocation?.title ?? null,
        })),
    });
});
// منطق واقعیِ ایجاد سند — هم از مسیر POST معمولی و هم از پردازشگر ورود اکسل (importProcessors/
// index.ts، entity «inventory-counting-shortage») صدا زده می‌شود تا هر دو مسیر دقیقاً یک قانون
// اعتبارسنجی/ایجاد داشته باشند (نگاه کنید به همین الگو در productionReceipts.ts).
async function createInventoryCountingShortage(body) {
    if (!body.warehouseId || !body.date)
        throw new Error("انبار و تاریخ سند الزامی است");
    const cleanedLines = await validateLines(body.lines);
    const date = new Date(body.date);
    const { warehouse, fiscalPeriod } = await validateWarehouseAndPeriod(body.warehouseId, date);
    const refs = await (0, warehouseTracking_1.resolveTrackingRefs)(cleanedLines, warehouse.id);
    const serialSteps = await (0, warehouseTracking_1.fetchCurrentSerialSteps)(refs.flatMap((r) => r.serialIds));
    // مقدار در پایگاه‌داده همیشه مثبت ذخیره می‌شود؛ علامت صادره (-۱) توسط SIGNED_TYPES در
    // warehouseStockService.ts در لحظه‌ی محاسبه‌ی موجودی اعمال می‌شود — دقیقاً هم‌الگوی حواله دارایی ثابت.
    const effectLines = cleanedLines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: l.quantity }));
    await (0, documentEffectsService_1.assertSafeToApplyEffects)(prisma_1.prisma, { documentType: "INVENTORY_COUNTING_SHORTAGE", warehouseId: warehouse.id, date }, effectLines, warehouse.stockControl);
    let number;
    if (body.number) {
        const dup = await prisma_1.prisma.inventoryDocument.findFirst({
            where: { documentType: "INVENTORY_COUNTING_SHORTAGE", fiscalPeriodId: fiscalPeriod.id, number: body.number },
        });
        if (dup)
            throw new Error(`شماره سند «${body.number}» در این دوره مالی قبلاً برای سند کسری انبارگردانی دیگری استفاده شده است`);
        number = body.number;
    }
    else {
        const lastNumber = await prisma_1.prisma.inventoryDocument.findFirst({
            where: { documentType: "INVENTORY_COUNTING_SHORTAGE", fiscalPeriodId: fiscalPeriod.id },
            orderBy: { number: "desc" },
        });
        number = lastNumber ? lastNumber.number + 1 : 1;
    }
    // طبق تصمیم کاربر: مرحله‌ی جداگانه‌ی «قطعی‌کردن» وجود ندارد — همان لحظه‌ی ذخیره، سند اثر واقعی
    // می‌گذارد (status=REGISTERED)؛ فی/مبلغ همیشه صفر است و فقط با «تایید انبار» دسته‌ای Finalized/
    // قیمت‌گذاری می‌شود — این سند «تایید حسابداری» فردی ندارد (برخلاف اضافات انبارگردانی/موجودی اول دوره/
    // رسید تولید).
    return prisma_1.prisma.$transaction(async (tx) => {
        const doc = await tx.inventoryDocument.create({
            data: {
                documentType: "INVENTORY_COUNTING_SHORTAGE",
                warehouseId: warehouse.id,
                fiscalPeriodId: fiscalPeriod.id,
                number,
                date,
                description: body.description || null,
                status: "REGISTERED",
                lines: {
                    create: cleanedLines.map((l, idx) => ({
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
        await (0, documentEffectsService_1.applyDocumentEffects)(tx, { id: doc.id, documentType: "INVENTORY_COUNTING_SHORTAGE", warehouseId: warehouse.id, date }, effectLines);
        return doc;
    });
}
router.post("/inventory-counting-shortages", (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
    const body = req.body;
    try {
        const created = await createInventoryCountingShortage(body);
        res.status(201).json(created);
    }
    catch (e) {
        if (e.code === "P2002")
            return res.status(400).json({ error: "شماره سند تکراری است" });
        res.status(400).json({ error: e.message || "خطا در ذخیره" });
    }
});
router.put("/inventory-counting-shortages/:id", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body;
    const existing = await prisma_1.prisma.inventoryDocument.findFirst({
        where: { id, documentType: "INVENTORY_COUNTING_SHORTAGE" },
        include: { lines: { include: { serials: true } }, warehouse: true },
    });
    if (!existing)
        return res.status(404).json({ error: "سند کسری انبارگردانی یافت نشد" });
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
        const cleanedLines = await validateLines(body.lines, existingSerialIds);
        const date = new Date(body.date);
        const { warehouse, fiscalPeriod } = await validateWarehouseAndPeriod(body.warehouseId, date);
        const refs = await (0, warehouseTracking_1.resolveTrackingRefs)(cleanedLines, warehouse.id);
        const serialSteps = await (0, warehouseTracking_1.fetchCurrentSerialSteps)(refs.flatMap((r) => r.serialIds));
        const newEffectLines = cleanedLines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: l.quantity }));
        // ⚠️ برخلاف ایجاد سند تازه، این‌جا excludeSelfId الزامی است.
        await (0, documentEffectsService_1.assertSafeToApplyEffects)(prisma_1.prisma, { documentType: "INVENTORY_COUNTING_SHORTAGE", warehouseId: warehouse.id, date }, newEffectLines, warehouse.stockControl, id);
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
            await (0, documentEffectsService_1.applyDocumentEffects)(tx, { id, documentType: "INVENTORY_COUNTING_SHORTAGE", warehouseId: warehouse.id, date }, newEffectLines);
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
router.delete("/inventory-counting-shortages/:id", (0, guard_1.can)(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.inventoryDocument.findFirst({ where: { id, documentType: "INVENTORY_COUNTING_SHORTAGE" }, include: { lines: true, warehouse: true } });
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
