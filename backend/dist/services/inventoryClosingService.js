"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentClosing = getCurrentClosing;
exports.assertWarehouseOpenForDate = assertWarehouseOpenForDate;
exports.closeInventory = closeInventory;
exports.rollbackClosing = rollbackClosing;
const prisma_1 = require("../lib/prisma");
const warehouseStockService_1 = require("./warehouseStockService");
async function getCurrentClosing(warehouseId) {
    return prisma_1.prisma.inventoryClosing.findFirst({
        where: { warehouseId },
        orderBy: { id: "desc" },
    });
}
/**
 * طبق بند ۵۰-۵۱: سندی با DocumentDate <= LastClosingDate آن انبار، دیگر قابل Create/Update/Delete
 * نیست. اگر انبار هیچ Closing‌ای نداشته باشد، محدودیتی وجود ندارد.
 */
async function assertWarehouseOpenForDate(warehouseId, date) {
    const current = await getCurrentClosing(warehouseId);
    if (!current)
        return;
    if (date.getTime() <= current.closingDate.getTime()) {
        throw new Error(`این انبار تا تاریخ ${current.closingDate.toISOString().slice(0, 10)} بسته شده است؛ برای اصلاح اسناد این بازه ابتدا باید «برگشت بستن موجودی» انجام شود`);
    }
}
// مجموعه‌ی distinct کالاهایی که تا closingDate، حداقل یک سند قطعی‌شده در این انبار دارند (به هر سه
// نقش warehouseId/sourceWarehouseId/destWarehouseId — دقیقاً همان دامنه‌ای که computeStockAsOf می‌بیند)
async function listGoodsItemIdsWithActivity(warehouseId, closingDate) {
    const rows = await prisma_1.prisma.inventoryDocumentLine.findMany({
        where: {
            document: {
                status: "FINALIZED",
                date: { lte: closingDate },
                OR: [{ warehouseId }, { sourceWarehouseId: warehouseId }, { destWarehouseId: warehouseId }],
            },
        },
        select: { goodsItemId: true },
        distinct: ["goodsItemId"],
    });
    return rows.map((r) => r.goodsItemId);
}
// طبق بند ۵۴: Snapshot جدید هرگز از یک Snapshot قبلی محاسبه نمی‌شود — همیشه مستقیم از اسناد.
async function buildSnapshotLines(warehouseId, closingDate) {
    const goodsItemIds = await listGoodsItemIdsWithActivity(warehouseId, closingDate);
    const quantities = await Promise.all(goodsItemIds.map((goodsItemId) => (0, warehouseStockService_1.computeStockAsOf)(warehouseId, goodsItemId, closingDate)));
    return goodsItemIds
        .map((goodsItemId, idx) => ({ goodsItemId, quantity: quantities[idx] }))
        .filter((l) => l.quantity !== 0);
}
/**
 * بستن موجودی انبار تا closingDate. طبق منطق عمومی «بستن»، تاریخ جدید باید از آخرین Closing این انبار
 * (در صورت وجود) جلوتر باشد — حرکت به عقب کار «برگشت بستن موجودی» (rollback) است، نه «بستن».
 */
async function closeInventory(warehouseId, closingDate, userId) {
    const current = await getCurrentClosing(warehouseId);
    if (current && closingDate.getTime() <= current.closingDate.getTime()) {
        throw new Error("تاریخ بستن جدید باید از تاریخ آخرین بستن این انبار جلوتر باشد");
    }
    const lines = await buildSnapshotLines(warehouseId, closingDate);
    const closing = await prisma_1.prisma.$transaction(async (tx) => {
        const created = await tx.inventoryClosing.create({
            data: {
                warehouseId,
                closingDate,
                createdById: userId,
                lines: { create: lines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: l.quantity })) },
            },
        });
        await tx.inventoryClosingAudit.create({
            data: {
                action: "CLOSE",
                warehouseId,
                oldClosingDate: current?.closingDate ?? null,
                newClosingDate: closingDate,
                userId,
            },
        });
        return created;
    });
    return { closingId: closing.id, closingDate: closing.closingDate, lineCount: lines.length };
}
/**
 * برگشت بستن موجودی: طبق بند ۵۲-۵۷، انتقال Closing جاری این انبار به یک تاریخ قدیمی‌تر (newClosingDate
 * باید حتماً از closingDate فعلی عقب‌تر باشد). Snapshot جدید هم مثل closeInventory کاملاً از اسناد
 * واقعی (نه از Snapshot قبلی) بازمحاسبه می‌شود.
 */
async function rollbackClosing(warehouseId, newClosingDate, reason, userId) {
    const current = await getCurrentClosing(warehouseId);
    if (!current)
        throw new Error("این انبار هیچ Closing‌ای ندارد که قابل برگشت باشد");
    if (newClosingDate.getTime() >= current.closingDate.getTime()) {
        throw new Error("تاریخ برگشت باید از تاریخ Closing جاری این انبار قدیمی‌تر باشد");
    }
    const lines = await buildSnapshotLines(warehouseId, newClosingDate);
    const closing = await prisma_1.prisma.$transaction(async (tx) => {
        const created = await tx.inventoryClosing.create({
            data: {
                warehouseId,
                closingDate: newClosingDate,
                createdById: userId,
                lines: { create: lines.map((l) => ({ goodsItemId: l.goodsItemId, quantity: l.quantity })) },
            },
        });
        await tx.inventoryClosingAudit.create({
            data: {
                action: "ROLLBACK",
                warehouseId,
                oldClosingDate: current.closingDate,
                newClosingDate,
                reason,
                userId,
            },
        });
        return created;
    });
    return { closingId: closing.id, closingDate: closing.closingDate, lineCount: lines.length };
}
