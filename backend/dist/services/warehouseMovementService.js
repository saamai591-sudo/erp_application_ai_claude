"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OUTBOUND_DOC_TYPES = void 0;
exports.getMovements = getMovements;
const prisma_1 = require("../lib/prisma");
const detailValues_1 = require("../utils/detailValues");
const documentItemAmountService_1 = require("./documentItemAmountService");
const DOC_TYPE_FA = {
    INITIAL_INVENTORY: "موجودی اول دوره",
    WAREHOUSE_RECEIPT: "رسید انبار خرید",
    WAREHOUSE_TRANSFER_OUT: "حواله انتقالی",
    WAREHOUSE_TRANSFER_IN: "رسید انتقال",
    WAREHOUSE_ADJUSTMENT: "اضافات انبارگردانی",
    SALES_DELIVERY: "حواله فروش",
    SALES_RETURN: "برگشت از فروش",
    SUPPLIER_RETURN: "برگشت به تامین‌کننده",
    PRODUCTION_RECEIPT: "رسید تولید",
    CENTER_CONSUMPTION: "مصرف مرکز هزینه",
    PROJECT_CONSUMPTION: "مصرف پروژه",
    PRODUCTION_CONSUMPTION: "مصرف تولید",
    CENTER_CONSUMPTION_RETURN: "برگشت مصرف مرکز هزینه",
    PROJECT_CONSUMPTION_RETURN: "برگشت مصرف پروژه",
    PRODUCTION_CONSUMPTION_RETURN: "برگشت مصرف تولید",
    FIXED_ASSET_ISSUE: "حواله دارایی ثابت",
    INVENTORY_COUNTING_SHORTAGE: "کسری انبارگردانی",
};
// دقیقاً همان جهت‌ها/علائم warehouseStockService.SIGNED_TYPES — صادره یعنی OUT
exports.OUTBOUND_DOC_TYPES = new Set([
    "SALES_DELIVERY",
    "CENTER_CONSUMPTION",
    "PROJECT_CONSUMPTION",
    "PRODUCTION_CONSUMPTION",
    "SUPPLIER_RETURN",
    "FIXED_ASSET_ISSUE",
    "WAREHOUSE_TRANSFER_OUT",
    "INVENTORY_COUNTING_SHORTAGE",
]);
function lineTrackingWhere(f) {
    const where = {};
    if (f.goodsItemIds?.length)
        where.goodsItemId = { in: f.goodsItemIds };
    if (f.serialNumbers?.length)
        where.serials = { some: { serial: { serialNumber: { in: f.serialNumbers } } } };
    if (f.batchNumbers?.length)
        where.batch = { batchNumber: { in: f.batchNumbers } };
    if (f.expiryDates?.length)
        where.batch = { ...(where.batch || {}), expiryDate: { in: f.expiryDates } };
    if (f.physicalLocations?.length)
        where.physicalLocation = { title: { in: f.physicalLocations } };
    return where;
}
async function getMovements(f) {
    const warehouseIn = f.warehouseIds?.length ? { in: f.warehouseIds } : undefined;
    const lineWhere = lineTrackingWhere(f);
    const lines = await prisma_1.prisma.inventoryDocumentLine.findMany({
        where: {
            ...lineWhere,
            document: {
                date: { lte: f.toDate },
                documentType: {
                    in: [
                        "INITIAL_INVENTORY",
                        "WAREHOUSE_RECEIPT",
                        "WAREHOUSE_TRANSFER_OUT",
                        "WAREHOUSE_TRANSFER_IN",
                        "WAREHOUSE_ADJUSTMENT",
                        "SALES_DELIVERY",
                        "SALES_RETURN",
                        "SUPPLIER_RETURN",
                        "PRODUCTION_RECEIPT",
                        "CENTER_CONSUMPTION",
                        "PROJECT_CONSUMPTION",
                        "PRODUCTION_CONSUMPTION",
                        "CENTER_CONSUMPTION_RETURN",
                        "PROJECT_CONSUMPTION_RETURN",
                        "PRODUCTION_CONSUMPTION_RETURN",
                        "FIXED_ASSET_ISSUE",
                        "INVENTORY_COUNTING_SHORTAGE",
                    ],
                },
            },
        },
        include: {
            goodsItem: true,
            batches: { include: { batch: true } },
            physicalLocation: true,
            serials: { include: { serial: true } },
            document: true,
            sourceWarehouseTransferOutLine: { include: { document: true } },
        },
    });
    // مبلغ هر ردیف دیگر ستون خام نیست — طبق Documents/WareHouseAmountChanges.md، SUM(Difference)
    // تاریخچه‌ی همان ردیف است؛ یک کوئری batched برای همه‌ی خطوط این گزارش، نه یک کوئری جدا به ازای هرکدام.
    const amountByLineId = await (0, documentItemAmountService_1.getLineAmounts)(lines.map((l) => l.id));
    // رزولوشن دسته‌ای یک‌باره‌ی عنوان تفصیل برای همه‌ی خطوط — بدون نیاز به دانستن نوع تفصیل (طرف
    // حساب/مرکز هزینه/پروژه/...)، resolveDetailTitles از روی DetailCodeUsage خودش تشخیص می‌دهد
    const detailTitles = await (0, detailValues_1.resolveDetailTitles)(lines.map((l) => l.document.detailCode));
    // انبارها کم‌تعدادند؛ یک‌باره همه را می‌خوانیم تا هم ستون «انبار» و هم طرف مقابلِ انتقال (مقصد/مبدا)
    // بدون کوئری اضافه به‌ازای هر خط قابل رزولوشن باشند
    const warehouses = await prisma_1.prisma.warehouse.findMany();
    const warehouseById = new Map(warehouses.map((w) => [w.id, w]));
    const movements = [];
    const base = (l) => {
        const doc = l.document;
        const warehouse = warehouseById.get(doc.warehouseId);
        let detailCode = doc.detailCode ?? null;
        let detailTitle = detailCode ? detailTitles[detailCode] ?? null : null;
        if (doc.documentType === "WAREHOUSE_TRANSFER_OUT") {
            const counterpart = doc.destWarehouseId ? warehouseById.get(doc.destWarehouseId) : null;
            detailCode = counterpart ? String(counterpart.code) : null;
            detailTitle = counterpart?.title ?? null;
        }
        else if (doc.documentType === "WAREHOUSE_TRANSFER_IN") {
            const sourceWarehouseId = l.sourceWarehouseTransferOutLine?.document.warehouseId ?? null;
            const counterpart = sourceWarehouseId ? warehouseById.get(sourceWarehouseId) : null;
            detailCode = counterpart ? String(counterpart.code) : null;
            detailTitle = counterpart?.title ?? null;
        }
        return {
            goodsItemId: l.goodsItemId,
            goodsItemCode: l.goodsItem.fullCode,
            goodsItemTitle: l.goodsItem.title,
            lineId: l.id,
            serialNumber: l.serials[0]?.serial.serialNumber ?? null,
            batchNumber: l.batches[0]?.batch.batchNumber ?? l.serials[0]?.serial.batch ?? null,
            expiryDate: l.batches[0]?.batch.expiryDate ?? l.serials[0]?.serial.expiryDate ?? null,
            physicalLocation: l.physicalLocation?.title ?? null,
            warehouseCode: warehouse?.code ?? null,
            warehouseTitle: warehouse?.title ?? null,
            detailCode,
            detailTitle,
            isOpeningBalance: doc.documentType === "INITIAL_INVENTORY",
        };
    };
    for (const l of lines) {
        const doc = l.document;
        if (warehouseIn && !warehouseIn.in.includes(doc.warehouseId))
            continue;
        if (doc.documentType === "WAREHOUSE_ADJUSTMENT") {
            const adj = Number(l.quantity);
            if (adj === 0)
                continue;
            movements.push({
                ...base(l),
                direction: adj > 0 ? "IN" : "OUT",
                warehouseId: doc.warehouseId,
                quantity: Math.abs(adj),
                amount: Number(amountByLineId.get(l.id) ?? 0),
                date: doc.date,
                docType: DOC_TYPE_FA[doc.documentType],
                docId: doc.id,
                docNumber: doc.number,
            });
            continue;
        }
        const direction = exports.OUTBOUND_DOC_TYPES.has(doc.documentType) ? "OUT" : "IN";
        for (const unit of trackingUnits({ ...l, amount: Number(amountByLineId.get(l.id) ?? 0) })) {
            movements.push({
                ...base(l),
                ...unit,
                direction,
                warehouseId: doc.warehouseId,
                date: doc.date,
                docType: DOC_TYPE_FA[doc.documentType],
                docId: doc.id,
                docNumber: doc.number,
            });
        }
    }
    return movements;
}
/** amount کل را متناسب با وزن هر واحد تقسیم می‌کند؛ باقیمانده‌ی گرد کردن روی واحد آخر می‌افتد تا مجموع
 * دقیقاً با amount ورودی برابر بماند (مثل توزیع مبلغ سطر فاکتور بین ردیف‌های سریال/بچ). */
