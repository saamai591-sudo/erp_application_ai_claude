"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSalesDelivery = createSalesDelivery;
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
const FORM = (0, registry_1.findFormPrefix)("sales-deliveries");
// =========================================================================
// ماژول «فروش» > عملیات > حواله فروش (مجوز خروج از انبار برای فروش)
//
// این سند واقعی حرکت انبار است (جدا از حواله انبار مصرفی موجود) — طبق تصمیم صریح کاربر، یک سند جدید
// و مستقل، ساختارش دقیقاً مطابق الگوی «رسید انبار خرید» (warehouseReceipts.ts) است:
// - مبنا: بدون مبنا / سفارش فروش. «مانده‌ای» — هر ردیف سفارش فروش می‌تواند طی چند حواله فروش جزئی/
//   کامل تحویل شود (طبق تصمیم صریح کاربر، دقیقاً مثل اکثر زنجیره خرید).
// - طرف مقابل (partyId، تفصیل نوع «طرف حساب») همیشه دستی انتخاب می‌شود — دقیقاً مثل رسید انبار خرید
//   (warehouseReceipts.ts) — چه حواله مبنا داشته باشد چه نه؛ روی InventoryDocument.detailCode ذخیره
//   می‌شود (همان فیلد یکپارچه‌ی «تفصیل» که رسید انبار خرید/مصرف مرکز هزینه/مصرف پروژه هم استفاده می‌کنند).
// - طبق ماتریس نوع کالا-ماهیت سند انبار: OUTBOUND/«فروش».
// - فی/مبلغ در این فاز کاربر ندارد (unitCost/amount همیشه صفر) — دقیقاً مثل رسید انبار خرید.
// - وضعیت: WarehouseDocStatus (ثبت/قطعی/ابطال) + قطعی‌کردن/برگشت با کنترل موجودی منفی، چون سند صادره
//   است (مثل حواله انبار مصرف: کنترل موجودی منفی هنگام قطعی‌کردن انجام می‌شود، نه برگشت).
// - این سند (طبق بند ۳۴ سند که «حواله فروش» را هم نوع صادره‌ی ردیابی‌شونده می‌داند) هم مثل بقیه‌ی ۵
//   نوع، سریال/بچ/تاریخ‌انقضا/محل‌فیزیکی دارد — همان الگوی warehouseReceipts.ts (validateTrackingFields
//   + resolveTrackingRefs)، اضافه‌شده در فاز ۳ (فرانت‌اند/پیکرها).
//
// طبق stockAnalysis.md (فاز ۲): روی جدول یکپارچه‌ی InventoryDocument/InventoryDocumentLine
// (documentType=SALES_DELIVERY) ذخیره می‌شود — نگاه کنید به یادداشت بالای warehouseReceipts.ts.
// =========================================================================
const router = (0, express_1.Router)();
// طرف مقابل (partyId، تفصیل نوع «طرف حساب») همیشه دستی انتخاب می‌شود — دقیقاً مثل رسید انبار خرید
// (warehouseReceipts.ts). وقتی مبنا سفارش‌فروش است، باید همان مشتری‌ای باشد که آن سفارش فروش با آن
// ثبت شده؛ یعنی طرف مقابل باید یک رکورد «مشتری» (Customer) مرتبط داشته باشد (partyId → Customer.partyId).
async function resolveCustomerIdForParty(partyId) {
    const customer = await prisma_1.prisma.customer.findUnique({ where: { partyId } });
    return customer ? customer.id : null;
}
async function validateWarehouseAndPeriod(warehouseId, date) {
    const warehouse = await prisma_1.prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse)
        throw new Error("انبار یافت نشد");
    if (!warehouse.isActive)
        throw new Error("این انبار غیرفعال است و امکان ثبت حواله فروش برای آن وجود ندارد");
    const fiscalPeriod = await prisma_1.prisma.fiscalPeriod.findFirst({ where: { fromDate: { lte: date }, toDate: { gte: date } } });
    if (!fiscalPeriod)
        throw new Error("این تاریخ در هیچ دوره مالی تعریف نشده است");
    await (0, fiscalPeriodValidation_1.assertWithinCurrentFiscalPeriod)(fiscalPeriod.id);
    await (0, journalEntryValidation_1.assertDateNotConfirmed)(prisma_1.prisma, date, fiscalPeriod.id);
    await (0, warehouseConfirmationService_1.assertWarehouseOpenForDate)(warehouseId, date);
    return { warehouse, fiscalPeriod };
}
async function salesOrderLineRemaining(id, excludeDeliveryId) {
    const line = await prisma_1.prisma.salesOrderLine.findUnique({
        where: { id },
        include: { salesOrder: true, inventoryLines: { include: { document: true } } },
    });
    if (!line)
        return null;
    const done = line.inventoryLines
        .filter((d) => d.document.documentType === "SALES_DELIVERY" && (!excludeDeliveryId || d.documentId !== excludeDeliveryId))
        .reduce((s, d) => s + Number(d.quantity), 0);
    const remaining = Number(line.quantity) - done;
    return { line, remaining };
}
// «مانده»ی ردیف پیش‌فاکتور برای حواله فروش = مقدار ردیف − آنچه به سفارش فروش تبدیل شده − آنچه مستقیماً با حواله فروش تحویل شده
// (حواله‌ی یک سفارشِ برگرفته از همین پیش‌فاکتور، دوباره از پیش‌فاکتور کم نمی‌شود چون قبلاً در سفارش کم شده است).
async function salesQuoteLineRemaining(id, excludeDeliveryId) {
    const line = await prisma_1.prisma.salesQuoteLine.findUnique({
        where: { id },
        include: { salesQuote: true, salesOrderLines: true, inventoryLines: { include: { document: true } } },
    });
    if (!line)
        return null;
    const ordered = line.salesOrderLines.reduce((s, o) => s + Number(o.quantity), 0);
    const delivered = line.inventoryLines
        .filter((d) => d.document.documentType === "SALES_DELIVERY" && (!excludeDeliveryId || d.documentId !== excludeDeliveryId))
        .reduce((s, d) => s + Number(d.quantity), 0);
    return { line, remaining: Number(line.quantity) - ordered - delivered };
}
async function validateLines(lines, basis, partyCustomerId, excludeDeliveryId, existingSerialIds) {
    if (!Array.isArray(lines) || lines.length === 0)
        throw new Error("حواله فروش باید حداقل یک ردیف کالا داشته باشد");
    // طبق تصمیم صریح کاربر (دقیقاً هم‌الگوی رسید انبار خرید/تامین‌کننده): طرف مقابل حواله بدون‌مبنا باید
    // از قبل به‌عنوان مشتری تعریف‌شده باشد — نه این‌که خودکار ساخته شود. برای SALES_ORDER نیازی به این
    // بررسی جدا نیست، چون همان‌جا (پایین‌تر) تطبیق مشتری سند مبنا با طرف مقابل هدر، همین را ضمنی الزامی
    // می‌کند.
    if (basis === "NO_BASIS" && !partyCustomerId) {
        throw new Error("طرف مقابل باید یک مشتری تعریف‌شده باشد");
    }
    const cleaned = [];
    // یک ردیف سفارش/پیش‌فاکتور می‌تواند در چند ردیف حواله بیاید (مثلاً تفکیک به‌خاطر سریال/بچ یا محل فیزیکی)؛ کنترل بر پایه‌ی «مجموع مقدار ردیف‌های ارجاع‌دهنده
    // به آن ردیف مبنا ≤ مانده‌ی قابل تحویل آن» است، نه ممنوعیت انتخاب تکراری
    const allocatedToSource = new Map();
    for (const [idx, l] of lines.entries()) {
        const qty = Number(l.quantity);
        if (!(qty > 0))
            throw new Error(`مقدار ردیف ${idx + 1} باید عددی مثبت باشد`);
        let goodsItemId = l.goodsItemId || 0;
        let unitId = l.unitId || 0;
        let sourceSalesOrderLineId = null;
        let sourceSalesQuoteLineId = null;
        if (basis === "SALES_ORDER") {
            if (!l.sourceSalesOrderLineId)
                throw new Error(`ردیف ${idx + 1}: انتخاب ردیف سفارش فروش الزامی است`);
            const info = await salesOrderLineRemaining(l.sourceSalesOrderLineId, excludeDeliveryId);
            if (!info)
                throw new Error(`ردیف سفارش فروش برای ردیف ${idx + 1} یافت نشد`);
            if (info.line.salesOrder.status !== "APPROVED")
                throw new Error(`سفارش فروش ردیف ${idx + 1} در وضعیت تایید نیست`);
            const orderKey = `O:${info.line.id}`;
            const orderTotal = (allocatedToSource.get(orderKey) || 0) + qty;
            if (orderTotal > info.remaining)
                throw new Error(`ردیف ${idx + 1}: مجموع مقدار ردیف‌هایی که به این ردیف سفارش فروش ارجاع می‌دهند (${orderTotal}) از باقیمانده‌ی قابل تحویل (${info.remaining}) بیشتر است`);
            allocatedToSource.set(orderKey, orderTotal);
            if (!partyCustomerId || info.line.salesOrder.customerId !== partyCustomerId) {
                throw new Error(`مشتری سفارش فروش ردیف ${idx + 1} با طرف مقابل انتخاب‌شده در هدر یکسان نیست`);
            }
            sourceSalesOrderLineId = info.line.id;
            goodsItemId = info.line.goodsItemId;
            unitId = info.line.unitId;
        }
        else if (basis === "SALES_QUOTE") {
            if (!l.sourceSalesQuoteLineId)
                throw new Error(`ردیف ${idx + 1}: انتخاب ردیف پیش‌فاکتور الزامی است`);
            const info = await salesQuoteLineRemaining(l.sourceSalesQuoteLineId, excludeDeliveryId);
            if (!info)
                throw new Error(`ردیف پیش‌فاکتور برای ردیف ${idx + 1} یافت نشد`);
            if (info.line.salesQuote.status !== "APPROVED")
                throw new Error(`پیش‌فاکتور ردیف ${idx + 1} در وضعیت تایید نیست`);
            const quoteKey = `Q:${info.line.id}`;
            const quoteTotal = (allocatedToSource.get(quoteKey) || 0) + qty;
            if (quoteTotal > info.remaining)
                throw new Error(`ردیف ${idx + 1}: مجموع مقدار ردیف‌هایی که به این ردیف پیش‌فاکتور ارجاع می‌دهند (${quoteTotal}) از باقیمانده‌ی قابل تحویل (${info.remaining}) بیشتر است`);
            allocatedToSource.set(quoteKey, quoteTotal);
            if (!partyCustomerId || info.line.salesQuote.customerId !== partyCustomerId) {
                throw new Error(`مشتری پیش‌فاکتور ردیف ${idx + 1} با طرف مقابل انتخاب‌شده در هدر یکسان نیست`);
            }
            sourceSalesQuoteLineId = info.line.id;
            goodsItemId = info.line.goodsItemId;
            unitId = info.line.unitId;
        }
        else {
            // بدون مبنا
            if (!goodsItemId)
                throw new Error(`کالا برای ردیف ${idx + 1} الزامی است`);
            const allowed = await (0, warehouseDocGoodsFilterService_1.isGoodsItemAllowedForDocNature)(goodsItemId, "OUTBOUND", "فروش");
            if (!allowed)
                throw new Error(`کالای ردیف ${idx + 1} برای حواله فروش مجاز نیست`);
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
            sourceSalesOrderLineId,
            sourceSalesQuoteLineId,
            goodsItemId,
            unitId,
            quantity: qty,
            description: l.description || null,
            serialIds: l.serialIds || [],
            batchAllocations: l.batchAllocations || [],
            physicalLocation: l.physicalLocation || null,
        });
    }
    await (0, warehouseTracking_1.validateTrackingFields)(cleaned, "SALES_DELIVERY", existingSerialIds);
    return cleaned;
}
function partyTitle(p) {
    if (!p)
        return null;
    return p.category === "LEGAL" ? p.name || "" : `${p.firstName || ""} ${p.lastName || ""}`.trim();
}
// دسترسی «مشاهده اطلاعات حسابداری» — بدون این دسترسی، فیلدهای فی/مبلغ/جمع‌مبلغ اصلاً در پاسخ API قرار
// نمی‌گیرند (نه فقط در فرانت‌اند مخفی می‌شوند)؛ همان کدِ دقیق seed شده در prisma/seed.ts.
const VIEW_ACCOUNTING_PERMISSION = `${FORM}.viewAccounting`;
// =========================================================================
// پیکر «باقیمانده» سفارش فروش
// =========================================================================
router.get("/sales-deliveries/pickable-sales-order-lines", (0, guard_1.can)(`${FORM}.view`), async (req, res) => {
    const destDate = req.query.destDate ? new Date(req.query.destDate) : null;
    const lines = await prisma_1.prisma.salesOrderLine.findMany({
        where: { salesOrder: { status: "APPROVED", ...(destDate ? { date: { lte: destDate } } : {}) } },
        include: {
            salesOrder: { include: { customer: { include: { party: true } } } },
            goodsItem: true,
            unit: true,
            inventoryLines: { include: { document: true } },
        },
        orderBy: { id: "desc" },
    });
    const result = lines
        .map((l) => {
        const done = l.inventoryLines
            .filter((d) => d.document.documentType === "SALES_DELIVERY")
            .reduce((s, d) => s + Number(d.quantity), 0);
        const quantity = Number(l.quantity);
        const remaining = quantity - done;
        const party = l.salesOrder.customer.party;
        return {
            id: l.id,
            sourceLineId: l.id,
            sourceSalesOrderLineId: l.id,
            salesOrderId: l.salesOrder.id,
            number: l.salesOrder.number,
            date: l.salesOrder.date,
            customerTitle: party.category === "LEGAL" ? party.name : `${party.firstName || ""} ${party.lastName || ""}`.trim(),
            goodsItemId: l.goodsItemId,
            goodsItemCode: l.goodsItem.fullCode,
            goodsItemTitle: l.goodsItem.title,
            unitId: l.unitId,
            unitTitle: l.unit.title,
            quantity,
            done,
            remaining,
        };
    })
        .filter((r) => r.remaining > 0);
    res.json(result);
});
// =========================================================================
// پیکر «باقیمانده» پیش‌فاکتور (مبنای «پیش‌فاکتور»)
// =========================================================================
router.get("/sales-deliveries/pickable-sales-quote-lines", (0, guard_1.can)(`${FORM}.view`), async (req, res) => {
    const destDate = req.query.destDate ? new Date(req.query.destDate) : null;
    const lines = await prisma_1.prisma.salesQuoteLine.findMany({
        where: { salesQuote: { status: "APPROVED", ...(destDate ? { date: { lte: destDate } } : {}) } },
        include: {
            salesQuote: { include: { customer: { include: { party: true } } } },
            goodsItem: true,
            unit: true,
            salesOrderLines: true,
            inventoryLines: { include: { document: true } },
        },
        orderBy: { id: "desc" },
    });
    const result = lines
        .map((l) => {
        const ordered = l.salesOrderLines.reduce((s, o) => s + Number(o.quantity), 0);
        const done = l.inventoryLines
            .filter((d) => d.document.documentType === "SALES_DELIVERY")
            .reduce((s, d) => s + Number(d.quantity), 0);
        const quantity = Number(l.quantity);
        const remaining = quantity - ordered - done;
        const party = l.salesQuote.customer.party;
        return {
            id: l.id,
            sourceLineId: l.id,
            salesQuoteId: l.salesQuote.id,
            customerPartyId: party.id,
            number: l.salesQuote.number,
            date: l.salesQuote.date,
            customerTitle: party.category === "LEGAL" ? party.name : `${party.firstName || ""} ${party.lastName || ""}`.trim(),
            goodsItemId: l.goodsItemId,
            goodsItemCode: l.goodsItem.fullCode,
            goodsItemTitle: l.goodsItem.title,
            unitId: l.unitId,
            unitTitle: l.unit.title,
            quantity,
            done: ordered + done,
            remaining,
        };
    })
        .filter((r) => r.remaining > 0);
    res.json(result);
});
// =========================================================================
// CRUD + قطعی‌کردن/برگشت
// =========================================================================
router.get("/sales-deliveries", (0, guard_1.can)(`${FORM}.view`), async (req, res) => {
    const canViewAccounting = await (0, guard_1.userHasAction)(req.user.id, VIEW_ACCOUNTING_PERMISSION);
    const items = await prisma_1.prisma.inventoryDocument.findMany({
        where: { documentType: "SALES_DELIVERY" },
        include: { warehouse: true, fiscalPeriod: true, lines: true },
        orderBy: { id: "desc" },
    });
    const codeToPartyId = await (0, detailValues_1.resolveDetailEntityIds)(items.map((d) => d.detailCode), "Party");
    const parties = await prisma_1.prisma.party.findMany({ where: { id: { in: Object.values(codeToPartyId) } } });
    const partyById = new Map(parties.map((p) => [p.id, p]));
    const amountByLineId = await (0, documentItemAmountService_1.getLineAmounts)(items.flatMap((d) => d.lines.map((l) => l.id)));
    res.json(items.map((d) => {
        const partyId = d.detailCode ? codeToPartyId[d.detailCode] ?? null : null;
        return {
            id: d.id,
            number: d.number,
            date: d.date,
            warehouseId: d.warehouseId,
            warehouseTitle: d.warehouse.title,
            fiscalPeriodTitle: d.fiscalPeriod.title,
            basis: d.basis,
            partyId,
            partyTitle: partyTitle(partyId ? partyById.get(partyId) : null),
            description: d.description,
            status: d.status,
            lineCount: d.lines.length,
            totalQuantity: d.lines.reduce((s, l) => s + Number(l.quantity), 0),
            ...((canViewAccounting && d.status === "FINALIZED") ? { totalAmount: d.lines.reduce((s, l) => s + Number(amountByLineId.get(l.id) ?? 0), 0) } : {}),
        };
    }));
});
router.get("/sales-deliveries/:id", (0, guard_1.can)(`${FORM}.view`), async (req, res) => {
    const id = Number(req.params.id);
    const canViewAccounting = await (0, guard_1.userHasAction)(req.user.id, VIEW_ACCOUNTING_PERMISSION);
    const d = await prisma_1.prisma.inventoryDocument.findFirst({
        where: { id, documentType: "SALES_DELIVERY" },
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
        return res.status(404).json({ error: "حواله فروش یافت نشد" });
    const codeToPartyId = await (0, detailValues_1.resolveDetailEntityIds)([d.detailCode], "Party");
    const partyId = d.detailCode ? codeToPartyId[d.detailCode] ?? null : null;
    const party = partyId ? await prisma_1.prisma.party.findUnique({ where: { id: partyId } }) : null;
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
        partyId,
        partyTitle: partyTitle(party),
        description: d.description,
        status: d.status,
        finalizedAt: d.finalizedAt,
        updatedAt: d.updatedAt,
        lines: d.lines.map((l) => ({
            id: l.id,
            sourceSalesOrderLineId: l.sourceSalesOrderLineId,
            sourceSalesQuoteLineId: l.sourceSalesQuoteLineId,
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
// sales-delivery) دقیقاً یک منطق ثبت مشترک را اجرا کنند، نه دو پیاده‌سازی موازی — هم‌الگوی
// createWarehouseReceipt/createProductionConsumption.
async function createSalesDelivery(body) {
    if (!body.warehouseId || !body.date)
        throw new Error("انبار و تاریخ سند الزامی است");
    if (!body.basis)
        throw new Error("مبنا الزامی است");
    if (!body.partyId)
        throw new Error("طرف مقابل الزامی است");
    const party = await prisma_1.prisma.party.findUnique({ where: { id: body.partyId } });
    if (!party)
        throw new Error("طرف مقابل یافت نشد");
    const partyCustomerId = await resolveCustomerIdForParty(body.partyId);
    const cleanedLines = await validateLines(body.lines, body.basis, partyCustomerId);
    const date = new Date(body.date);
    const { warehouse, fiscalPeriod } = await validateWarehouseAndPeriod(body.warehouseId, date);
    const refs = await (0, warehouseTracking_1.resolveTrackingRefs)(cleanedLines, warehouse.id);
    const serialSteps = await (0, warehouseTracking_1.fetchCurrentSerialSteps)(refs.flatMap((r) => r.serialIds));
    const effectLines = cleanedLines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: l.quantity }));
    await (0, documentEffectsService_1.assertSafeToApplyEffects)(prisma_1.prisma, { documentType: "SALES_DELIVERY", warehouseId: warehouse.id, date }, effectLines, warehouse.stockControl);
    // فقط از مسیر Import پر می‌شود (طبق تصمیم صریح کاربر — دقیقاً هم‌الگوی warehouseReceipts.ts): هنگام
    // مهاجرت از سیستم قبلی، شماره سند نباید خودکار بازتولید شود. فرم دستی هرگز این فیلد را نمی‌فرستد.
    let number;
    if (body.number) {
        const dup = await prisma_1.prisma.inventoryDocument.findFirst({
            where: { documentType: "SALES_DELIVERY", fiscalPeriodId: fiscalPeriod.id, number: body.number },
        });
        if (dup)
            throw new Error(`شماره سند «${body.number}» در این دوره مالی قبلاً برای حواله فروش دیگری استفاده شده است`);
        number = body.number;
    }
    else {
        const lastNumber = await prisma_1.prisma.inventoryDocument.findFirst({
            where: { documentType: "SALES_DELIVERY", fiscalPeriodId: fiscalPeriod.id },
            orderBy: { number: "desc" },
        });
        number = lastNumber ? lastNumber.number + 1 : 1;
    }
    // طبق تصمیم کاربر: دیگر مرحله‌ی جداگانه‌ی «قطعی‌کردن» وجود ندارد — همان لحظه‌ی ذخیره، سند اثر واقعی
    // می‌گذارد (status مستقیم FINALIZED، نه DRAFT).
    return prisma_1.prisma.$transaction(async (tx) => {
        const doc = await tx.inventoryDocument.create({
            data: {
                documentType: "SALES_DELIVERY",
                warehouseId: warehouse.id,
                fiscalPeriodId: fiscalPeriod.id,
                number,
                date,
                basis: body.basis,
                detailCode: party.detailCode,
                description: body.description || null,
                status: "REGISTERED",
                lines: {
                    create: cleanedLines.map((l, idx) => ({
                        sourceSalesOrderLineId: l.sourceSalesOrderLineId,
                        sourceSalesQuoteLineId: l.sourceSalesQuoteLineId,
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
        await (0, documentEffectsService_1.applyDocumentEffects)(tx, { id: doc.id, documentType: "SALES_DELIVERY", warehouseId: warehouse.id, date }, effectLines);
        return doc;
    });
}
router.post("/sales-deliveries", (0, guard_1.can)(`${FORM}.create`), async (req, res) => {
    try {
        const created = await createSalesDelivery(req.body);
        res.status(201).json(created);
    }
    catch (e) {
        if (e.code === "P2002")
            return res.status(400).json({ error: "شماره سند تکراری است" });
        res.status(400).json({ error: e.message || "خطا در ذخیره" });
    }
});
router.put("/sales-deliveries/:id", (0, guard_1.can)(`${FORM}.edit`), async (req, res) => {
    const id = Number(req.params.id);
    const body = req.body;
    const existing = await prisma_1.prisma.inventoryDocument.findFirst({
        where: { id, documentType: "SALES_DELIVERY" },
        include: { lines: { include: { serials: true } }, warehouse: true },
    });
    if (!existing)
        return res.status(404).json({ error: "حواله فروش یافت نشد" });
    if (existing.status === "FINALIZED")
        return res.status(400).json({ error: "این سند با تایید انبار نهایی شده است و دیگر قابل ویرایش نیست" });
    const existingSerialIds = new Set(existing.lines.flatMap((l) => l.serials.map((s) => s.serialId)));
    if (!body.warehouseId || !body.date)
        return res.status(400).json({ error: "انبار و تاریخ سند الزامی است" });
    if (!body.basis)
        return res.status(400).json({ error: "مبنا الزامی است" });
    if (!body.partyId)
        return res.status(400).json({ error: "طرف مقابل الزامی است" });
    try {
        (0, concurrency_1.assertRecordNotStale)(existing.updatedAt, req.body.updatedAt, "این سند");
        await (0, warehouseConfirmationService_1.assertWarehouseOpenForDate)(existing.warehouseId, existing.date);
        // این سند از قبل هم «قطعی» است (دیگر مرحله‌ی جداگانه‌ای برای آن وجود ندارد) — پس ویرایش، به‌جای
        // «برگشت از قطعی دستی، سپس ویرایش، سپس دوباره قطعی‌کردن»، همین سه‌کار را در یک درخواست و با همان
        // کنترل‌های ایمنی انجام می‌دهد.
        const oldEffectLines = existing.lines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: Number(l.quantity) }));
        const oldDoc = { id: existing.id, documentType: existing.documentType, warehouseId: existing.warehouseId, date: existing.date };
        await (0, documentEffectsService_1.assertSafeToReverseEffects)(prisma_1.prisma, oldDoc, oldEffectLines, existing.warehouse.stockControl);
        const party = await prisma_1.prisma.party.findUnique({ where: { id: body.partyId } });
        if (!party)
            throw new Error("طرف مقابل یافت نشد");
        const partyCustomerId = await resolveCustomerIdForParty(body.partyId);
        const cleanedLines = await validateLines(body.lines, body.basis, partyCustomerId, id, existingSerialIds);
        const date = new Date(body.date);
        const { warehouse, fiscalPeriod } = await validateWarehouseAndPeriod(body.warehouseId, date);
        const refs = await (0, warehouseTracking_1.resolveTrackingRefs)(cleanedLines, warehouse.id);
        const serialSteps = await (0, warehouseTracking_1.fetchCurrentSerialSteps)(refs.flatMap((r) => r.serialIds));
        const newEffectLines = cleanedLines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: l.quantity }));
        // ⚠️ برخلاف ایجاد سند تازه، این‌جا excludeSelfId الزامی است.
        await (0, documentEffectsService_1.assertSafeToApplyEffects)(prisma_1.prisma, { documentType: "SALES_DELIVERY", warehouseId: warehouse.id, date }, newEffectLines, warehouse.stockControl, id);
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
                    detailCode: party.detailCode,
                    description: body.description || null,
                    lines: {
                        create: cleanedLines.map((l, idx) => ({
                            sourceSalesOrderLineId: l.sourceSalesOrderLineId,
                            sourceSalesQuoteLineId: l.sourceSalesQuoteLineId,
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
            await (0, documentEffectsService_1.applyDocumentEffects)(tx, { id, documentType: "SALES_DELIVERY", warehouseId: warehouse.id, date }, newEffectLines);
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
router.delete("/sales-deliveries/:id", (0, guard_1.can)(`${FORM}.delete`), async (req, res) => {
    const id = Number(req.params.id);
    const d = await prisma_1.prisma.inventoryDocument.findFirst({ where: { id, documentType: "SALES_DELIVERY" }, include: { lines: true, warehouse: true } });
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
