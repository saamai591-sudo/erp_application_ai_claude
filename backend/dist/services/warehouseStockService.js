"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SIGNED_TYPES = void 0;
exports.computeStockAsOf = computeStockAsOf;
exports.assertNoNegativeStockAfterChange = assertNoNegativeStockAfterChange;
const prisma_1 = require("../lib/prisma");
// وارده (+۱) / صادره (-۱) — دقیقاً طبق بند ۳۴ سند stockAnalysis.md
exports.SIGNED_TYPES = [
    { documentType: "INITIAL_INVENTORY", sign: 1, warehouseField: "warehouseId", excludeKey: "excludeInitialInventoryId" },
    { documentType: "WAREHOUSE_RECEIPT", sign: 1, warehouseField: "warehouseId", excludeKey: "excludeWarehouseReceiptId" },
    { documentType: "SALES_RETURN", sign: 1, warehouseField: "warehouseId", excludeKey: "excludeSalesReturnId" },
    { documentType: "PRODUCTION_RECEIPT", sign: 1, warehouseField: "warehouseId", excludeKey: "excludeProductionReceiptId" },
    { documentType: "CENTER_CONSUMPTION_RETURN", sign: 1, warehouseField: "warehouseId", excludeKey: "excludeCenterConsumptionReturnId" },
    { documentType: "PROJECT_CONSUMPTION_RETURN", sign: 1, warehouseField: "warehouseId", excludeKey: "excludeProjectConsumptionReturnId" },
    { documentType: "PRODUCTION_CONSUMPTION_RETURN", sign: 1, warehouseField: "warehouseId", excludeKey: "excludeProductionConsumptionReturnId" },
    { documentType: "WAREHOUSE_TRANSFER_OUT", sign: -1, warehouseField: "warehouseId", excludeKey: "excludeWarehouseTransferOutId" },
    { documentType: "WAREHOUSE_TRANSFER_IN", sign: 1, warehouseField: "warehouseId", excludeKey: "excludeWarehouseTransferInId" },
    { documentType: "SALES_DELIVERY", sign: -1, warehouseField: "warehouseId", excludeKey: "excludeSalesDeliveryId" },
    { documentType: "CENTER_CONSUMPTION", sign: -1, warehouseField: "warehouseId", excludeKey: "excludeCenterConsumptionId" },
    { documentType: "PROJECT_CONSUMPTION", sign: -1, warehouseField: "warehouseId", excludeKey: "excludeProjectConsumptionId" },
    { documentType: "PRODUCTION_CONSUMPTION", sign: -1, warehouseField: "warehouseId", excludeKey: "excludeProductionConsumptionId" },
    { documentType: "SUPPLIER_RETURN", sign: -1, warehouseField: "warehouseId", excludeKey: "excludeSupplierReturnId" },
    { documentType: "FIXED_ASSET_ISSUE", sign: -1, warehouseField: "warehouseId", excludeKey: "excludeFixedAssetIssueId" },
    { documentType: "INVENTORY_COUNTING_SHORTAGE", sign: -1, warehouseField: "warehouseId", excludeKey: "excludeInventoryCountingShortageId" },
];
function sum(rows) {
    return rows.reduce((s, l) => s + Number(l.quantity), 0);
}
// موجودی کالا در یک انبار، تا (و شامل) یک تاریخ مشخص، بر اساس تمام اسناد انباریِ قطعی‌شده
async function computeStockAsOf(warehouseId, goodsItemId, asOfDate, opts = {}, db = prisma_1.prisma) {
    const signedQueries = exports.SIGNED_TYPES.map((rule) => db.inventoryDocumentLine
        .findMany({
        where: {
            goodsItemId,
            document: {
                documentType: rule.documentType,
                [rule.warehouseField]: warehouseId,
                date: { lte: asOfDate },
                ...(opts[rule.excludeKey] ? { NOT: { id: opts[rule.excludeKey] } } : {}),
            },
        },
        select: { quantity: true },
    })
        .then((rows) => rule.sign * sum(rows)));
    const adjustmentQuery = db.inventoryDocumentLine
        .findMany({
        where: {
            goodsItemId,
            document: {
                documentType: "WAREHOUSE_ADJUSTMENT",
                warehouseId,
                date: { lte: asOfDate },
                ...(opts.excludeWarehouseAdjustmentId ? { NOT: { id: opts.excludeWarehouseAdjustmentId } } : {}),
            },
        },
        select: { quantity: true },
    })
        // WAREHOUSE_ADJUSTMENT.quantity در جدول یکپارچه از قبل امضادار ذخیره می‌شود (adjustmentQuantity قدیم)
        .then((rows) => sum(rows));
    const parts = await Promise.all([...signedQueries, adjustmentQuery]);
    return parts.reduce((s, p) => s + p, 0);
}
/**
 * کنترل می‌کند که اعمال یک تغییر کاهشی (حذف سند/برگشت از قطعی/کاهش مقدار ردیف/قطعی‌کردن یک سند صادره)
 * موجودی کالا را از تاریخ سند به بعد منفی نمی‌کند. برای تغییرات افزایشی (delta >= 0) کنترلی لازم نیست،
 * چون طبق قانون ۸ مستند موجودی اول دوره (و همان قاعده‌ی عمومی برای بقیه‌ی اسناد انبار)، مقدار منفی از
 * ابتدا مجاز نیست.
 */
async function assertNoNegativeStockAfterChange(opts, db = prisma_1.prisma) {
    if (opts.delta >= 0)
        return;
    const current = await computeStockAsOf(opts.warehouseId, opts.goodsItemId, opts.asOfDate, opts, db);
    if (current + opts.delta < 0) {
        // موجودی همیشه همین لحظه از پایگاه‌داده محاسبه می‌شود (نه کش/فرانت‌اند)؛ جزئیات در پیام تا علت (کالا/انبار/تاریخ سند) روشن باشد
        const [item, wh] = await Promise.all([db.goodsItem.findUnique({ where: { id: opts.goodsItemId } }), db.warehouse.findUnique({ where: { id: opts.warehouseId } })]);
        throw new Error(`این تغییر باعث منفی شدن موجودی کالا در انبار می‌شود (کالا «${item?.title ?? opts.goodsItemId}»، انبار «${wh?.title ?? opts.warehouseId}»، موجودی تا تاریخ سند: ${current}، تغییر: ${opts.delta})`);
    }
}