function splitAmounts(total, weights) {
    const totalWeight = weights.reduce((s, w) => s + w, 0);
    if (totalWeight <= 0)
        return weights.map(() => 0);
    let allocated = 0;
    return weights.map((w, i) => {
        if (i === weights.length - 1)
            return Math.round((total - allocated) * 100) / 100;
        const amt = Math.round(((total * w) / totalWeight) * 100) / 100;
        allocated += amt;
        return amt;
    });
}
/**
 * یک سطر سند را (به‌جز انبارگردانی) به یک «واحد گردش» به‌ازای هر سریال/بچ می‌شکند — طبق
 * validateTrackingFields، تعداد سریال‌های سطر همیشه دقیقاً با quantity سطر برابر است (هر سریال یک
 * واحد مستقل) و جمع quantity بچ‌های سطر هم دقیقاً با quantity سطر برابر است؛ در نتیجه اینجا هرگز کسری
 * باقی نمی‌ماند. بدون این تفکیک، گزارش «کالا-سریال»/«کالا-بچ» یک سطرِ چندسریالی/چندبچی را فقط با اولین
 * سریال/بچ‌اش (l.serials[0]/l.batches[0]) نشان می‌داد و بقیه را نادیده می‌گرفت.
 * انبارگردانی از این تابع استفاده نمی‌کند: quantity آن دلتای امضادار (شمارش − سیستمی) است، نه شمارش
 * سریال‌های انتخاب‌شده (که برابر شمارش فیزیکی کامل است)، پس شمارش سریال/بچ آن با quantity سطر یکی نیست.
 */
function trackingUnits(l) {
    const totalAmount = Number(l.amount);
    if (l.serials.length > 0) {
        const amounts = splitAmounts(totalAmount, l.serials.map(() => 1));
        return l.serials.map((s, i) => ({
            quantity: 1,
            amount: amounts[i],
            serialNumber: s.serial.serialNumber,
            batchNumber: s.serial.batch ?? null,
            expiryDate: s.serial.expiryDate ?? null,
        }));
    }
    if (l.batches.length > 0) {
        const amounts = splitAmounts(totalAmount, l.batches.map((b) => Number(b.quantity)));
        return l.batches.map((b, i) => ({
            quantity: Number(b.quantity),
            amount: amounts[i],
            serialNumber: null,
            batchNumber: b.batch.batchNumber,
            expiryDate: b.batch.expiryDate,
        }));
    }
    return [{ quantity: Number(l.quantity), amount: totalAmount, serialNumber: null, batchNumber: null, expiryDate: null }];
}
